import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WelcomeEmailRequest {
  customerId: string;
  email: string;
  customerName?: string;
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

    // Get the authorization header to verify the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { customerId, email, customerName } = await req.json() as WelcomeEmailRequest;

    if (!customerId || !email) {
      return new Response(
        JSON.stringify({ error: "Customer ID and email are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the customer exists and get company info
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, company_id, customer_name, customer_email")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ error: "Customer not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get company settings for branding
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name, inkops_subdomain, customer_url, email_from_address, resend_api_key, company_logo_primary_url")
      .eq("id", customer.company_id)
      .maybeSingle();

    if (!companySettings) {
      throw new Error("Company settings not found");
    }

    // Generate magic link token for password setup
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
          error: data.error || "Failed to create portal session"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const setupToken = data.token;

    // Determine portal URL
    const portalUrl = companySettings.customer_url ||
                      (companySettings.inkops_subdomain ? `https://${companySettings.inkops_subdomain}.inkops.io/portal` : '') ||
                      `${supabaseUrl.replace('/v1', '')}/portal`;

    const setupLink = `${portalUrl}/login?token=${setupToken}&email=${encodeURIComponent(email)}`;

    const displayName = customerName || customer.customer_name || 'Valued Customer';

    // Build email HTML
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${companySettings.company_logo_primary_url ? `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${companySettings.company_logo_primary_url}" alt="${companySettings.company_name}" style="max-width: 200px; height: auto;">
          </div>
        ` : ''}

        <h2 style="color: #1f2937; margin-bottom: 20px;">Welcome to ${companySettings.company_name} Customer Portal</h2>

        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          Hi ${displayName},
        </p>

        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
          We're excited to give you access to your customer portal! Through the portal, you can:
        </p>

        <ul style="color: #4b5563; font-size: 16px; line-height: 1.8; padding-left: 20px;">
          <li>View and approve quotes</li>
          <li>Track your orders in real-time</li>
          <li>Review and approve proofs</li>
          <li>Access invoices and payment history</li>
          <li>Make secure online payments</li>
        </ul>

        <div style="margin: 30px 0; text-align: center;">
          <a href="${setupLink}"
             style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px;">
            Access Your Portal
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          This secure link will expire in 15 minutes. If you need a new link, simply click "Forgot Password" on the portal login page.
        </p>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          If you have any questions or need assistance, please don't hesitate to contact us.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          ${companySettings.company_name}
        </p>
      </div>
    `;

    // Check if Resend API key is configured
    if (!companySettings.resend_api_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured. Please set up Resend API key in company settings.",
          debug: { setupLink }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Decrypt the Resend API key
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

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Welcome to ${companySettings.company_name} Customer Portal`,
        html: emailBody,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    const emailResult = await emailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Welcome email sent successfully",
        emailId: emailResult.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error sending welcome email:", error);
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
