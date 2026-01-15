import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const signatureParts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      if (key === 't') acc.timestamp = value;
      if (key === 'v1') acc.signatures.push(value);
      return acc;
    }, { timestamp: '', signatures: [] as string[] });

    if (!signatureParts.timestamp || signatureParts.signatures.length === 0) {
      console.error('Invalid signature format');
      return false;
    }

    const signedPayload = `${signatureParts.timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature_bytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    );

    const expectedSignature = Array.from(new Uint8Array(signature_bytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = signatureParts.signatures.some(sig => sig === expectedSignature);

    if (!isValid) {
      console.error('Signature mismatch');
      return false;
    }

    const timestamp = parseInt(signatureParts.timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const tolerance = 300;

    if (currentTime - timestamp > tolerance) {
      console.error('Timestamp too old');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function getWebhookSecret(): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('company_settings')
    .select('stripe_webhook_secret')
    .maybeSingle();

  if (error) {
    console.error('Database error fetching webhook secret:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  if (!data?.stripe_webhook_secret) {
    console.error('No webhook secret found in database');
    throw new Error('Stripe webhook secret not configured. Please add it in Settings.');
  }

  console.log('Attempting to decrypt webhook secret...');
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
    const errorText = await decryptResponse.text();
    console.error('Decryption failed:', errorText);
    throw new Error(`Failed to decrypt webhook secret: ${errorText}`);
  }

  const decryptResult = await decryptResponse.json();
  if (!decryptResult.success || !decryptResult.result) {
    console.error('Decryption returned invalid result:', decryptResult);
    throw new Error('Decryption failed: Invalid response from crypto service');
  }

  return decryptResult.result;
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

    const webhookSecret = await getWebhookSecret();
    const isValid = await verifyStripeSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        {
          status: 401,
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

        // Log to unified payments table
        const { data: invoiceData } = await supabase
          .from('printavo_invoices')
          .select('customer_id')
          .eq('id', metadata.printavo_invoice_id)
          .maybeSingle();

        await supabase.from('payments').insert([{
          company_id: companyId,
          invoice_id: metadata.printavo_invoice_id || null,
          customer_id: invoiceData?.customer_id || null,
          amount: paymentIntent.amount / 100,
          payment_date: new Date().toISOString(),
          payment_method: 'Stripe',
          payment_type: 'stripe',
          stripe_transaction_id: paymentIntent.latest_charge || paymentIntent.id,
          stripe_payment_intent_id: paymentIntent.id,
          stripe_charge_id: paymentIntent.latest_charge || null,
          status: 'successful',
          source: 'stripe',
          metadata: {
            customer_email: metadata.customer_email,
            customer_name: metadata.customer_name,
            payment_method_type: paymentIntent.payment_method_types?.[0] || 'card',
          },
        }]);
        
        if (metadata.printavo_invoice_id) {
          await supabase
            .from('stripe_payment_links')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('printavo_invoice_id', metadata.printavo_invoice_id);

          const { data: invoice } = await supabase
            .from('printavo_invoices')
            .select('*')
            .eq('id', metadata.printavo_invoice_id)
            .maybeSingle();

          if (invoice) {
            const currentPaid = parseFloat(invoice.amount_paid || 0);
            const newPaid = currentPaid + (paymentIntent.amount / 100);
            const total = parseFloat(invoice.total || 0);
            const balanceRemaining = total - newPaid;
            const isFullyPaid = balanceRemaining <= 0;

            const updateData: any = {
              amount_paid: newPaid,
              amount_outstanding: balanceRemaining,
              balance_remaining: balanceRemaining,
              status_stage: isFullyPaid ? 'paid' : 'partial',
              status: isFullyPaid ? 'Paid' : 'Partially Paid',
            };

            if (isFullyPaid) {
              updateData.is_financially_locked = true;
              updateData.locked_at = new Date().toISOString();
              updateData.locked_by = 'stripe';
              console.log(`Locking invoice ${metadata.printavo_invoice_id} - paid in full`);
            }

            await supabase
              .from('printavo_invoices')
              .update(updateData)
              .eq('id', metadata.printavo_invoice_id);
          }

          const { data: queueItem } = await supabase
            .from('billing_queue')
            .select('*')
            .eq('printavo_invoice_id', metadata.printavo_invoice_id)
            .maybeSingle();

          if (queueItem) {
            await supabase
              .from('billing_queue')
              .update({
                payment_status: 'paid',
              })
              .eq('id', queueItem.id);

            await supabase.from('communication_logs').insert([{
              company_id: companyId,
              printavo_invoice_id: queueItem.printavo_invoice_id,
              communication_type: 'payment',
              method: 'stripe',
              recipient: queueItem.customer_email || 'unknown',
              subject: `Payment Received - Invoice #${queueItem.printavo_visual_id}`,
              message: `Payment of $${(paymentIntent.amount / 100).toFixed(2)} received via Stripe`,
              status: 'completed',
              metadata: {
                stripe_payment_intent_id: paymentIntent.id,
                stripe_charge_id: paymentIntent.latest_charge,
                amount: paymentIntent.amount / 100,
                payment_method: paymentIntent.payment_method_types?.[0] || 'card',
              },
            }]);

            const { data: stripeInvoice } = await supabase
              .from('stripe_invoices')
              .select('*')
              .eq('printavo_invoice_id', queueItem.printavo_invoice_id)
              .maybeSingle();

            if (stripeInvoice) {
              const paymentAmountDollars = paymentIntent.amount / 100;
              const totalAmountDollars = parseFloat(stripeInvoice.total_amount);
              const newAmountPaid = parseFloat(stripeInvoice.amount_paid || 0) + paymentAmountDollars;
              const newAmountRemaining = totalAmountDollars - newAmountPaid;

              await supabase
                .from('stripe_invoices')
                .update({
                  amount_paid: newAmountPaid,
                  amount_remaining: Math.max(0, newAmountRemaining),
                  status: newAmountRemaining <= 0.01 ? 'paid' : 'open',
                  paid_at: newAmountRemaining <= 0.01 ? new Date().toISOString() : stripeInvoice.paid_at,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', stripeInvoice.id);
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

        // Log to unified payments table
        const { data: invoiceData } = await supabase
          .from('printavo_invoices')
          .select('customer_id')
          .eq('id', metadata.printavo_invoice_id)
          .maybeSingle();

        await supabase.from('payments').insert([{
          company_id: companyId,
          invoice_id: metadata.printavo_invoice_id || null,
          customer_id: invoiceData?.customer_id || null,
          amount: paymentIntent.amount / 100,
          payment_date: new Date().toISOString(),
          payment_method: 'Stripe',
          payment_type: 'stripe',
          stripe_transaction_id: paymentIntent.id,
          stripe_payment_intent_id: paymentIntent.id,
          status: 'failed',
          source: 'stripe',
          metadata: {
            customer_email: metadata.customer_email,
            customer_name: metadata.customer_name,
            error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
          },
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
        const refundAmount = charge.amount_refunded / 100;
        const isFullRefund = charge.refunded;

        console.log('Charge refunded:', charge.id, 'Amount:', refundAmount);

        await supabase
          .from('stripe_payments')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', paymentIntentId);

        // Update unified payments table
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('*')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (existingPayment) {
          await supabase
            .from('payments')
            .update({
              status: isFullRefund ? 'refunded' : 'partial_refund',
              refund_amount: refundAmount,
              refunded_at: new Date().toISOString(),
              metadata: {
                ...existingPayment.metadata,
                refund_id: charge.refunds?.data?.[0]?.id,
                refund_reason: charge.refunds?.data?.[0]?.reason,
              },
            })
            .eq('id', existingPayment.id);

          // Update invoice balance
          if (existingPayment.invoice_id) {
            const { data: invoice } = await supabase
              .from('printavo_invoices')
              .select('*')
              .eq('id', existingPayment.invoice_id)
              .maybeSingle();

            if (invoice) {
              const newAmountPaid = (invoice.amount_paid || 0) - refundAmount;
              const newBalance = invoice.total - newAmountPaid;

              await supabase
                .from('printavo_invoices')
                .update({
                  amount_paid: newAmountPaid,
                  balance_remaining: newBalance,
                  amount_outstanding: newBalance,
                })
                .eq('id', existingPayment.invoice_id);
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

          const { data: invoiceData } = await supabase
            .from('printavo_invoices')
            .select('customer_id')
            .eq('id', metadata.printavo_invoice_id)
            .maybeSingle();

          await supabase.from('payments').insert([{
            company_id: companyId,
            invoice_id: metadata.printavo_invoice_id || null,
            customer_id: invoiceData?.customer_id || null,
            amount: session.amount_total / 100,
            payment_date: new Date().toISOString(),
            payment_method: 'Stripe',
            payment_type: 'stripe',
            stripe_transaction_id: session.payment_intent || session.id,
            stripe_payment_intent_id: session.payment_intent,
            stripe_charge_id: null,
            status: 'successful',
            source: 'stripe',
            metadata: {
              customer_email: session.customer_details?.email || metadata.customer_email,
              customer_name: session.customer_details?.name || metadata.customer_name,
              payment_method_type: 'card',
              checkout_session_id: session.id,
            },
          }]);

          if (metadata.printavo_invoice_id) {
            await supabase
              .from('stripe_payment_links')
              .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
              })
              .eq('printavo_invoice_id', metadata.printavo_invoice_id);

            const { data: invoice } = await supabase
              .from('printavo_invoices')
              .select('*')
              .eq('id', metadata.printavo_invoice_id)
              .maybeSingle();

            if (invoice) {
              const currentPaid = parseFloat(invoice.amount_paid || 0);
              const newPaid = currentPaid + (session.amount_total / 100);
              const total = parseFloat(invoice.total || 0);
              const balanceRemaining = total - newPaid;
              const isFullyPaid = balanceRemaining <= 0;

              const updateData: any = {
                amount_paid: newPaid,
                amount_outstanding: balanceRemaining,
                balance_remaining: balanceRemaining,
                status_stage: isFullyPaid ? 'paid' : 'partial',
                status: isFullyPaid ? 'Paid' : 'Partially Paid',
              };

              if (isFullyPaid) {
                updateData.is_financially_locked = true;
                updateData.locked_at = new Date().toISOString();
                updateData.locked_by = 'stripe';
                console.log(`Locking invoice ${metadata.printavo_invoice_id} - paid in full`);
              }

              await supabase
                .from('printavo_invoices')
                .update(updateData)
                .eq('id', metadata.printavo_invoice_id);
            }

            const { data: queueItem } = await supabase
              .from('billing_queue')
              .select('*')
              .eq('printavo_invoice_id', metadata.printavo_invoice_id)
              .maybeSingle();

            if (queueItem) {
              await supabase
                .from('billing_queue')
                .update({
                  payment_status: 'paid',
                })
                .eq('id', queueItem.id);

              await supabase.from('communication_logs').insert([{
                company_id: companyId,
                printavo_invoice_id: queueItem.printavo_invoice_id,
                communication_type: 'payment',
                method: 'stripe',
                recipient: queueItem.customer_email || 'unknown',
                subject: `Payment Received - Invoice #${queueItem.printavo_visual_id}`,
                message: `Payment of $${(session.amount_total / 100).toFixed(2)} received via Stripe`,
                status: 'completed',
                metadata: {
                  stripe_payment_intent_id: session.payment_intent,
                  stripe_session_id: session.id,
                  amount: session.amount_total / 100,
                  payment_method: 'card',
                },
              }]);

              const { data: stripeInvoice } = await supabase
                .from('stripe_invoices')
                .select('*')
                .eq('printavo_invoice_id', queueItem.printavo_invoice_id)
                .maybeSingle();

              if (stripeInvoice) {
                const paymentAmountDollars = session.amount_total / 100;
                const totalAmountDollars = parseFloat(stripeInvoice.total_amount);
                const newAmountPaid = parseFloat(stripeInvoice.amount_paid || 0) + paymentAmountDollars;
                const newAmountRemaining = totalAmountDollars - newAmountPaid;

                await supabase
                  .from('stripe_invoices')
                  .update({
                    amount_paid: newAmountPaid,
                    amount_remaining: Math.max(0, newAmountRemaining),
                    status: newAmountRemaining <= 0.01 ? 'paid' : 'open',
                    paid_at: newAmountRemaining <= 0.01 ? new Date().toISOString() : stripeInvoice.paid_at,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', stripeInvoice.id);
              }
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

        const amountPaidDollars = amountPaid / 100;
        const amountRemainingDollars = amountRemaining / 100;
        const isFullyPaid = amountRemaining === 0 || invoice.status === 'paid';

        await supabase
          .from('stripe_invoices')
          .update({
            status: invoice.status,
            amount_paid: amountPaidDollars,
            amount_remaining: amountRemainingDollars,
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
            const newPaid = amountPaid / 100;
            const balanceRemaining = total - newPaid;

            const updateData: any = {
              amount_paid: newPaid,
              amount_outstanding: balanceRemaining,
              balance_remaining: balanceRemaining,
              status_stage: isFullyPaid ? 'paid' : 'partial',
              status: isFullyPaid ? 'Paid' : 'Partially Paid',
            };

            if (isFullyPaid) {
              updateData.is_financially_locked = true;
              updateData.locked_at = new Date().toISOString();
              updateData.locked_by = 'stripe';
              console.log(`Locking invoice ${printavoInvoiceId} - paid in full`);
            }

            await supabase
              .from('printavo_invoices')
              .update(updateData)
              .eq('id', printavoInvoiceId);
          }

          if (isFullyPaid) {
            const { data: queueItem } = await supabase
              .from('billing_queue')
              .select('*')
              .eq('printavo_invoice_id', printavoInvoiceId)
              .maybeSingle();

            if (queueItem) {
              await supabase
                .from('billing_queue')
                .update({
                  payment_status: 'paid',
                })
                .eq('id', queueItem.id);

              await supabase.from('communication_logs').insert([{
                company_id: companyId,
                printavo_invoice_id: queueItem.printavo_invoice_id,
                communication_type: 'payment',
                method: 'stripe',
                recipient: queueItem.customer_email || 'unknown',
                subject: `Payment Received - Invoice #${queueItem.printavo_visual_id}`,
                message: `Payment of $${(amountPaid / 100).toFixed(2)} received via Stripe`,
                status: 'completed',
                metadata: {
                  stripe_payment_intent_id: paymentIntentId,
                  stripe_charge_id: chargeId,
                  stripe_invoice_id: invoice.id,
                  amount: amountPaid / 100,
                  payment_method: 'card',
                },
              }]);
            }

            const { data: stripeInvoiceRecord } = await supabase
              .from('stripe_invoices')
              .select('*')
              .eq('stripe_invoice_id', invoice.id)
              .maybeSingle();

            if (stripeInvoiceRecord) {
              await supabase
                .from('stripe_invoices')
                .update({
                  amount_paid: amountPaidDollars,
                  amount_remaining: amountRemainingDollars,
                  status: isFullyPaid ? 'paid' : 'open',
                  paid_at: isFullyPaid ? new Date().toISOString() : stripeInvoiceRecord.paid_at,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', stripeInvoiceRecord.id);
            }
          } else {
            await supabase
              .from('billing_queue')
              .update({
                payment_status: 'partial',
              })
              .eq('printavo_invoice_id', printavoInvoiceId);
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