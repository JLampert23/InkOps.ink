import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

async function getWebhookSecret(): Promise<string | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from('company_settings')
      .select('stripe_webhook_secret')
      .maybeSingle();
    
    if (error || !data?.stripe_webhook_secret) {
      console.log('No webhook secret configured');
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
        token: data.stripe_webhook_secret,
      }),
    });
    
    if (!decryptResponse.ok) {
      console.error('Failed to decrypt webhook secret');
      return null;
    }
    
    const { result } = await decryptResponse.json();
    return result;
  } catch (error) {
    console.error('Error getting webhook secret:', error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      console.error('No Stripe signature found');
      return new Response(
        JSON.stringify({ error: 'No signature' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    const event = JSON.parse(rawBody);
    console.log('Webhook event received:', event.type);
    
    const { data: settings } = await supabase
      .from('company_settings')
      .select('id')
      .maybeSingle();
    
    const companyId = settings?.id;
    
    await supabase.from('stripe_webhook_events').insert([{
      company_id: companyId,
      stripe_event_id: event.id,
      event_type: event.type,
      event_data: event,
      processed: false,
    }]);
    
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const metadata = paymentIntent.metadata || {};
        
        console.log('Payment succeeded:', paymentIntent.id);
        
        await supabase.from('stripe_payments').insert([{
          company_id: companyId,
          printavo_invoice_id: metadata.printavo_invoice_id || null,
          stripe_payment_intent_id: paymentIntent.id,
          stripe_charge_id: paymentIntent.latest_charge || null,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: 'succeeded',
          customer_email: metadata.customer_email || null,
          customer_name: metadata.customer_name || null,
          payment_method: paymentIntent.payment_method_types?.[0] || 'card',
          metadata: metadata,
        }]);
        
        if (metadata.printavo_invoice_id) {
          await supabase
            .from('stripe_payment_links')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('printavo_invoice_id', metadata.printavo_invoice_id);
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('stripe_event_id', event.id);
        
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const metadata = paymentIntent.metadata || {};
        
        console.log('Payment failed:', paymentIntent.id);
        
        await supabase.from('stripe_payments').insert([{
          company_id: companyId,
          printavo_invoice_id: metadata.printavo_invoice_id || null,
          stripe_payment_intent_id: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          status: 'failed',
          customer_email: metadata.customer_email || null,
          customer_name: metadata.customer_name || null,
          payment_method: paymentIntent.payment_method_types?.[0] || 'card',
          metadata: metadata,
        }]);
        
        await supabase
          .from('stripe_webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('stripe_event_id', event.id);
        
        break;
      }
      
      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        
        console.log('Charge refunded:', charge.id);
        
        await supabase
          .from('stripe_payments')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', paymentIntentId);
        
        await supabase
          .from('stripe_webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('stripe_event_id', event.id);
        
        break;
      }
      
      case 'checkout.session.completed': {
        const session = event.data.object;
        const metadata = session.metadata || {};
        
        console.log('Checkout session completed:', session.id);
        
        if (session.payment_status === 'paid') {
          await supabase.from('stripe_payments').insert([{
            company_id: companyId,
            printavo_invoice_id: metadata.printavo_invoice_id || null,
            stripe_payment_intent_id: session.payment_intent,
            amount: session.amount_total / 100,
            currency: session.currency,
            status: 'succeeded',
            customer_email: session.customer_details?.email || metadata.customer_email || null,
            customer_name: session.customer_details?.name || metadata.customer_name || null,
            payment_method: 'card',
            metadata: metadata,
          }]);
          
          if (metadata.printavo_invoice_id) {
            await supabase
              .from('stripe_payment_links')
              .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
              })
              .eq('printavo_invoice_id', metadata.printavo_invoice_id);
          }
        }
        
        await supabase
          .from('stripe_webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('stripe_event_id', event.id);
        
        break;
      }
      
      default:
        console.log('Unhandled event type:', event.type);
        await supabase
          .from('stripe_webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            error_message: `Unhandled event type: ${event.type}`,
          })
          .eq('stripe_event_id', event.id);
    }
    
    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Webhook processing failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});