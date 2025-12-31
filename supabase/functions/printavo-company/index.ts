import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: credentials, error: credError } = await supabase
      .from("api_credentials")
      .select("credentials")
      .eq("service_name", "printavo")
      .maybeSingle();

    if (credError) {
      console.error("Error fetching credentials:", credError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch API credentials",
          message: credError.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!credentials) {
      return new Response(
        JSON.stringify({
          error: "Printavo credentials not configured",
          message: "Please configure Printavo API credentials in Account Settings",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const printavoEmail = credentials.credentials.email;
    const printavoToken = credentials.credentials.token;

    if (!printavoEmail || !printavoToken) {
      return new Response(
        JSON.stringify({
          error: "Invalid Printavo credentials",
          message: "Printavo email and token are required",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const query = `
      query GetCurrentAccount {
        currentAccount {
          id
          name
          subdomain
          createdAt
        }
      }
    `;

    const response = await fetch(PRINTAVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        email: printavoEmail,
        token: printavoToken,
      },
      body: JSON.stringify({
        query,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Printavo API error:', {
        status: response.status,
        data,
      });

      return new Response(
        JSON.stringify({
          error: 'Printavo API request failed',
          details: data,
          status: response.status,
        }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (data.errors && data.errors.length > 0) {
      console.error('GraphQL errors:', data.errors);
      return new Response(
        JSON.stringify({
          error: 'GraphQL query failed',
          details: data.errors,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        company: data.data?.currentAccount || null,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
