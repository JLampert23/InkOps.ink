import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyPasswordRequest {
  email: string;
  password: string;
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

    const { email, password } = await req.json() as VerifyPasswordRequest;

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Email is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ success: false, error: "Password is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await supabase.rpc("verify_customer_password_hash", {
      p_email: email.toLowerCase().trim(),
      p_password_hash: ""
    });

    if (result.error) {
      console.error("RPC error:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email or password" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = result.data as {
      success: boolean;
      requiresSetup?: boolean;
      error?: string;
      customer?: {
        id: string;
        email: string;
        name: string;
        company_id: string;
        stored_hash: string;
      };
      branding?: {
        company_name: string;
        logo_url: string | null;
        company_logo_primary_url: string | null;
        company_address: string | null;
        company_phone: string | null;
        company_email: string | null;
        customer_url: string | null;
      };
    };

    if (!data.success) {
      return new Response(
        JSON.stringify({
          success: false,
          requiresSetup: data.requiresSetup,
          error: data.error || "Invalid email or password"
        }),
        {
          status: data.requiresSetup ? 200 : 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!data.customer?.stored_hash) {
      return new Response(
        JSON.stringify({
          success: false,
          requiresSetup: true,
          error: "Password not set. Please set up your password first."
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const passwordMatch = await bcrypt.compare(password, data.customer.stored_hash);

    if (!passwordMatch) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email or password" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        customer: {
          id: data.customer.id,
          email: data.customer.email,
          name: data.customer.name,
          company_id: data.customer.company_id
        },
        branding: data.branding
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error verifying password:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "An error occurred. Please try again."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
