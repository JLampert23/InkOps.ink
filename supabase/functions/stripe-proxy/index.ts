import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

interface StripeConfig {
  secretKey: string;
}

async function getStripeConfig(userId: string): Promise<StripeConfig | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Database error fetching user profile:', profileError);
      throw new Error(`Database error: ${profileError.message}`);
    }

    if (!profileData?.company_id) {
      console.error('No company_id found for user:', userId);
      throw new Error('User profile not properly configured');
    }

    console.log('Fetching Stripe config for company:', profileData.company_id);

    const { data, error } = await supabase
      .from('company_settings')
      .select('stripe_secret_key')
      .eq('id', profileData.company_id)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching Stripe config:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data?.stripe_secret_key) {
      console.error('No Stripe configuration found in database');
      throw new Error('Stripe secret key not configured. Please add your credentials in Settings.');
    }

    console.log('Attempting to decrypt Stripe key...');
    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        token: data.stripe_secret_key,
      }),
    });

    if (!decryptResponse.ok) {
      const errorText = await decryptResponse.text();
      console.error('Decryption failed:', errorText);
      throw new Error(`Failed to decrypt Stripe key: ${errorText}`);
    }

    const decryptResult = await decryptResponse.json();
    if (!decryptResult.success || !decryptResult.result) {
      console.error('Decryption returned invalid result:', decryptResult);
      throw new Error('Decryption failed: Invalid response from crypto service');
    }

    const secretKey = decryptResult.result;
    console.log('Stripe key decrypted successfully');

    return { secretKey };
  } catch (error) {
    console.error('Error getting Stripe config:', error);
    throw error;
  }
}

async function callStripeAPI(
  endpoint: string,
  method: string,
  secretKey: string,
  body?: any
): Promise<Response> {
  const url = `https://api.stripe.com/v1${endpoint}`;

  const headers: HeadersInit = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    const params = new URLSearchParams();
    Object.keys(body).forEach(key => {
      if (typeof body[key] === 'object' && body[key] !== null) {
        Object.keys(body[key]).forEach(subKey => {
          params.append(`${key}[${subKey}]`, body[key][subKey]);
        });
      } else {
        params.append(key, body[key]);
      }
    });
    options.body = params;
  }

  return await fetch(url, options);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('=== JWT VALIDATION DEBUG ===');
    console.log('Token length:', token.length);
    console.log('Token prefix:', token.substring(0, 20) + '...');
    console.log('Supabase URL:', supabaseUrl);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    console.log('Auth result:', {
      hasUser: !!user,
      hasError: !!authError,
      errorMessage: authError?.message,
      errorStatus: authError?.status,
      errorName: authError?.name,
    });

    if (authError || !user) {
      console.error('=== AUTH VALIDATION FAILED ===');
      console.error('Full error object:', JSON.stringify(authError, null, 2));
      return new Response(
        JSON.stringify({
          code: 401,
          message: 'Invalid JWT',
          details: authError?.message || 'User not found'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('User authenticated:', user.email);

    const { action, data } = await req.json();

    const adminOnlyActions = ['testConnection', 'getBalance', 'createRefund'];

    if (adminOnlyActions.includes(action)) {
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_user_role', { user_id: user.id });

      if (roleError || roleData !== 'super_admin') {
        return new Response(
          JSON.stringify({ error: "Access denied. Super Admin role required." }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const config = await getStripeConfig(user.id);

    switch (action) {
      case 'testConnection': {
        console.log('Testing Stripe connection, key starts with:', config.secretKey.substring(0, 8));

        const balanceResponse = await callStripeAPI(
          '/balance',
          'GET',
          config.secretKey
        );

        if (!balanceResponse.ok) {
          const error = await balanceResponse.json();
          console.error('Stripe API error:', error);
          return new Response(
            JSON.stringify({
              success: false,
              error: error.error?.message || 'Failed to connect to Stripe',
              details: error.error?.type || 'unknown_error',
              statusCode: balanceResponse.status
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const balance = await balanceResponse.json();

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Successfully connected to Stripe!',
            balance: {
              available: (balance.available?.[0]?.amount || 0) / 100,
              pending: (balance.pending?.[0]?.amount || 0) / 100,
              currency: balance.available?.[0]?.currency || 'usd',
            },
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'createPaymentLink': {
        const { amount, currency, metadata, customerEmail, description, minimumAmount } = data;

        // Two modes:
        //   1. Fixed amount (legacy): caller sends `amount`. Customer pays
        //      exactly that amount.
        //   2. Customer-chooses amount with minimum (T3-A, 2026-05-09):
        //      caller sends `minimumAmount`. Stripe shows a custom-amount
        //      input on the payment page with that minimum enforced.
        //      `amount` (if also sent) is used as the preset/default
        //      shown in the input.
        const priceFields: Record<string, any> = {
          currency: currency || 'usd',
          'product_data[name]': description || 'Invoice Payment',
        };

        if (typeof minimumAmount === 'number' && minimumAmount > 0) {
          // Customer-chosen amount with floor. Stripe expects amounts in
          // the smallest currency unit (cents for USD).
          priceFields['custom_unit_amount[enabled]'] = 'true';
          priceFields['custom_unit_amount[minimum]'] = minimumAmount;
          if (typeof amount === 'number' && amount >= minimumAmount) {
            priceFields['custom_unit_amount[preset]'] = amount;
          } else {
            priceFields['custom_unit_amount[preset]'] = minimumAmount;
          }
        } else {
          priceFields['unit_amount'] = amount;
        }

        const priceResponse = await callStripeAPI(
          '/prices',
          'POST',
          config.secretKey,
          priceFields
        );

        if (!priceResponse.ok) {
          const error = await priceResponse.json();
          throw new Error(error.error?.message || 'Failed to create price');
        }

        const price = await priceResponse.json();

        const paymentLinkBody: any = {
          'line_items[0][price]': price.id,
          'line_items[0][quantity]': 1,
        };

        if (metadata) {
          Object.keys(metadata).forEach(key => {
            paymentLinkBody[`metadata[${key}]`] = metadata[key];
          });
        }

        if (customerEmail) {
          paymentLinkBody['customer_creation'] = 'always';
        }

        const linkResponse = await callStripeAPI(
          '/payment_links',
          'POST',
          config.secretKey,
          paymentLinkBody
        );

        if (!linkResponse.ok) {
          const error = await linkResponse.json();
          throw new Error(error.error?.message || 'Failed to create payment link');
        }

        const paymentLink = await linkResponse.json();

        return new Response(
          JSON.stringify({
            paymentLinkId: paymentLink.id,
            url: paymentLink.url,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'getBalance': {
        const balanceResponse = await callStripeAPI(
          '/balance',
          'GET',
          config.secretKey
        );

        if (!balanceResponse.ok) {
          throw new Error('Failed to fetch balance');
        }

        const balance = await balanceResponse.json();

        return new Response(
          JSON.stringify(balance),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'createRefund': {
        const { paymentId, amount, reason } = data;

        const refundBody: any = {
          payment_intent: paymentId,
        };

        if (amount) refundBody.amount = amount;
        if (reason) refundBody.reason = reason;

        const refundResponse = await callStripeAPI(
          '/refunds',
          'POST',
          config.secretKey,
          refundBody
        );

        if (!refundResponse.ok) {
          const error = await refundResponse.json();
          throw new Error(error.error?.message || 'Failed to create refund');
        }

        const refund = await refundResponse.json();

        return new Response(
          JSON.stringify(refund),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'createInvoiceWithMinimumDue': {
        const { totalAmount, minimumDue, currency, customerEmail, customerName, description, metadata } = data;

        let customerId = null;

        if (customerEmail) {
          const customerSearchResponse = await callStripeAPI(
            `/customers/search?query=email:'${customerEmail}'`,
            'GET',
            config.secretKey
          );

          if (customerSearchResponse.ok) {
            const customerSearch = await customerSearchResponse.json();
            if (customerSearch.data && customerSearch.data.length > 0) {
              customerId = customerSearch.data[0].id;
            }
          }

          if (!customerId) {
            const customerBody: any = {
              email: customerEmail,
            };
            if (customerName) customerBody.name = customerName;

            const customerResponse = await callStripeAPI(
              '/customers',
              'POST',
              config.secretKey,
              customerBody
            );

            if (!customerResponse.ok) {
              const error = await customerResponse.json();
              throw new Error(error.error?.message || 'Failed to create customer');
            }

            const customer = await customerResponse.json();
            customerId = customer.id;
          }
        }

        const invoiceBody: any = {
          auto_advance: false,
          collection_method: 'send_invoice',
          days_until_due: 30,
          pending_invoice_items_behavior: 'exclude', // Allow empty invoice creation; items added below
        };

        if (customerId) {
          invoiceBody.customer = customerId;
        }

        if (metadata) {
          Object.keys(metadata).forEach(key => {
            invoiceBody[`metadata[${key}]`] = metadata[key];
          });
        }

        const invoiceResponse = await callStripeAPI(
          '/invoices',
          'POST',
          config.secretKey,
          invoiceBody
        );

        if (!invoiceResponse.ok) {
          const error = await invoiceResponse.json();
          throw new Error(error.error?.message || 'Failed to create invoice');
        }

        const invoice = await invoiceResponse.json();

        const invoiceItemBody: any = {
          customer: customerId,
          invoice: invoice.id,
          amount: totalAmount,
          currency: currency || 'usd',
          description: description || 'Invoice Payment',
        };

        const itemResponse = await callStripeAPI(
          '/invoiceitems',
          'POST',
          config.secretKey,
          invoiceItemBody
        );

        if (!itemResponse.ok) {
          const error = await itemResponse.json();
          throw new Error(error.error?.message || 'Failed to add item to invoice');
        }

        const finalizeResponse = await callStripeAPI(
          `/invoices/${invoice.id}/finalize`,
          'POST',
          config.secretKey,
          { auto_advance: true }
        );

        if (!finalizeResponse.ok) {
          const error = await finalizeResponse.json();
          throw new Error(error.error?.message || 'Failed to finalize invoice');
        }

        const finalInvoice = await finalizeResponse.json();

        return new Response(
          JSON.stringify({
            invoiceId: finalInvoice.id,
            customerId: customerId,
            hostedInvoiceUrl: finalInvoice.hosted_invoice_url,
            invoicePdfUrl: finalInvoice.invoice_pdf,
            status: finalInvoice.status,
            amountDue: finalInvoice.amount_due,
            amountPaid: finalInvoice.amount_paid,
            minimumDue: minimumDue,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'getInvoice': {
        const { invoiceId } = data;

        const invoiceResponse = await callStripeAPI(
          `/invoices/${invoiceId}`,
          'GET',
          config.secretKey
        );

        if (!invoiceResponse.ok) {
          const error = await invoiceResponse.json();
          throw new Error(error.error?.message || 'Failed to fetch invoice');
        }

        const invoice = await invoiceResponse.json();

        return new Response(
          JSON.stringify({
            invoiceId: invoice.id,
            status: invoice.status,
            amountDue: invoice.amount_due,
            amountPaid: invoice.amount_paid,
            amountRemaining: invoice.amount_remaining,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            invoicePdfUrl: invoice.invoice_pdf,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'voidInvoice': {
        const { invoiceId } = data;

        const voidResponse = await callStripeAPI(
          `/invoices/${invoiceId}/void`,
          'POST',
          config.secretKey,
          {}
        );

        if (!voidResponse.ok) {
          const error = await voidResponse.json();
          throw new Error(error.error?.message || 'Failed to void invoice');
        }

        const invoice = await voidResponse.json();

        return new Response(
          JSON.stringify({
            invoiceId: invoice.id,
            status: invoice.status,
            message: 'Invoice voided successfully',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
    }
  } catch (error) {
    console.error('Stripe proxy error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
