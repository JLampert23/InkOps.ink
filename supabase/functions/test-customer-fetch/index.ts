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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: integrationSettings, error: settingsError } = await supabase
      .from('integration_settings')
      .select('config, is_enabled')
      .eq('provider_name', 'printavo')
      .maybeSingle();

    if (settingsError) {
      throw new Error(`Failed to load Printavo settings: ${settingsError.message}`);
    }

    if (!integrationSettings?.is_enabled) {
      throw new Error('Printavo integration not enabled');
    }

    const config = integrationSettings.config as any;

    if (!config?.email || !config?.api_token) {
      throw new Error('Printavo credentials not configured');
    }

    const printavoEmail = config.email;
    const printavoToken = config.api_token;

    const customerQuery = `
      query GetCustomer($id: ID!) {
        customer(id: $id) {
          id
          companyName
          primaryContact {
            firstName
            lastName
            email
            phone
          }
          billingAddress {
            address1
            address2
            city
            state
            postalCode
            country
          }
          shippingAddress {
            address1
            address2
            city
            state
            postalCode
            country
          }
          contacts {
            edges {
              node {
                id
                fullName
                email
                phone
              }
            }
          }
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
        query: customerQuery,
        variables: { id: "8455168" },
      }),
    });

    const result = await response.json();

    return new Response(
      JSON.stringify(result, null, 2),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});