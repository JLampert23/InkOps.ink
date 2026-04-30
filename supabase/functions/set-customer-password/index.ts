import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SetPasswordRequest {
  email: string;
  password: string;
  setupToken: string;
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

    const { email, password, setupToken } = await req.json() as SetPasswordRequest;

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!password || password.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: "Password must be at least 8 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!setupToken || !setupToken.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Setup token is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await supabase.rpc("set_customer_password", {
      p_email: email.toLowerCase().trim(),
      p_password_hash: passwordHash,
      p_setup_token: setupToken.trim()
    });

    if (result.error) {
      console.error("RPC error:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to set password" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = result.data as { success: boolean; error?: string; customer_id?: string; company_id?: string };

    if (!data.success) {
      return new Response(
        JSON.stringify({ success: false, error: data.error || "Failed to set password" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch full customer + branding so the frontend can build a session
    // and skip the second login step. Same shape as verify-magic-link.
    const { data: customer } = await supabase
      .from("customers")
      .select("id, email, contact_name, company_id")
      .eq("id", data.customer_id)
      .maybeSingle();

    const { data: branding } = await supabase
      .from("company_settings")
      .select("company_name, logo_url, company_logo_primary_url, company_address, company_phone, company_email, customer_url")
      .eq("id", data.company_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password has been set successfully",
        customer_id: data.customer_id,
        company_id: data.company_id,
        customer: customer ? {
          id: customer.id,
          email: customer.email,
          name: customer.contact_name,
          company_id: customer.company_id,
        } : null,
        branding: branding || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error setting password:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "An error occurred while setting your password"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
