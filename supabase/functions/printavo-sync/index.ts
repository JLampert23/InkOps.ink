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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: settings, error: settingsError } = await supabase
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

    let allInvoices: any[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;
    let pageCount = 0;

    while (hasNextPage && pageCount < 100) {
      pageCount++;
      console.log(`Fetching page ${pageCount}${cursor ? ` after cursor ${cursor.slice(0, 20)}...` : ''}`);

      const invoicesResponse = await fetch(printavoProxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: settings.printavo_email,
          token: printavoToken,
          query: `
            query GetInvoices${cursor ? '($after: String!)' : ''} {
              invoices(first: 250${cursor ? ', after: $after' : ''}) {
                edges {
                  cursor
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
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          `,
          variables: cursor ? { after: cursor } : {}
        })
      });

      if (!invoicesResponse.ok) {
        throw new Error('Failed to fetch invoices from Printavo');
      }

      const invoicesData = await invoicesResponse.json();
      const edges = invoicesData?.data?.invoices?.edges || [];
      const pageInfo = invoicesData?.data?.invoices?.pageInfo || {};

      const pageInvoices = edges.map((edge: any) => edge.node);
      allInvoices = allInvoices.concat(pageInvoices);

      hasNextPage = pageInfo.hasNextPage === true;
      cursor = pageInfo.endCursor || null;

      console.log(`Fetched ${pageInvoices.length} invoices (total so far: ${allInvoices.length})`);

      if (!hasNextPage) {
        console.log('Reached last page');
        break;
      }
    }

    const invoices = allInvoices;

    const { error: deleteError } = await supabase
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

      const { error: insertError } = await supabase
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