import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendSMSRequest {
  invoiceId: string;
  customerId: string;
  phoneNumber: string;
  messageBody: string;
}

interface TwilioResponse {
  sid: string;
  status: string;
  error_code?: string;
  error_message?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { invoiceId, customerId, phoneNumber, messageBody }: SendSMSRequest = await req.json();

    if (!invoiceId || !phoneNumber || !messageBody) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Twilio credentials from company_settings
    const { data: settings, error: settingsError } = await supabase
      .from("company_settings")
      .select("twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_enabled")
      .maybeSingle();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "Failed to load Twilio settings" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!settings.twilio_enabled) {
      return new Response(
        JSON.stringify({ error: "Twilio SMS is not enabled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!settings.twilio_account_sid || !settings.twilio_auth_token || !settings.twilio_phone_number) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Decrypt Twilio credentials
    const cryptoResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        action: "decrypt",
        data: settings.twilio_account_sid,
      }),
    });

    const accountSid = cryptoResponse.ok ? (await cryptoResponse.json()).decrypted : settings.twilio_account_sid;

    const tokenResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        action: "decrypt",
        data: settings.twilio_auth_token,
      }),
    });

    const authToken = tokenResponse.ok ? (await tokenResponse.json()).decrypted : settings.twilio_auth_token;

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioAuth = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append("To", phoneNumber);
    formData.append("From", settings.twilio_phone_number);
    formData.append("Body", messageBody);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${twilioAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioData: TwilioResponse = await twilioResponse.json();

    // Log SMS to database
    const smsLog = {
      invoice_id: invoiceId,
      customer_id: customerId,
      phone_number: phoneNumber,
      message_body: messageBody,
      delivery_status: twilioResponse.ok ? "sent" : "failed",
      twilio_sid: twilioData.sid || null,
      error_message: twilioData.error_message || null,
      sent_at: new Date().toISOString(),
    };

    const { error: logError } = await supabase
      .from("sms_logs")
      .insert([smsLog]);

    if (logError) {
      console.error("Failed to log SMS:", logError);
    }

    if (!twilioResponse.ok) {
      return new Response(
        JSON.stringify({
          error: twilioData.error_message || "Failed to send SMS",
          details: twilioData,
        }),
        {
          status: twilioResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        sid: twilioData.sid,
        status: twilioData.status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
