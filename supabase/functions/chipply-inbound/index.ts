import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ChipplyEndpointSettings {
  auth_type: 'basic' | 'api_key';
  username: string;
  password: string;
  api_key: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse incoming payload
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract company_id from payload (assuming Chipply sends it, or we map it)
    // For now, we'll need to identify the company from the auth credentials
    // Since we're using Basic Auth or API Key, we need to fetch all companies' settings
    // and match against the provided credentials

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch all chipply endpoint settings from system_settings
    const { data: allSettings, error: settingsError } = await supabase
      .from('system_settings')
      .select('company_id, value')
      .eq('namespace', 'chipply')
      .eq('key', 'endpoint');

    if (settingsError || !allSettings || allSettings.length === 0) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'No Chipply integration configured' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Try to authenticate against each company's settings
    let authenticatedCompanyId: string | null = null;

    for (const setting of allSettings) {
      const config = setting.value as ChipplyEndpointSettings;

      if (config.auth_type === 'basic') {
        // Basic Auth format: "Basic base64(username:password)"
        if (authHeader.startsWith('Basic ')) {
          const base64Creds = authHeader.substring(6);
          const decoded = atob(base64Creds);
          const [username, password] = decoded.split(':');

          if (username === config.username && password === config.password) {
            authenticatedCompanyId = setting.company_id;
            break;
          }
        }
      } else if (config.auth_type === 'api_key') {
        // API Key format: "Bearer <api_key>" or just the key
        const providedKey = authHeader.startsWith('Bearer ')
          ? authHeader.substring(7)
          : authHeader;

        if (providedKey === config.api_key) {
          authenticatedCompanyId = setting.company_id;
          break;
        }
      }
    }

    if (!authenticatedCompanyId) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Successfully authenticated - log the import
    const { error: insertError } = await supabase
      .from('chipply_import_logs')
      .insert({
        company_id: authenticatedCompanyId,
        received_at: new Date().toISOString(),
        raw_json: payload,
        status: 'pending',
      });

    if (insertError) {
      console.error('Error inserting log:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to log import' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ status: 'received' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
