import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SquareRequest {
  endpoint: string;
  method?: string;
  body?: any;
  params?: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found', details: profileError?.message }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (userProfile.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: "Access denied. Super Admin role required." }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('company_settings')
      .select('square_access_token, square_environment, square_location_id')
      .eq('id', userProfile.company_id)
      .maybeSingle();

    if (settingsError || !settings || !settings.square_access_token) {
      return new Response(
        JSON.stringify({ error: 'Square credentials not configured. Please add them in Account Settings.', details: settingsError?.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cryptoServiceUrl = `${supabaseUrl}/functions/v1/crypto-service`;
    const decryptResponse = await fetch(cryptoServiceUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'decrypt',
        token: settings.square_access_token,
      }),
    });

    if (!decryptResponse.ok) {
      const errorData = await decryptResponse.json();
      return new Response(
        JSON.stringify({ error: 'Failed to decrypt Square credentials', details: errorData }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { result } = await decryptResponse.json();
    const accessToken = result;

    const requestData: SquareRequest = await req.json();
    const { endpoint, method = 'GET', body, params } = requestData;

    const squareBaseUrl = settings.square_environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';

    let squareUrl = `${squareBaseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      squareUrl += `?${searchParams.toString()}`;
    }

    const squareResponse = await fetch(squareUrl, {
      method,
      headers: {
        'Square-Version': '2024-12-18',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseData = await squareResponse.json();

    if (!squareResponse.ok) {
      return new Response(
        JSON.stringify({
          error: 'Square API error',
          details: responseData,
          status: squareResponse.status
        }),
        {
          status: squareResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    console.error('Error in square-proxy:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Internal server error',
        details: err instanceof Error ? err.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
