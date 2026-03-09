import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    const diagnostics: any = {
      step: "1-environment",
      environment: {
        supabaseUrl: supabaseUrl?.substring(0, 40) + "...",
        hasAnonKey: !!supabaseAnonKey,
        anonKeyLength: supabaseAnonKey?.length,
        anonKeyPrefix: supabaseAnonKey?.substring(0, 20)
      }
    };

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      diagnostics.step = "2-no-auth-header";
      return new Response(JSON.stringify(diagnostics), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = authHeader.replace("Bearer ", "");
    diagnostics.step = "3-token-received";
    diagnostics.token = {
      length: token.length,
      prefix: token.substring(0, 20),
      isServiceRole: token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    };

    if (!supabaseUrl || !supabaseAnonKey) {
      diagnostics.step = "4-missing-env-vars";
      return new Response(JSON.stringify(diagnostics), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    diagnostics.step = "5-attempting-validation";

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      diagnostics.step = "6-validation-failed";
      diagnostics.authError = {
        message: authError?.message,
        status: authError?.status,
        name: authError?.name,
        code: (authError as any)?.code
      };
      return new Response(JSON.stringify(diagnostics), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    diagnostics.step = "7-validation-success";
    diagnostics.user = {
      id: user.id,
      email: user.email
    };

    return new Response(JSON.stringify(diagnostics), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        step: "error",
        error: error.message,
        stack: error.stack
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
