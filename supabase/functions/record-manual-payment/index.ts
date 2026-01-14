import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const { invoiceId, paymentType, amount, checkNumber, notes, paymentDate } = await req.json();

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: "Missing invoiceId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!paymentType) {
      return new Response(
        JSON.stringify({ error: "Missing paymentType" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invoice, error: invoiceError } = await supabaseAuth
      .from("printavo_invoices")
      .select("id, invoice_number, total, amount_paid, balance_remaining, customer_id")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (amount > invoice.balance_remaining) {
      return new Response(
        JSON.stringify({ 
          error: "Payment amount exceeds invoice balance",
          balance: invoice.balance_remaining 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: companySettings } = await supabaseAuth
      .from("company_settings")
      .select("id")
      .maybeSingle();

    if (!companySettings) {
      return new Response(
        JSON.stringify({ error: "Company settings not found" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paymentTypeMap: Record<string, string> = {
      'cash': 'Cash',
      'debit_credit': 'Debit/Credit Card',
      'check_ach': 'Check/ACH',
    };

    const { data: payment, error: paymentError } = await supabaseAuth
      .from("payments")
      .insert({
        company_id: companySettings.id,
        invoice_id: invoiceId,
        customer_id: invoice.customer_id,
        amount: amount,
        payment_type: paymentType,
        payment_method: paymentTypeMap[paymentType] || paymentType,
        check_number: checkNumber || null,
        notes: notes || null,
        payment_date: paymentDate || new Date().toISOString(),
        source: 'manual',
        created_by: user.id,
        metadata: {
          recorded_via: 'manual_entry',
          recorded_by: user.email,
        },
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Error creating payment:", paymentError);
      return new Response(
        JSON.stringify({ error: "Failed to create payment", details: paymentError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const newAmountPaid = (invoice.amount_paid || 0) + amount;
    const newBalance = invoice.total - newAmountPaid;

    const { error: updateError } = await supabaseAuth
      .from("printavo_invoices")
      .update({
        amount_paid: newAmountPaid,
        balance_remaining: newBalance,
        amount_outstanding: newBalance,
      })
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      await supabaseAuth.from("payments").delete().eq("id", payment.id);
      return new Response(
        JSON.stringify({ error: "Failed to update invoice", details: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (newBalance <= 0) {
      await supabaseAuth
        .from("billing_queue")
        .update({ payment_status: 'paid' })
        .eq("printavo_invoice_id", invoiceId);
    }

    console.log(`Manual payment of $${amount} recorded for invoice ${invoice.invoice_number} by ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Payment of $${amount.toFixed(2)} recorded successfully`,
        payment: {
          id: payment.id,
          amount: payment.amount,
          payment_type: paymentType,
          payment_method: paymentTypeMap[paymentType],
          payment_date: payment.payment_date,
        },
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          previous_balance: invoice.balance_remaining,
          new_balance: newBalance,
          amount_paid: newAmountPaid,
          is_paid: newBalance <= 0,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in record-manual-payment function:", error);
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