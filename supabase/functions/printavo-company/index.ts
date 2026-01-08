import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

async function decryptToken(encryptedToken: string, supabaseUrl: string, serviceRoleKey: string): Promise<string> {
  const response = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      action: 'decrypt',
      token: encryptedToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Decryption failed: ${error.error || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.result;
}

async function fetchAllStatuses(email: string, token: string): Promise<string[]> {
  const statusNames = new Set<string>();
  let hasNextPage = true;
  let cursor: string | null = null;
  let pageCount = 0;
  const maxPages = 50;

  while (hasNextPage && pageCount < maxPages) {
    const query = `
      query GetInvoicesForStatuses($after: String, $first: Int = 100) {
        invoices(after: $after, first: $first) {
          edges {
            node {
              id
              status {
                name
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const response = await fetch(PRINTAVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        email,
        token,
      },
      body: JSON.stringify({
        query,
        variables: { after: cursor },
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const invoices = data.data?.invoices?.edges || [];
    invoices.forEach((edge: any) => {
      const statusName = edge?.node?.status?.name;
      if (statusName) {
        statusNames.add(statusName);
      }
    });

    hasNextPage = data.data?.invoices?.pageInfo?.hasNextPage || false;
    cursor = data.data?.invoices?.pageInfo?.endCursor || null;
    pageCount++;
  }

  return Array.from(statusNames).sort();
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
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('printavo_username, printavo_api_token_encrypted')
      .maybeSingle();

    if (settingsError || !settings || !settings.printavo_username || !settings.printavo_api_token_encrypted) {
      return new Response(
        JSON.stringify({
          error: "Printavo credentials not configured",
          message: "Please configure Printavo credentials in Account Settings",
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

    const printavoEmail = settings.printavo_username;
    const printavoToken = await decryptToken(
      settings.printavo_api_token_encrypted,
      supabaseUrl,
      supabaseServiceRoleKey
    );

    const statuses = await fetchAllStatuses(printavoEmail, printavoToken);

    return new Response(
      JSON.stringify({
        success: true,
        statuses,
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