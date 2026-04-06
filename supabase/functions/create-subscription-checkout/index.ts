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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!masterStripeKey) {
      throw new Error('Master Stripe key is not configured.');
    }

    const { productId, companyId } = await req.json();

    if (!productId || !companyId) {
      throw new Error('Missing required fields: productId, companyId');
    }

    const origin = req.headers.get('origin') || 'http://localhost:5173';

    // Verify user authorization before allowing checkout creation
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

    // Verify company
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id, email, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (!profile || profile.company_id !== companyId) {
      throw new Error('Invalid company context');
    }

    const stripe = new Stripe(masterStripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: profile.email || undefined,
      line_items: [{
        price_data: {
          currency: 'usd',
          product: productId,
          recurring: {
            interval: 'month',
          },
          unit_amount: productId === 'prod_UAfSjOXHcF7qpk' ? 29900 : 19900,
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `${origin}/dashboard/settings?tab=company-info&upgrade=success`,
      cancel_url: `${origin}/dashboard/settings?tab=company-info&upgrade=cancelled`,
      metadata: {
        company_id: companyId,
        user_id: user.id,
        tier: productId === 'prod_UAfSjOXHcF7qpk' ? 'professional' : 'starter',
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating checkout:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
