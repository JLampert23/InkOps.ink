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

async function getStripeConfig(): Promise<StripeConfig | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from('company_settings')
      .select('stripe_secret_key')
      .maybeSingle();
    
    if (error || !data?.stripe_secret_key) {
      console.error('No Stripe configuration found');
      return null;
    }
    
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
      console.error('Failed to decrypt Stripe secret key');
      return null;
    }
    
    const { result: secretKey } = await decryptResponse.json();
    
    return { secretKey };
  } catch (error) {
    console.error('Error getting Stripe config:', error);
    return null;
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
    const { action, data } = await req.json();
    
    const config = await getStripeConfig();
    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Stripe is not configured' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    switch (action) {
      case 'createPaymentLink': {
        const { amount, currency, metadata, customerEmail, description } = data;
        
        const priceResponse = await callStripeAPI(
          '/prices',
          'POST',
          config.secretKey,
          {
            unit_amount: amount,
            currency: currency || 'usd',
            'product_data[name]': description || 'Invoice Payment',
          }
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