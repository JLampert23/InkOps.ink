import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface SquareWebhookEvent {
  merchant_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: {
    type: string;
    id: string;
    object: Record<string, unknown>;
  };
}

async function findCompanyByMerchant(supabase: ReturnType<typeof createClient>, merchantId: string) {
  const { data: companies } = await supabase
    .from("company_settings")
    .select("id, square_location_id")
    .not("square_access_token", "is", null);

  return companies?.[0] || null;
}

async function handlePaymentCompleted(
  supabase: ReturnType<typeof createClient>,
  event: SquareWebhookEvent
) {
  const payment = event.data.object as {
    id: string;
    order_id?: string;
    amount_money?: { amount: number; currency: string };
    status: string;
    source_type?: string;
    card_details?: {
      card?: {
        card_brand?: string;
        last_4?: string;
      };
    };
    receipt_url?: string;
    buyer_email_address?: string;
  };

  if (!payment.order_id) {
    console.log("Payment has no order_id, skipping");
    return;
  }

  const { data: paymentLink } = await supabase
    .from("square_payment_links")
    .select("id, company_id, invoice_id, customer_email, customer_name")
    .eq("square_order_id", payment.order_id)
    .eq("status", "active")
    .maybeSingle();

  if (!paymentLink) {
    console.log("No matching payment link found for order:", payment.order_id);
    return;
  }

  const amountInDollars = payment.amount_money
    ? payment.amount_money.amount / 100
    : 0;

  const { error: insertError } = await supabase.from("square_payments").insert({
    company_id: paymentLink.company_id,
    invoice_id: paymentLink.invoice_id,
    square_payment_id: payment.id,
    square_order_id: payment.order_id,
    amount: amountInDollars,
    currency: payment.amount_money?.currency || "USD",
    status: payment.status,
    customer_email: payment.buyer_email_address || paymentLink.customer_email,
    customer_name: paymentLink.customer_name,
    payment_method: payment.source_type || "CARD",
    card_brand: payment.card_details?.card?.card_brand || null,
    card_last_four: payment.card_details?.card?.last_4 || null,
    receipt_url: payment.receipt_url || null,
    metadata: {
      event_id: event.event_id,
      merchant_id: event.merchant_id,
    },
  });

  if (insertError) {
    console.error("Error inserting Square payment:", insertError);
    throw insertError;
  }

  await supabase
    .from("square_payment_links")
    .update({
      status: "completed",
      paid_at: new Date().toISOString(),
    })
    .eq("id", paymentLink.id);

  if (paymentLink.invoice_id) {
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("invoice_id", paymentLink.invoice_id)
      .eq("square_payment_id", payment.id)
      .maybeSingle();

    if (!existingPayment) {
      await supabase.from("payments").insert({
        company_id: paymentLink.company_id,
        invoice_id: paymentLink.invoice_id,
        amount: amountInDollars,
        payment_method: "square",
        status: "completed",
        square_payment_id: payment.id,
        notes: `Square payment - ${payment.card_details?.card?.card_brand || "Card"} ending in ${payment.card_details?.card?.last_4 || "****"}`,
      });
    }

    const { data: invoice } = await supabase
      .from("printavo_invoices")
      .select("balance_remaining, total")
      .eq("id", paymentLink.invoice_id)
      .maybeSingle();

    if (invoice) {
      const newBalance = Math.max(0, (invoice.balance_remaining || invoice.total) - amountInDollars);

      await supabase
        .from("printavo_invoices")
        .update({
          balance_remaining: newBalance,
          status_stage: newBalance <= 0 ? "paid" : "partial",
        })
        .eq("id", paymentLink.invoice_id);
    }
  }

  console.log("Square payment processed successfully:", payment.id);
}

async function handleOrderUpdated(
  supabase: ReturnType<typeof createClient>,
  event: SquareWebhookEvent
) {
  const order = event.data.object as {
    id: string;
    state?: string;
  };

  if (order.state === "COMPLETED") {
    console.log("Order completed:", order.id);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.text();
    let event: SquareWebhookEvent;

    try {
      event = JSON.parse(body);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Received Square webhook:", event.type, event.event_id);

    const { data: existingEvent } = await supabase
      .from("square_webhook_events")
      .select("id")
      .eq("square_event_id", event.event_id)
      .maybeSingle();

    if (existingEvent) {
      console.log("Duplicate event, skipping:", event.event_id);
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const company = await findCompanyByMerchant(supabase, event.merchant_id);

    const { error: logError } = await supabase.from("square_webhook_events").insert({
      company_id: company?.id || null,
      square_event_id: event.event_id,
      event_type: event.type,
      event_data: event,
      processed: false,
    });

    if (logError) {
      console.error("Error logging webhook event:", logError);
    }

    try {
      switch (event.type) {
        case "payment.completed":
          await handlePaymentCompleted(supabase, event);
          break;
        case "payment.updated":
          if ((event.data.object as { status?: string }).status === "COMPLETED") {
            await handlePaymentCompleted(supabase, event);
          }
          break;
        case "order.updated":
          await handleOrderUpdated(supabase, event);
          break;
        default:
          console.log("Unhandled event type:", event.type);
      }

      await supabase
        .from("square_webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("square_event_id", event.event_id);

    } catch (processingError) {
      console.error("Error processing webhook:", processingError);

      await supabase
        .from("square_webhook_events")
        .update({
          processed: false,
          error_message: processingError instanceof Error ? processingError.message : "Unknown error",
        })
        .eq("square_event_id", event.event_id);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Square webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
