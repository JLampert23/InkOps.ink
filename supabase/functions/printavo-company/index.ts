import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

interface PrintavoStatus {
  id: string;
  name: string;
  color: string | null;
  position: number;
  type: string | null;
}

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

async function fetchAllStatuses(email: string, token: string): Promise<PrintavoStatus[]> {
  const query = `
    query GetAllStatuses {
      statuses {
        nodes {
          id
          name
          color
          position
          type
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
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Printavo API request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.errors && data.errors.length > 0) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  return data.data?.statuses?.nodes || [];
}

async function syncStatusesToDatabase(
  supabase: any,
  statuses: PrintavoStatus[]
): Promise<void> {
  const { data: existingStatuses } = await supabase
    .from('printavo_statuses')
    .select('id, is_billing_eligible');

  const existingMap = new Map(
    (existingStatuses || []).map((s: any) => [s.id, s.is_billing_eligible])
  );

  for (const status of statuses) {
    const existingBillingEligible = existingMap.get(status.id);
    
    await supabase
      .from('printavo_statuses')
      .upsert({
        id: status.id,
        name: status.name,
        color: status.color,
        position: status.position,
        type: status.type,
        is_billing_eligible: existingBillingEligible ?? false,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    console.log('Auth header received:', authHeader ? `Bearer ${authHeader.substring(0, 20)}...` : 'MISSING');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: { Authorization: authHeader },
      },
    });

    console.log('Attempting to verify user...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    console.log('Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      errorMessage: userError?.message,
      errorCode: userError?.status
    });

    if (userError || !user) {
      console.error('Auth error details:', {
        message: userError?.message,
        status: userError?.status,
        name: userError?.name
      });
      return new Response(
        JSON.stringify({
          code: 401,
          message: "Invalid JWT",
          error: userError?.message || "Unauthorized",
          details: userError
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: roleData, error: roleError } = await supabase
      .rpc('get_user_role', { user_id: user.id });

    if (roleError || roleData !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: "Access denied. Super Admin role required." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('printavo_username, printavo_api_token_encrypted')
      .maybeSingle();

    if (settingsError) {
      console.error('Settings error:', settingsError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch company settings",
          details: settingsError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!settings || !settings.printavo_username || !settings.printavo_api_token_encrypted) {
      return new Response(
        JSON.stringify({
          error: "Printavo credentials not configured",
          message: "Please configure Printavo credentials in Account Settings",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    await syncStatusesToDatabase(supabase, statuses);

    const statusNames = statuses.map(s => s.name).sort();

    return new Response(
      JSON.stringify({
        success: true,
        statuses: statusNames,
        fullStatuses: statuses,
        count: statuses.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});