import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendSMSRequest {
  invoiceId?: string;
  quoteId?: string;
  customerId?: string;
  phoneNumber: string;
  messageBody: string;
  companyId?: string;
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bearerToken = authHeader.replace("Bearer ", "").trim();
    const isServiceRole = bearerToken === supabaseServiceKey;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let companyId: string | null = null;

    if (isServiceRole) {
      console.log("Service role authentication detected");
      const body = await req.clone().json();
      if (body.companyId) {
        companyId = body.companyId;
        console.log("Using companyId from request body:", companyId);
      }
    } else {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: authHeader },
        },
      });

      const { data: { user }, error: userError } = await userClient.auth.getUser();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !userProfile?.company_id) {
        return new Response(
          JSON.stringify({ error: "User company not found" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      companyId = userProfile.company_id;
    }

    const { invoiceId, quoteId, customerId, phoneNumber, messageBody }: SendSMSRequest = await req.json();

    if (!phoneNumber || !messageBody) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: phoneNumber and messageBody are required" }),
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
      .eq('id', companyId)
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

    // Use service role key for crypto-service calls to ensure proper authorization
    const cryptoAuthHeader = `Bearer ${supabaseServiceKey}`;

    // Decrypt Twilio credentials
    const cryptoResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: cryptoAuthHeader,
      },
      body: JSON.stringify({
        action: "decrypt",
        token: settings.twilio_account_sid,
      }),
    });

    const accountSid = cryptoResponse.ok ? (await cryptoResponse.json()).result : settings.twilio_account_sid;

    const tokenResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: cryptoAuthHeader,
      },
      body: JSON.stringify({
        action: "decrypt",
        token: settings.twilio_auth_token,
      }),
    });

    const authToken = tokenResponse.ok ? (await tokenResponse.json()).result : settings.twilio_auth_token;

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
      invoice_id: invoiceId || null,
      quote_id: quoteId || null,
      company_id: companyId,
      customer_id: customerId || null,
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