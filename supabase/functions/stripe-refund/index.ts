import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getStripeKey(): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('company_settings')
    .select('stripe_secret_key')
    .maybeSingle();

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

    if (payment.status === 'refunded') {
      return new Response(
        JSON.stringify({ error: "Payment already refunded" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!payment.stripe_charge_id && !payment.stripe_payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe transaction ID found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Stripe secret key
    const stripeSecretKey = await getStripeKey();

    // Create refund via Stripe API
    const chargeId = payment.stripe_charge_id || payment.stripe_payment_intent_id;
    const refundData: any = {
      charge: chargeId,
    };

    if (reason) {
      refundData.reason = reason;
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/refunds', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(refundData).toString(),
    });

    if (!stripeResponse.ok) {
      const errorData = await stripeResponse.json();
      console.error('Stripe refund error:', errorData);
      return new Response(
        JSON.stringify({
          error: "Stripe refund failed",
          details: errorData.error?.message || 'Unknown error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const refund = await stripeResponse.json();
    console.log('Stripe refund successful:', refund.id);

    // Update payment record
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

    // Update invoice balance
    if (payment.invoice_id) {
      const { data: invoice } = await supabaseAuth
        .from('printavo_invoices')
        .select('*')
        .eq('id', payment.invoice_id)
        .maybeSingle();

      if (invoice) {
        const refundAmount = refund.amount / 100;
        const newAmountPaid = (invoice.amount_paid || 0) - refundAmount;
        const newBalance = invoice.total - newAmountPaid;

        await supabaseAuth
          .from('printavo_invoices')
          .update({
            amount_paid: newAmountPaid,
            balance_remaining: newBalance,
            amount_outstanding: newBalance,
          })
          .eq('id', payment.invoice_id);

        // Update Stripe invoice if exists
        const { data: stripeInvoice } = await supabaseAuth
          .from('stripe_invoices')
          .select('*')
          .eq('printavo_invoice_id', payment.invoice_id)
          .maybeSingle();

        if (stripeInvoice) {
          const stripeNewAmountPaid = (stripeInvoice.amount_paid || 0) - refundAmount;
          const stripeNewAmountRemaining = stripeInvoice.total_amount - stripeNewAmountPaid;

          await supabaseAuth
            .from('stripe_invoices')
            .update({
              amount_paid: stripeNewAmountPaid,
              amount_remaining: stripeNewAmountRemaining,
              status: stripeNewAmountRemaining > 0 ? 'open' : 'paid',
              updated_at: new Date().toISOString(),
            })
            .eq('id', stripeInvoice.id);
        }
      }
    }

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
