import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

const requestQueue: Array<() => Promise<void>> = [];
let requestCount = 0;
let windowStart = Date.now();

const RATE_LIMIT = 10;
const WINDOW_MS = 5000;

async function rateLimitedFetch(
  url: string,
  options: RequestInit
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      try {
        const now = Date.now();
        if (now - windowStart >= WINDOW_MS) {
          requestCount = 0;
          windowStart = now;
        }

        if (requestCount >= RATE_LIMIT) {
          const waitTime = WINDOW_MS - (now - windowStart);
          await new Promise((r) => setTimeout(r, waitTime));
          requestCount = 0;
          windowStart = Date.now();
        }

        requestCount++;
        const response = await fetch(url, options);
        resolve(response);
      } catch (error) {
        reject(error);
      }
    };

    requestQueue.push(execute);
    if (requestQueue.length === 1) {
      execute();
    }
  });
}

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
      .select('config, is_enabled, company_id')
      .eq('provider_name', 'printavo')
      .maybeSingle();

    if (settingsError) {
      return new Response(
        JSON.stringify({
          error: "Failed to load Printavo settings",
          message: settingsError.message,
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

    if (!integrationSettings?.is_enabled) {
      return new Response(
        JSON.stringify({
          error: "Printavo integration not enabled",
          message: "Please enable and configure Printavo credentials in Account Settings",
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

    const config = integrationSettings.config as any;

    if (!config?.email || !config?.api_token) {
      return new Response(
        JSON.stringify({
          error: "Printavo credentials not configured",
          message: "Please configure Printavo email and API token in Account Settings",
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

    const printavoEmail = config.email;
    const printavoToken = config.api_token;

    const body: GraphQLRequest = await req.json();

    const response = await rateLimitedFetch(PRINTAVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        email: printavoEmail,
        token: printavoToken,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Printavo API error:', {
        status: response.status,
        statusText: response.statusText,
        data,
      });

      return new Response(
        JSON.stringify({
          error: 'Printavo API request failed',
          details: data,
          status: response.status,
          message: data.error || data.message || 'Invalid API credentials or request',
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
          message: data.errors[0].message || 'GraphQL query error',
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

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
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