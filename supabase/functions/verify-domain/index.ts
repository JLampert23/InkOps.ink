import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyDomainRequest {
  company_id: string;
  domain?: string;
}

function normalizeDomain(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  let domain = input.trim().toLowerCase();

  try {
    const urlObj = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
    domain = urlObj.hostname;
  } catch {
    domain = domain.replace(/^https?:\/\//, '').split('/')[0];
  }

  domain = domain.replace(/^www\./, '');
  domain = domain.replace(/\.+$/, '');

  if (!domain.includes('.') || domain.length < 4) {
    return null;
  }

  return domain;
}

async function resolveTxtRecords(domain: string): Promise<string[]> {
  console.log("Performing DNS TXT lookup for domain:", domain);

  try {
    const records = await Deno.resolveDns(domain, "TXT");
    const flatRecords = records.flat();
    console.log("TXT records found:", flatRecords);
    return flatRecords;
  } catch (error) {
    console.error("DNS lookup failed for domain:", domain, "Error:", error);
    throw error;
  }
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as VerifyDomainRequest;
    const { company_id, domain: requestDomain } = body;

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "Missing company_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: companySettings, error: companyError } = await supabase
      .from("company_settings")
      .select("customer_url, customer_url_verification_token, customer_url_verification_expires_at")
      .eq("id", company_id)
      .maybeSingle();

    if (companyError || !companySettings) {
      return new Response(
        JSON.stringify({ error: "Company settings not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { customer_url, customer_url_verification_token, customer_url_verification_expires_at } = companySettings;

    if (!customer_url_verification_token) {
      return new Response(
        JSON.stringify({ error: "No domain verification in progress" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (customer_url_verification_expires_at) {
      const expiresAt = new Date(customer_url_verification_expires_at);
      if (expiresAt < new Date()) {
        await supabase.rpc("mark_domain_verification_failed", { p_company_id: company_id });
        return new Response(
          JSON.stringify({
            success: false,
            error: "Verification token has expired. Please request a new token."
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    const domainToVerify = requestDomain || customer_url;

    if (!domainToVerify) {
      return new Response(
        JSON.stringify({ error: "No domain provided for verification" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalizedDomain = normalizeDomain(domainToVerify);

    if (!normalizedDomain) {
      return new Response(
        JSON.stringify({
          error: "Invalid domain format. Please provide a valid domain (e.g., example.com)",
          provided_value: domainToVerify
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Verifying domain:", normalizedDomain);
    console.log("Looking for verification token:", customer_url_verification_token);

    let txtRecords: string[] = [];
    try {
      txtRecords = await resolveTxtRecords(normalizedDomain);
    } catch (error) {
      console.error("DNS lookup error for domain:", normalizedDomain, "Error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unable to look up DNS records for ${normalizedDomain}. Please ensure your domain is correctly configured and try again in a few minutes.`,
          details: "DNS lookup failed - this may be a temporary issue",
          domain_checked: normalizedDomain
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (txtRecords.length === 0) {
      console.log("No TXT records found for domain:", normalizedDomain);
      return new Response(
        JSON.stringify({
          success: false,
          error: `No TXT records found for ${normalizedDomain}. Please add a TXT record with the verification token.`,
          domain_checked: normalizedDomain
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const verified = txtRecords.some(record =>
      record.includes(customer_url_verification_token)
    );

    console.log(`Verification result for ${normalizedDomain}: ${verified ? 'SUCCESS' : 'TOKEN NOT FOUND'}`);

    if (verified) {
      await supabase.rpc("mark_domain_verified", { p_company_id: company_id });
      return new Response(
        JSON.stringify({
          success: true,
          message: "Domain verified successfully!",
          domain: normalizedDomain
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: `TXT record not found for ${normalizedDomain}. Please add a TXT record with host "@" and the verification token as the value. DNS changes can take up to 48 hours to propagate.`,
          found_records: txtRecords.length,
          domain_checked: normalizedDomain
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("Error verifying domain:", error);
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
