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
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!masterStripeKey || !webhookSecret) {
      throw new Error('Stripe master keys or webhook secret are not configured.');
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      throw new Error('No Stripe signature found');
    }

    const rawBody = await req.text();
    const stripe = new Stripe(masterStripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Master stripe webhook event received:', event.type);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const companyId = session.metadata?.company_id;
        const tier = session.metadata?.tier || 'professional';
        const subscriptionId = session.subscription as string;

        // ── InkOps subscription upgrade ──────────────────────────────
        if (companyId) {
          console.log(`Upgrading company ${companyId} to ${tier} tier due to successful checkout session.`);
          await supabase
            .from('company_settings')
            .update({
              subscription_tier: tier,
              stripe_subscription_id: subscriptionId || null,
              subscription_status: 'active',
            })
            .eq('id', companyId);
          break;
        }

        // ── Client invoice payment (payment link paid by customer) ────
        const printavoInvoiceId = session.metadata?.printavo_invoice_id;
        if (printavoInvoiceId) {
          console.log(`Invoice payment received for printavo_invoice_id: ${printavoInvoiceId}`);
          const amountPaid = (session.amount_total || 0) / 100;
          const customerEmail = session.customer_details?.email || session.customer_email || null;
          const customerName = session.customer_details?.name || null;
          const paymentIntentId = session.payment_intent as string || null;

          // 1. Mark payment link as paid
          await supabase
            .from('stripe_payment_links')
            .update({ status: 'paid' })
            .eq('printavo_invoice_id', printavoInvoiceId);

          // 2. Record the payment in stripe_payments
          await supabase
            .from('stripe_payments')
            .insert([{
              printavo_invoice_id: printavoInvoiceId,
              stripe_payment_intent_id: paymentIntentId,
              amount: amountPaid,
              currency: session.currency || 'usd',
              status: 'succeeded',
              customer_email: customerEmail,
              customer_name: customerName,
              payment_method: 'card',
            }]);

          // 3. Update the printavo invoice status to paid
          await supabase
            .from('printavo_invoices')
            .update({
              payment_status: 'paid',
              paid_at: new Date().toISOString(),
              amount_paid: amountPaid,
            })
            .eq('id', printavoInvoiceId);

          // 4. Update stripe_invoices record if it exists
          await supabase
            .from('stripe_invoices')
            .update({
              status: 'paid',
              amount_paid: amountPaid,
              amount_remaining: 0,
              paid_at: new Date().toISOString(),
            })
            .eq('printavo_invoice_id', printavoInvoiceId);

          console.log(`Invoice ${printavoInvoiceId} marked as paid. Amount: $${amountPaid}`);
        }

        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        
        // Find if this customer matches a company
        // This is a naive approach; normally you'd store the stripe_customer_id on the company_settings table.
        // But for minimum viable, the checkout.session.completed handled the initial upgrade.
        console.log('Subscription deleted for customer:', customerId);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
