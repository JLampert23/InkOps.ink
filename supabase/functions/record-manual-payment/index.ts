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

    console.log('Auth header present:', !!authHeader);

    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create client with anon key and auth header to get user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    console.log('User lookup result:', { userId: user?.id, error: userError?.message });

    if (userError || !user) {
      console.error("Error getting user:", userError);
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          details: userError?.message || 'No user found'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Now use service role for database operations
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { invoiceId, paymentType, amount, checkNumber, notes, paymentDate, customerId } = await req.json();

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

    // Try new invoices table first, then fall back to printavo_invoices
    let invoice: any = null;
    let isNewInvoice = false;

    const { data: newInvoice, error: newInvoiceError } = await supabaseAuth
      .from("invoices")
      .select("id, invoice_number, total, balance_due, customer_id")
      .eq("id", invoiceId)
      .maybeSingle();

    if (newInvoice) {
      invoice = {
        id: newInvoice.id,
        invoice_number: newInvoice.invoice_number,
        total: newInvoice.total,
        amount_paid: newInvoice.total - newInvoice.balance_due,
        balance_remaining: newInvoice.balance_due,
        customer_id: newInvoice.customer_id,
      };
      isNewInvoice = true;
    } else {
      // Fall back to printavo_invoices
      const { data: oldInvoice, error: oldInvoiceError } = await supabaseAuth
        .from("printavo_invoices")
        .select("id, invoice_number, total, amount_paid, balance_remaining, customer_id")
        .eq("id", invoiceId)
        .maybeSingle();

      if (oldInvoiceError || !oldInvoice) {
        return new Response(
          JSON.stringify({ error: "Invoice not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      invoice = oldInvoice;
      isNewInvoice = false;
    }

    const roundedAmount = Math.round(amount * 100) / 100;
    const roundedBalance = Math.round((invoice.balance_remaining || 0) * 100) / 100;
    if (roundedAmount > roundedBalance) {
      return new Response(
        JSON.stringify({
          error: "Payment amount exceeds invoice balance",
          balance: roundedBalance
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user's profile to find their company_id
    const { data: userProfile, error: profileError } = await supabaseAuth
      .from("user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();

    console.log('User profile lookup:', { userId: user.id, companyId: userProfile?.company_id, error: profileError?.message });

    if (profileError || !userProfile || !userProfile.company_id) {
      return new Response(
        JSON.stringify({
          error: "User profile or company not found",
          details: profileError?.message || "No company_id in profile"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: companySettings } = await supabaseAuth
      .from("company_settings")
      .select("id")
      .eq("id", userProfile.company_id)
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
      'fundraising_credit': 'Fundraising Credit',
    };

    // Handle fundraising credit payment
    if (paymentType === 'fundraising_credit') {
      if (!customerId) {
        return new Response(
          JSON.stringify({ error: "Customer ID required for fundraising credit payment" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Calculate available fundraising credit
      const { data: credits, error: creditsError } = await supabaseAuth
        .from("customer_fundraising_credits")
        .select("amount")
        .eq("customer_id", customerId)
        .eq("company_id", companySettings.id);

      if (creditsError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch fundraising credits" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const totalCredit = credits?.reduce((sum, c) => sum + parseFloat(c.amount.toString()), 0) || 0;

      if (amount > totalCredit) {
        return new Response(
          JSON.stringify({
            error: "Insufficient fundraising credit",
            available: totalCredit,
            requested: amount
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Deduct from fundraising credit by creating a negative entry
      const { error: deductError } = await supabaseAuth
        .from("customer_fundraising_credits")
        .insert({
          customer_id: customerId,
          company_id: companySettings.id,
          date: paymentDate || new Date().toISOString().split('T')[0],
          store_name: 'Credit Applied',
          batch_number: `INV-${invoice.invoice_number}`,
          amount: -amount, // Negative amount to deduct
        });

      if (deductError) {
        console.error("Error deducting fundraising credit:", deductError);
        return new Response(
          JSON.stringify({ error: "Failed to deduct fundraising credit" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

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

    const newAmountPaid = Math.round(((invoice.amount_paid || 0) + amount) * 100) / 100;
    const newBalance = Math.round((invoice.total - newAmountPaid) * 100) / 100;
    const isFullyPaid = newBalance <= 0;

    // Update the appropriate invoice table
    if (isNewInvoice) {
      const invoiceUpdate: any = {
        balance_due: newBalance,
        status_stage: isFullyPaid ? 'paid' : 'partial',
      };

      if (isFullyPaid) {
        invoiceUpdate.status = 'paid';
        invoiceUpdate.is_financially_locked = true;
        invoiceUpdate.locked_at = new Date().toISOString();
        invoiceUpdate.locked_by = user.email;
      }

      const { error: updateError } = await supabaseAuth
        .from("invoices")
        .update(invoiceUpdate)
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

      if (isFullyPaid) {
        await supabaseAuth
          .from("billing_queue")
          .update({ payment_status: 'paid' })
          .eq("invoice_id", invoiceId);
      }
    } else {
      const invoiceUpdate: any = {
        amount_paid: newAmountPaid,
        balance_remaining: newBalance,
        amount_outstanding: newBalance,
      };

      if (isFullyPaid) {
        invoiceUpdate.status_stage = 'paid';
        invoiceUpdate.is_financially_locked = true;
        invoiceUpdate.locked_at = new Date().toISOString();
        invoiceUpdate.locked_by = user.email;
      }

      const { error: updateError } = await supabaseAuth
        .from("printavo_invoices")
        .update(invoiceUpdate)
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

      if (isFullyPaid) {
        await supabaseAuth
          .from("billing_queue")
          .update({ payment_status: 'paid' })
          .eq("printavo_invoice_id", invoiceId);
      }
    }

    await supabaseAuth.from('communication_logs').insert([{
      company_id: companySettings.id,
      printavo_invoice_id: invoiceId,
      communication_type: 'payment',
      method: 'manual',
      recipient: user.email,
      subject: `Manual Payment Recorded - Invoice #${invoice.invoice_number}`,
      message: `Payment of $${amount.toFixed(2)} recorded via ${paymentTypeMap[paymentType] || paymentType}${checkNumber ? ` (Check #${checkNumber})` : ''}`,
      status: 'completed',
      metadata: {
        payment_id: payment.id,
        payment_type: paymentType,
        payment_method: paymentTypeMap[paymentType] || paymentType,
        check_number: checkNumber || null,
        amount: amount,
        recorded_by: user.email,
      },
      sent_by: user.id,
    }]);

    const { data: stripeInvoice } = await supabaseAuth
      .from('stripe_invoices')
      .select('*')
      .eq('printavo_invoice_id', invoiceId)
      .maybeSingle();

    if (stripeInvoice) {
      const stripeNewAmountPaid = (stripeInvoice.amount_paid || 0) + amount;
      const stripeNewAmountRemaining = stripeInvoice.total_amount - stripeNewAmountPaid;

      await supabaseAuth
        .from('stripe_invoices')
        .update({
          amount_paid: stripeNewAmountPaid,
          amount_remaining: stripeNewAmountRemaining,
          status: stripeNewAmountRemaining <= 0 ? 'paid' : 'open',
          paid_at: stripeNewAmountRemaining <= 0 ? new Date().toISOString() : stripeInvoice.paid_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stripeInvoice.id);
    }

    console.log(`Manual payment of $${amount} recorded for invoice ${invoice.invoice_number} by ${user.email}${isFullyPaid ? ' - Invoice marked as PAID and locked' : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Payment of $${amount.toFixed(2)} recorded successfully${isFullyPaid ? '. Invoice marked as PAID and locked.' : ''}`,
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
          is_paid: isFullyPaid,
          is_locked: isFullyPaid,
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