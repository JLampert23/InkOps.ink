import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyDomainRequest {
  company_id: string;
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

    const { company_id } = await req.json() as VerifyDomainRequest;

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

    if (!customer_url || !customer_url_verification_token) {
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

    const domain = extractDomain(customer_url);

    let txtRecords: string[] = [];
    try {
      txtRecords = await resolveTxtRecords(domain);
    } catch (error) {
      console.error("DNS lookup error:", error);
      await supabase.rpc("mark_domain_verification_failed", { p_company_id: company_id });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unable to verify DNS records. Please ensure the TXT record is properly configured."
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

    if (verified) {
      await supabase.rpc("mark_domain_verified", { p_company_id: company_id });
      return new Response(
        JSON.stringify({
          success: true,
          message: "Domain verified successfully!"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      await supabase.rpc("mark_domain_verification_failed", { p_company_id: company_id });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Verification token not found in DNS TXT records. Please ensure you have added the correct TXT record and allow time for DNS propagation (up to 48 hours)."
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

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname;
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

async function resolveTxtRecords(domain: string): Promise<string[]> {
  try {
    const records = await Deno.resolveDns(domain, "TXT");
    return records.flat();
  } catch (error) {
    console.error("DNS resolution error:", error);
    throw error;
  }
}
