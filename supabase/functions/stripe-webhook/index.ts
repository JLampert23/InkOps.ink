import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
          const { data: invoice } = await supabase
            .from('printavo_invoices')
            .select('*')
            .eq('id', metadata.printavo_invoice_id)
            .maybeSingle();

          if (invoice) {
            const currentPaid = parseFloat(invoice.amount_paid || 0);
            const paymentAmount = paymentIntent.amount / 100;
            const newPaid = currentPaid + paymentAmount;
            const total = parseFloat(invoice.total || 0);
            const amountOutstanding = total - newPaid;
            const isPaid = amountOutstanding <= 0;

            await supabase.from('payments').insert([{
              company_id: companyId,
              invoice_id: invoice.id,
              customer_id: invoice.customer_id,
              amount: paymentAmount,
              payment_date: new Date().toISOString(),
              payment_method: paymentIntent.payment_method_types?.[0] || 'card',
              stripe_transaction_id: paymentIntent.latest_charge || null,
              stripe_payment_intent_id: paymentIntent.id,
              stripe_charge_id: paymentIntent.latest_charge || null,
              receipt_url: null,
              notes: 'Payment via Stripe payment intent',
              metadata: metadata,
            }]);

            await supabase
              .from('printavo_invoices')
              .update({
                amount_paid: newPaid,
                amount_outstanding: amountOutstanding,
                status_stage: isPaid ? 'paid' : 'accounts_receivable',
                status: isPaid ? 'Paid' : 'Partially Paid',
              })
              .eq('id', metadata.printavo_invoice_id);
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
            const { data: invoice } = await supabase
              .from('printavo_invoices')
              .select('*')
              .eq('id', metadata.printavo_invoice_id)
              .maybeSingle();

            if (invoice) {
              const currentPaid = parseFloat(invoice.amount_paid || 0);
              const paymentAmount = session.amount_total / 100;
              const newPaid = currentPaid + paymentAmount;
              const total = parseFloat(invoice.total || 0);
              const amountOutstanding = total - newPaid;
              const isPaid = amountOutstanding <= 0;

              await supabase.from('payments').insert([{
                company_id: companyId,
                invoice_id: invoice.id,
                customer_id: invoice.customer_id,
                amount: paymentAmount,
                payment_date: new Date().toISOString(),
                payment_method: 'card',
                stripe_transaction_id: null,
                stripe_payment_intent_id: session.payment_intent,
                stripe_charge_id: null,
                receipt_url: null,
                notes: 'Payment via Stripe checkout session',
                metadata: metadata,
              }]);

              await supabase
                .from('printavo_invoices')
                .update({
                  amount_paid: newPaid,
                  amount_outstanding: amountOutstanding,
                  status_stage: isPaid ? 'paid' : 'accounts_receivable',
                  status: isPaid ? 'Paid' : 'Partially Paid',
                })
                .eq('id', metadata.printavo_invoice_id);
            }
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

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const metadata = invoice.metadata || {};
        const printavoInvoiceId = metadata.printavo_invoice_id;

        console.log('Invoice payment succeeded:', invoice.id);

        const { data: stripeInvoice } = await supabase
          .from('stripe_invoices')
          .select('*')
          .eq('stripe_invoice_id', invoice.id)
          .maybeSingle();

        if (!stripeInvoice) {
          console.log('Stripe invoice not found in database');
          break;
        }

        const paymentIntentId = invoice.payment_intent;
        const chargeId = invoice.charge;
        const amountPaid = invoice.amount_paid || 0;
        const amountRemaining = invoice.amount_remaining || 0;

        const { data: existingPayment } = await supabase
          .from('stripe_payment_history')
          .select('id')
          .eq('payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (!existingPayment && paymentIntentId) {
          await supabase.from('stripe_payment_history').insert([{
            stripe_invoice_id: stripeInvoice.id,
            payment_intent_id: paymentIntentId,
            charge_id: chargeId,
            amount: amountPaid,
            currency: invoice.currency || 'usd',
            status: 'succeeded',
            payment_method: 'card',
            metadata: { invoice: invoice },
          }]);
        }

        const isFullyPaid = amountRemaining === 0 || invoice.status === 'paid';

        await supabase
          .from('stripe_invoices')
          .update({
            status: invoice.status,
            amount_paid: amountPaid,
            amount_remaining: amountRemaining,
            paid_at: isFullyPaid ? new Date().toISOString() : null,
          })
          .eq('id', stripeInvoice.id);

        if (printavoInvoiceId) {
          const { data: printavoInvoice } = await supabase
            .from('printavo_invoices')
            .select('*')
            .eq('id', printavoInvoiceId)
            .maybeSingle();

          if (printavoInvoice) {
            const total = parseFloat(printavoInvoice.total || 0);
            const paymentAmount = amountPaid / 100;
            const currentPaid = parseFloat(printavoInvoice.amount_paid || 0);
            const newPaid = currentPaid + paymentAmount;
            const amountOutstanding = total - newPaid;

            await supabase.from('payments').insert([{
              company_id: companyId,
              invoice_id: printavoInvoice.id,
              customer_id: printavoInvoice.customer_id,
              amount: paymentAmount,
              payment_date: new Date().toISOString(),
              payment_method: 'card',
              stripe_transaction_id: chargeId,
              stripe_payment_intent_id: paymentIntentId,
              stripe_charge_id: chargeId,
              receipt_url: null,
              notes: 'Payment via Stripe invoice',
              metadata: metadata,
            }]);

            await supabase
              .from('printavo_invoices')
              .update({
                amount_paid: newPaid,
                amount_outstanding: amountOutstanding,
                status_stage: isFullyPaid ? 'paid' : 'accounts_receivable',
                status: isFullyPaid ? 'Paid' : 'Partially Paid',
              })
              .eq('id', printavoInvoiceId);
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

      case 'invoice.payment_action_required': {
        const invoice = event.data.object;
        const metadata = invoice.metadata || {};
        const printavoInvoiceId = metadata.printavo_invoice_id;

        console.log('Invoice payment action required:', invoice.id);

        await supabase
          .from('stripe_invoices')
          .update({
            status: 'action_required',
          })
          .eq('stripe_invoice_id', invoice.id);

        if (printavoInvoiceId) {
          await supabase
            .from('billing_queue')
            .update({
              payment_status: 'action_required',
            })
            .eq('printavo_invoice_id', printavoInvoiceId);
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

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const metadata = invoice.metadata || {};
        const printavoInvoiceId = metadata.printavo_invoice_id;

        console.log('Invoice payment failed:', invoice.id);

        await supabase
          .from('stripe_invoices')
          .update({
            status: 'payment_failed',
          })
          .eq('stripe_invoice_id', invoice.id);

        if (printavoInvoiceId) {
          await supabase
            .from('billing_queue')
            .update({
              payment_status: 'failed',
            })
            .eq('printavo_invoice_id', printavoInvoiceId);
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