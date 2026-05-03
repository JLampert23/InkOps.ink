import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getStripeKey(companyId?: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let query = supabase.from('company_settings').select('stripe_secret_key');
  if (companyId) query = query.eq('id', companyId);
  const { data, error } = await query.maybeSingle();

  if (error || !data?.stripe_secret_key) {
    throw new Error('Stripe secret key not configured');
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
    throw new Error('Failed to decrypt Stripe secret key');
  }

  const decryptResult = await decryptResponse.json();
  if (!decryptResult.success || !decryptResult.result) {
    throw new Error('Decryption failed');
  }

  return decryptResult.result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: profile } = await supabaseAuth
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { paymentId, reason } = await req.json();

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: "Missing paymentId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get payment details
    const { data: payment, error: paymentError } = await supabaseAuth
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: "Payment not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (payment.source !== 'stripe') {
      return new Response(
        JSON.stringify({ error: "Only Stripe payments can be refunded through this function" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if this is migrated/test data
    if (payment.metadata?.migrated_from) {
      return new Response(
        JSON.stringify({
          error: "Cannot refund migrated data",
          details: "This payment was migrated from historical data and doesn't exist in your Stripe account. Only real Stripe payments can be refunded."
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (payment.status === 'refunded') {
      return new Response(
        JSON.stringify({ error: "Payment already refunded" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Stripe secret key (scoped to this payment's company for multi-tenant)
    const stripeSecretKey = await getStripeKey(payment.company_id);

    // Backfill charge/payment_intent if missing but we have an invoice ID.
    // Newer Stripe API (2025-12-15.clover) drops payment_intent from invoice.paid
    // events, so older payment rows recorded only the invoice ID (in_...).
    if (!payment.stripe_charge_id && !payment.stripe_payment_intent_id) {
      const invoiceId =
        (typeof payment.stripe_transaction_id === 'string' && payment.stripe_transaction_id.startsWith('in_'))
          ? payment.stripe_transaction_id
          : (typeof payment.metadata?.stripe_invoice_id === 'string' ? payment.metadata.stripe_invoice_id : null);

      if (!invoiceId) {
        return new Response(
          JSON.stringify({ error: "No Stripe transaction ID found" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log(`Backfilling charge/payment_intent for payment ${payment.id} via invoice ${invoiceId}`);

      const params = new URLSearchParams();
      params.append('expand[]', 'payments.data.payment.payment_intent');
      params.append('expand[]', 'payments.data.payment.charge');
      const invoiceResp = await fetch(
        `https://api.stripe.com/v1/invoices/${invoiceId}?${params.toString()}`,
        { headers: { 'Authorization': `Bearer ${stripeSecretKey}` } }
      );

      if (!invoiceResp.ok) {
        const err = await invoiceResp.json().catch(() => ({}));
        console.error('Failed to fetch invoice from Stripe:', err);
        return new Response(
          JSON.stringify({ error: "Could not retrieve charge from Stripe", details: err.error?.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const stripeInvoice = await invoiceResp.json();

      // Try direct fields first (older API), then payments[] array (newer API)
      let backfillPI: string | null = typeof stripeInvoice.payment_intent === 'string' ? stripeInvoice.payment_intent : null;
      let backfillCharge: string | null = typeof stripeInvoice.charge === 'string' ? stripeInvoice.charge : null;

      if (!backfillPI && !backfillCharge && Array.isArray(stripeInvoice.payments?.data)) {
        for (const ip of stripeInvoice.payments.data) {
          const paid = ip.payment;
          if (!paid) continue;
          const pi = typeof paid.payment_intent === 'string' ? paid.payment_intent : paid.payment_intent?.id;
          const ch = typeof paid.charge === 'string' ? paid.charge : paid.charge?.id;
          if (pi || ch) {
            backfillPI = pi || backfillPI;
            backfillCharge = ch || backfillCharge;
            break;
          }
        }
      }

      if (!backfillPI && !backfillCharge) {
        console.error('No payment_intent or charge found on invoice:', JSON.stringify(stripeInvoice).slice(0, 1000));
        return new Response(
          JSON.stringify({ error: "Stripe invoice has no associated charge yet" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      payment.stripe_payment_intent_id = backfillPI;
      payment.stripe_charge_id = backfillCharge;

      await supabaseAuth
        .from('payments')
        .update({
          stripe_payment_intent_id: backfillPI,
          stripe_charge_id: backfillCharge,
          stripe_transaction_id: backfillCharge || backfillPI || payment.stripe_transaction_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      console.log(`Backfilled payment ${payment.id}: pi=${backfillPI}, charge=${backfillCharge}`);
    }

    // Create refund via Stripe API
    const refundData: any = {};

    if (payment.stripe_payment_intent_id) {
      refundData.payment_intent = payment.stripe_payment_intent_id;
    } else if (payment.stripe_charge_id) {
      refundData.charge = payment.stripe_charge_id;
    } else {
      return new Response(
        JSON.stringify({ error: "No valid Stripe transaction ID found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate reason - Stripe only accepts: duplicate, fraudulent, or requested_by_customer
    const validReasons = ['duplicate', 'fraudulent', 'requested_by_customer'];
    if (reason && validReasons.includes(reason)) {
      refundData.reason = reason;
    } else {
      // Default to requested_by_customer if no valid reason provided
      refundData.reason = 'requested_by_customer';
    }

    console.log('Attempting Stripe refund with data:', refundData);

    const stripeResponse = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(refundData).toString(),
    });

    console.log('Stripe API response status:', stripeResponse.status);

    if (!stripeResponse.ok) {
      const errorData = await stripeResponse.json();
      console.error('Stripe refund error - Full details:', JSON.stringify(errorData, null, 2));
      console.error('Payment data:', JSON.stringify({
        payment_id: payment.id,
        stripe_payment_intent_id: payment.stripe_payment_intent_id,
        stripe_charge_id: payment.stripe_charge_id,
        amount: payment.amount,
      }, null, 2));

      return new Response(
        JSON.stringify({
          error: "Stripe refund failed",
          details: errorData.error?.message || 'Unknown error',
          stripe_error_type: errorData.error?.type,
          stripe_error_code: errorData.error?.code,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const refund = await stripeResponse.json();
    console.log('Stripe refund successful:', refund.id);

    // Update payment record - DO NOT update invoice balance here
    // The Stripe webhook (charge.refunded) will handle invoice balance updates
    // to avoid double-processing the refund
    await supabaseAuth
      .from('payments')
      .update({
        status: 'refunded',
        refund_amount: refund.amount / 100,
        refunded_at: new Date().toISOString(),
        refund_reason: reason || null,
        metadata: {
          ...payment.metadata,
          refund_id: refund.id,
          refund_status: refund.status,
          refunded_by: user.email,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    // Log communication
    const { data: companySettings } = await supabaseAuth
      .from('company_settings')
      .select('id')
      .maybeSingle();

    if (companySettings) {
      await supabaseAuth.from('communication_logs').insert([{
        company_id: companySettings.id,
        printavo_invoice_id: payment.invoice_id,
        communication_type: 'refund',
        method: 'stripe',
        recipient: user.email,
        subject: `Refund Processed - Payment ${paymentId}`,
        message: `Refund of $${(refund.amount / 100).toFixed(2)} processed for payment`,
        status: 'completed',
        metadata: {
          refund_id: refund.id,
          payment_id: paymentId,
          amount: refund.amount / 100,
          reason: reason || null,
          processed_by: user.email,
        },
        sent_by: user.id,
      }]);
    }

    console.log(`Refund processed: $${(refund.amount / 100).toFixed(2)} by ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Refund of $${(refund.amount / 100).toFixed(2)} processed successfully`,
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
          created: refund.created,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in stripe-refund function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
