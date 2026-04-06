import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const masterStripeKey = Deno.env.get('STRIPE_SECRET_KEY') || '';

const TIER_CONFIG = {
  starter: {
    name: 'InkOps Starter',
    description: 'Core quoting, invoicing, and production tracking for growing print shops.',
    amount: 19900, // $199.00
  },
  professional: {
    name: 'InkOps Professional',
    description: 'Advanced automation, purchase orders, scheduling, and integrations for high-volume shops.',
    amount: 29900, // $299.00
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!masterStripeKey) {
      throw new Error('Master Stripe key is not configured.');
    }

    const body = await req.json();
    const tier = body.tier || (body.productId === 'prod_UAfSjOXHcF7qpk' ? 'professional' : 'starter');
    const companyId = body.companyId;

    if (!tier || !companyId) {
      throw new Error('Missing required fields: tier, companyId');
    }

    const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];
    if (!config) {
      throw new Error('Invalid tier. Must be "starter" or "professional".');
    }

    const origin = req.headers.get('origin') || 'https://www.inkops.ink';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const stripe = new Stripe(masterStripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email || undefined,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: config.name,
            description: config.description,
          },
          recurring: {
            interval: 'month',
          },
          unit_amount: config.amount,
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${origin}/dashboard/settings?tab=company-info&upgrade=success`,
      cancel_url: `${origin}/dashboard/settings?tab=company-info&upgrade=cancelled`,
      metadata: {
        company_id: companyId,
        user_id: user.id,
        tier: tier,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating checkout:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
