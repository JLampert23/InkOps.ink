import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestPasswordResetRequest {
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

    const { email } = await req.json() as RequestPasswordResetRequest;

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await supabase.rpc("create_password_reset_request", {
      p_email: email.toLowerCase().trim()
    });

    if (result.error) {
      console.error("RPC error:", result.error);
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email will be sent." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = result.data as { success: boolean; token?: string; company_id?: string; error?: string };

    if (!data.success) {
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email will be sent." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resetToken = data.token;
    const companyId = data.company_id;

    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name, inkops_subdomain, email_from_address, resend_api_key")
      .eq("id", companyId)
      .maybeSingle();

    if (!companySettings) {
      console.error("Company settings not found for company:", companyId);
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email will be sent." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let subdomain = companySettings.inkops_subdomain;
    if (!subdomain && companySettings.company_name) {
      subdomain = companySettings.company_name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
    }
    const baseUrl = subdomain ? `https://${subdomain}.inkops.ink` : "https://inkops.ink";
    const resetLink = `${baseUrl}/portal/reset-password?token=${resetToken}`;

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Reset Your Password</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
          We received a request to reset your password for the ${companySettings.company_name} customer portal.
        </p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
          Click the button below to create a new password:
        </p>
        <div style="margin: 30px 0;">
          <a href="${resetLink}"
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            Reset Password
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          This link will expire in 1 hour for security purposes.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          ${companySettings.company_name}
        </p>
      </div>
    `;

    if (!companySettings.resend_api_key) {
      console.error("Email service not configured for company:", companyId);
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email will be sent." }),
        {
          status: 200,
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
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email will be sent." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
        subject: `Reset your ${companySettings.company_name} password`,
        html: emailBody,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "If an account exists with this email, you will receive password reset instructions."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error requesting password reset:", error);
    return new Response(
      JSON.stringify({
        success: true,
        message: "If an account exists with this email, you will receive password reset instructions."
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
