import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationPayload {
  notification_id: string;
  company_id: string;
  notification_type: string;
  title: string;
  message: string;
  reference_type?: string;
  reference_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Parse the notification payload
    const payload: NotificationPayload = await req.json();

    const {
      notification_id,
      company_id,
      notification_type,
      title,
      message,
      reference_type,
      reference_id
    } = payload;

    // Validate required fields
    if (!notification_id || !company_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Fetch company settings to get forwarding email and Resend API key
    const settingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/company_settings?id=eq.${company_id}&select=notification_forwarding_email,notification_forwarding_enabled,resend_api_key,email_from_address`,
      {
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!settingsResponse.ok) {
      throw new Error("Failed to fetch company settings");
    }

    const settings = await settingsResponse.json();

    if (!settings || settings.length === 0) {
      return new Response(
        JSON.stringify({ error: "Company settings not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const companySettings = settings[0];

    // Check if email forwarding is enabled
    if (!companySettings.notification_forwarding_enabled) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email forwarding is disabled"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if forwarding email is configured
    if (!companySettings.notification_forwarding_email) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No forwarding email configured"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if Resend API key is configured
    if (!companySettings.resend_api_key) {
      console.error("Resend API key not configured for company:", company_id);
      return new Response(
        JSON.stringify({
          error: "Email service not configured"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Decrypt the Resend API key
    const decryptResponse = await fetch(
      `${supabaseUrl}/functions/v1/crypto-service`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "decrypt",
          token: companySettings.resend_api_key,
        }),
      }
    );

    if (!decryptResponse.ok) {
      throw new Error("Failed to decrypt API key");
    }

    const { result: decrypted } = await decryptResponse.json();
    const resendApiKey = decrypted;

    // Build email content
    const fromAddress = companySettings.email_from_address || "notifications@inkops.com";

    let emailBody = `
      <h2>${title}</h2>
      <p>${message}</p>
    `;

    // Add reference information if available
    if (reference_type && reference_id) {
      emailBody += `
        <hr />
        <p style="color: #666; font-size: 0.9em;">
          <strong>Reference:</strong> ${reference_type} (ID: ${reference_id})<br />
          <strong>Type:</strong> ${notification_type || 'General'}
        </p>
      `;
    }

    // Send email using Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: companySettings.notification_forwarding_email,
        subject: `[InkOps Notification] ${title}`,
        html: emailBody,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const emailResult = await emailResponse.json();

    // Log successful email delivery
    console.log(`Notification email sent successfully:`, {
      notification_id,
      email_id: emailResult.id,
      recipient: companySettings.notification_forwarding_email,
    });

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailResult.id,
        message: "Notification email sent successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error forwarding notification email:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
