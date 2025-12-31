import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const printavoEmail = Deno.env.get("PRINTAVO_EMAIL");
    const printavoToken = Deno.env.get("PRINTAVO_TOKEN");

    if (!printavoEmail || !printavoToken) {
      return new Response(
        JSON.stringify({
          error: "Printavo credentials not configured",
          message: "Please configure PRINTAVO_EMAIL and PRINTAVO_TOKEN environment variables in your Supabase Edge Function settings",
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

    // Debug: Log sample of API response
    if (data?.data?.transactions?.edges?.[0]) {
      console.log('Sample transaction from Printavo API:', JSON.stringify(data.data.transactions.edges[0], null, 2));
    }

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