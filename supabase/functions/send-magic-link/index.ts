import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendMagicLinkRequest {
  email: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email } = await req.json() as SendMagicLinkRequest;

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await supabase.rpc("create_portal_session", {
      p_email: email.toLowerCase().trim()
    });

    if (result.error) {
      throw result.error;
    }

    const data = result.data as any;

    if (!data.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: data.error || "Customer not found"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const magicToken = data.token;
    const customerId = data.customer_id;
    const companyId = data.company_id;

    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name, customer_url, customer_url_verification_status, email_from_address, resend_api_key")
      .eq("id", companyId)
      .maybeSingle();

    if (!companySettings) {
      throw new Error("Company settings not found");
    }

    const baseUrl = companySettings.customer_url && companySettings.customer_url_verification_status === 'verified'
      ? companySettings.customer_url
      : supabaseUrl.replace('https://', 'https://app.');

    const magicLink = `${baseUrl}/portal/login?token=${magicToken}`;

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Sign in to ${companySettings.company_name} Customer Portal</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
          Click the button below to securely sign in to your customer portal:
        </p>
        <div style="margin: 30px 0;">
          <a href="${magicLink}"
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            Sign In to Portal
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This link will expire in 15 minutes for security purposes.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't request this link, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          ${companySettings.company_name}
        </p>
      </div>
    `;

    if (!companySettings.resend_api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured. Please contact support.",
          debug: { magicLink }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        token: companySettings.resend_api_key,
      }),
    });

    if (!decryptResponse.ok) {
      const errorData = await decryptResponse.json();
      console.error("Failed to decrypt API key:", errorData);
      throw new Error(`Failed to decrypt email API key: ${errorData.error || 'Unknown error'}`);
    }

    const { result: resendApiKey } = await decryptResponse.json();
    const fromEmail = companySettings.email_from_address || 'noreply@inkops.com';

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Sign in to ${companySettings.company_name} Customer Portal`,
        html: emailBody,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error("Failed to send email");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Magic link sent! Check your email."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error sending magic link:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
