import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendMagicLinkRequest {
  email: string;
}

// 2026-06-11 [3.2-3] — "LINKS NEED TO BE SPECIFIC AND CORRECT" (Jamie).
//
// Previous behaviour called create_portal_session(p_email), whose
// `WHERE LOWER(email) = LOWER(p_email) LIMIT 1` lookup silently picked an
// arbitrary customer when two customers shared an email, and missed
// customers whose email lives only on the primary contact. Same class of
// bug as the welcome-email one fixed in 3.1.
//
// New behaviour:
//   1. Resolve ALL matching customers — by customers.email AND by
//      customer_contacts.email (case-insensitive, deduped).
//   2. Create a session per customer via create_portal_session_by_customer_id
//      (the deterministic by-id RPC from migration 20260430120000).
//   3. Group by company and send one branded email per company, with one
//      sign-in button per matching customer account. The common case (one
//      match) renders identically to the old email.
// Secure by construction: links only ever go to the inbox that was typed.

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // --- 1. Resolve every customer this email can belong to -------------
    const matchedIds = new Set<string>();

    const { data: directMatches } = await supabase
      .from("customers")
      .select("id")
      .ilike("email", normalizedEmail);
    (directMatches || []).forEach((c: any) => matchedIds.add(c.id));

    const { data: contactMatches } = await supabase
      .from("customer_contacts")
      .select("customer_id")
      .ilike("email", normalizedEmail);
    (contactMatches || []).forEach((c: any) => {
      if (c.customer_id) matchedIds.add(c.customer_id);
    });

    if (matchedIds.size === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Customer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- 2. Create a deterministic by-id session per customer -----------
    interface SessionInfo {
      customerId: string;
      companyId: string;
      magicToken: string;
      companyName?: string;
    }
    const sessions: SessionInfo[] = [];

    for (const customerId of matchedIds) {
      const result = await supabase.rpc("create_portal_session_by_customer_id", {
        p_customer_id: customerId,
      });
      if (result.error) {
        console.error(`Session RPC failed for customer ${customerId}:`, result.error);
        continue;
      }
      const data = result.data as any;
      if (data?.success && data.token && data.company_id) {
        sessions.push({
          customerId,
          companyId: data.company_id,
          magicToken: data.token,
        });
      }
    }

    if (sessions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Customer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Friendly account names for the buttons (multi-account case).
    const { data: customerRows } = await supabase
      .from("customers")
      .select("id, company_name")
      .in("id", sessions.map((s) => s.customerId));
    const customerNameById = new Map<string, string>(
      (customerRows || []).map((c: any) => [c.id, c.company_name || "Your account"])
    );

    // --- 3. One branded email per company --------------------------------
    const byCompany = new Map<string, SessionInfo[]>();
    for (const s of sessions) {
      if (!byCompany.has(s.companyId)) byCompany.set(s.companyId, []);
      byCompany.get(s.companyId)!.push(s);
    }

    let anySent = false;

    for (const [companyId, companySessions] of byCompany) {
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("company_name, inkops_subdomain, email_from_address, resend_api_key")
        .eq("id", companyId)
        .maybeSingle();

      if (!companySettings) {
        console.error(`Company settings not found for ${companyId} — skipping`);
        continue;
      }
      if (!companySettings.resend_api_key) {
        console.error(`No resend key for company ${companyId} — skipping`);
        continue;
      }

      // Always use inkops.ink subdomain for portal URLs
      let subdomain = companySettings.inkops_subdomain;
      if (!subdomain && companySettings.company_name) {
        subdomain = companySettings.company_name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 30);
      }
      const baseUrl = subdomain ? `https://${subdomain}.inkops.ink` : "https://inkops.ink";

      const buttonsHtml = companySessions.map((s) => {
        const magicLink = `${baseUrl}/customer/${s.customerId}?token=${s.magicToken}`;
        const label = companySessions.length > 1
          ? `Sign In as ${customerNameById.get(s.customerId) || "Your account"}`
          : "Sign In to Portal";
        return `
        <div style="margin: 16px 0;">
          <a href="${magicLink}"
             style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            ${label}
          </a>
        </div>`;
      }).join("");

      const multiNote = companySessions.length > 1
        ? `<p style="color: #4b5563; font-size: 14px;">This email is linked to ${companySessions.length} accounts — choose the one you want to sign in to:</p>`
        : "";

      const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Sign in to ${companySettings.company_name} Customer Portal</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.5;">
          Click below to securely sign in to your customer portal:
        </p>
        ${multiNote}
        ${buttonsHtml}
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

      const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          action: "decrypt",
          token: companySettings.resend_api_key,
        }),
      });

      if (!decryptResponse.ok) {
        console.error(`Failed to decrypt API key for company ${companyId}`);
        continue;
      }

      const { result: resendApiKey } = await decryptResponse.json();
      const fromEmail = companySettings.email_from_address || "noreply@inkops.com";

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
        continue;
      }

      anySent = true;
    }

    if (!anySent) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured. Please contact support.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Magic link sent! Check your email." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending magic link:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
