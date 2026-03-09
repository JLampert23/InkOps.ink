import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
    };

    // Get the user's JWT token from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's token to verify auth
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get the user using the token from headers
    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'User not authenticated', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    diagnostics.userId = user.id;

    // Use service role client to get user's company_id
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userProfile, error: profileError } = await serviceSupabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !userProfile?.company_id) {
      console.error('Failed to get user company_id:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'User company not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = userProfile.company_id;
    diagnostics.companyId = companyId;

    // Get Printavo integration settings
    const { data: integrationSettings, error: settingsError } = await serviceSupabase
      .from('integration_settings')
      .select('config, is_enabled')
      .eq('company_id', companyId)
      .eq('provider_name', 'printavo')
      .maybeSingle();

    diagnostics.settingsFound = !!integrationSettings;
    diagnostics.isEnabled = integrationSettings?.is_enabled;

    if (settingsError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to load Printavo settings",
          details: settingsError.message,
          diagnostics,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!integrationSettings?.is_enabled) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Printavo integration not enabled",
          diagnostics,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const config = integrationSettings.config as any;

    diagnostics.emailSet = !!config?.email;
    diagnostics.tokenSet = !!config?.api_token;

    if (!config?.email || !config?.api_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Printavo credentials incomplete. Please configure email and API token in Account Settings.",
          diagnostics,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const printavoEmail = config.email;
    const printavoToken = config.api_token;

    diagnostics.tokenLength = printavoToken.length;
    diagnostics.tokenPreview = printavoToken.substring(0, 4) + "..." + printavoToken.substring(printavoToken.length - 4);

    const url = new URL(req.url);
    const testType = url.searchParams.get('test') || 'customer';
    const customerId = url.searchParams.get('customer_id') || '8455168';

    let testQuery = '';
    let variables: any = {};

    if (testType === 'invoice') {
      testQuery = `
        query TestInvoice {
          invoices(first: 1) {
            edges {
              node {
                id
                visualId
                billingAddress {
                  address1
                  city
                  state
                  zip
                }
              }
            }
          }
        }
      `;
    } else {
      testQuery = `
        query TestCustomer($id: ID!) {
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
              country
            }
            shippingAddress {
              address1
              address2
              city
              state
              country
            }
            contacts {
              edges {
                node {
                  id
                  fullName
                  firstName
                  lastName
                  email
                  phone
                }
              }
            }
          }
        }
      `;
      variables = { id: customerId };
    }

    const response = await fetch("https://www.printavo.com/api/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        email: printavoEmail,
        token: printavoToken,
      },
      body: JSON.stringify({
        query: testQuery,
        variables
      }),
    });

    diagnostics.printavoResponseStatus = response.status;

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 'unknown';
      diagnostics.retryAfter = retryAfter;

      return new Response(
        JSON.stringify({
          success: false,
          error: "Rate limit exceeded",
          printavoError: `Printavo API rate limit exceeded. Please wait before trying again.${retryAfter !== 'unknown' ? ` Retry after: ${retryAfter} seconds` : ''}`,
          diagnostics,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await response.json();
    diagnostics.printavoResponseHasErrors = !!result.errors;

    if (!response.ok || result.errors) {
      let errorMessage = "Unknown error";

      // Try to extract a meaningful error message
      if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
        errorMessage = result.errors[0].message;
      } else if (result.error) {
        errorMessage = result.error;
      } else if (result.message) {
        errorMessage = result.message;
      }

      // Map HTTP status codes to friendly messages
      if (response.status === 401) {
        errorMessage = "Invalid Printavo credentials. Please check your username and API token.";
      } else if (response.status === 403) {
        errorMessage = "Access denied. Please check your Printavo API token permissions.";
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Printavo API authentication failed",
          printavoError: errorMessage,
          fullErrors: result.errors,
          diagnostics,
        }),
        {
          status: response.status === 401 || response.status === 403 ? response.status : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const responseData: any = {
      success: true,
      testType,
      fullResponse: result,
      diagnostics,
    };

    if (testType === 'invoice') {
      const invoice = result.data?.invoices?.edges?.[0]?.node;
      responseData.message = 'Invoice address test';
      responseData.invoice = invoice;
      responseData.billingAddress = invoice?.billingAddress;
    } else {
      responseData.message = `Data for customer ID ${customerId}`;
      responseData.customer = result.data?.customer || null;
      responseData.billingAddress = result.data?.customer?.billingAddress || null;
      responseData.shippingAddress = result.data?.customer?.shippingAddress || null;
      responseData.contacts = result.data?.customer?.contacts?.edges?.map((e: any) => e.node) || [];
      responseData.hasBillingAddress = !!(result.data?.customer?.billingAddress?.address1 || result.data?.customer?.billingAddress?.city);
      responseData.hasShippingAddress = !!(result.data?.customer?.shippingAddress?.address1 || result.data?.customer?.shippingAddress?.city);
      responseData.hasPhone = result.data?.customer?.contacts?.edges?.some((e: any) => e.node?.phone) || false;
    }

    return new Response(
      JSON.stringify(responseData, null, 2),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});