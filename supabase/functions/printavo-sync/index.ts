import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const jwt = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('company_settings')
      .select('printavo_email, printavo_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError || !settings?.printavo_email || !settings?.printavo_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Printavo credentials not configured'
        }),
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
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        data: settings.printavo_token
      })
    });

    if (!decryptResponse.ok) {
      throw new Error('Failed to decrypt Printavo token');
    }

    const { result: printavoToken } = await decryptResponse.json();

    const printavoProxyUrl = `${supabaseUrl}/functions/v1/printavo-proxy`;
    const invoicesResponse = await fetch(printavoProxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        email: settings.printavo_email,
        token: printavoToken,
        query: `
          query GetInvoices {
            invoices(first: 1000) {
              edges {
                node {
                  id
                  visualId
                  invoiceAt
                  createdAt
                  dueAt
                  total
                  amountPaid
                  amountOutstanding
                  paidInFull
                  status
                  contact {
                    id
                    fullName
                    customer {
                      id
                      companyName
                    }
                  }
                }
              }
            }
          }
        `
      })
    });

    if (!invoicesResponse.ok) {
      throw new Error('Failed to fetch invoices from Printavo');
    }

    const invoicesData = await invoicesResponse.json();
    const invoices = invoicesData?.data?.invoices?.edges?.map((edge: any) => edge.node) || [];

    const { error: deleteError } = await supabaseAdmin
      .from('printavo_invoices_raw')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting old invoices:', deleteError);
    }

    if (invoices.length > 0) {
      const invoicesToInsert = invoices.map((invoice: any) => ({
        user_id: user.id,
        invoice_id: invoice.id,
        data: invoice,
        synced_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabaseAdmin
        .from('printavo_invoices_raw')
        .insert(invoicesToInsert);

      if (insertError) {
        throw new Error(`Failed to save invoices: ${insertError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoiceCount: invoices.length,
        message: `Successfully synced ${invoices.length} invoices`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});