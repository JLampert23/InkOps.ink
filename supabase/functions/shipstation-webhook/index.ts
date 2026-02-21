import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ShipNotifyPayload {
  resource_url: string;
  resource_type: string;
  data: {
    orderNumber: string;
    orderId: number;
    orderKey: string;
    trackingNumber: string;
    carrierCode: string;
    serviceCode: string;
    shipDate: string;
    voidLabel: boolean;
    voided: boolean;
  };
}

interface ItemDeliveredPayload {
  resource_url: string;
  resource_type: string;
  data: {
    orderNumber: string;
    orderId: number;
    orderKey: string;
    trackingNumber: string;
    carrierCode: string;
    deliveryDate: string;
  };
}

async function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );

    const signatureBase64 = btoa(
      String.fromCharCode(...new Uint8Array(signatureBytes))
    );

    return signatureBase64 === signature;
  } catch (error) {
    console.error("HMAC verification error:", error);
    return false;
  }
}

async function logWebhookEvent(
  supabase: any,
  companyId: string,
  eventType: string,
  orderNumber: string,
  invoiceId: string | null,
  payload: any,
  success: boolean,
  errorMessage?: string
) {
  try {
    await supabase.from("shipstation_order_log").insert({
      company_id: companyId,
      invoice_id: invoiceId,
      invoice_number: orderNumber,
      action: `webhook_${eventType}`,
      request_payload: payload,
      response_payload: { success, error: errorMessage },
      status_code: success ? 200 : 400,
      error_message: errorMessage || null,
    });
  } catch (err) {
    console.error("Failed to log webhook event:", err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    console.log("Received ShipStation webhook:", JSON.stringify(payload, null, 2));

    const eventType = payload.resource_type;

    if (!eventType) {
      console.log("Missing resource_type in webhook payload");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hmacSignature = req.headers.get("x-shipstation-hmac-sha256");

    if (hmacSignature) {
      const { data: companies } = await supabaseClient
        .from("company_settings")
        .select("id, shipstation_webhook_secret")
        .not("shipstation_webhook_secret", "is", null);

      if (companies && companies.length > 0) {
        let verified = false;
        for (const company of companies) {
          if (company.shipstation_webhook_secret) {
            verified = await verifyHmacSignature(
              rawBody,
              hmacSignature,
              company.shipstation_webhook_secret
            );
            if (verified) break;
          }
        }

        if (!verified) {
          console.error("HMAC signature verification failed");
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    switch (eventType) {
      case "SHIP_NOTIFY": {
        const shipNotify = payload as ShipNotifyPayload;
        const orderNumber = shipNotify.data.orderNumber;
        const trackingNumber = shipNotify.data.trackingNumber;
        const carrierCode = shipNotify.data.carrierCode;
        const serviceCode = shipNotify.data.serviceCode;
        const isVoided = shipNotify.data.voided || shipNotify.data.voidLabel;

        console.log(`Processing SHIP_NOTIFY for order ${orderNumber}, voided: ${isVoided}`);

        const { data: invoice, error: invoiceError } = await supabaseClient
          .from("printavo_invoices")
          .select("id, company_id")
          .eq("invoice_number", orderNumber)
          .maybeSingle();

        if (invoiceError || !invoice) {
          console.error(`Invoice not found for order ${orderNumber}:`, invoiceError);
          await logWebhookEvent(
            supabaseClient,
            "unknown",
            "SHIP_NOTIFY",
            orderNumber,
            null,
            payload,
            false,
            "Invoice not found"
          );
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (isVoided) {
          console.log(`Shipment voided for order ${orderNumber}, cleaning up labels`);

          const { error: deleteLabelsError } = await supabaseClient
            .from("shipping_labels")
            .delete()
            .eq("invoice_id", invoice.id)
            .eq("tracking_number", trackingNumber);

          if (deleteLabelsError) {
            console.error("Failed to delete shipping labels:", deleteLabelsError);
          } else {
            console.log(`Deleted shipping labels for tracking ${trackingNumber}`);
          }

          const { data: remainingLabels } = await supabaseClient
            .from("shipping_labels")
            .select("id")
            .eq("invoice_id", invoice.id)
            .is("voided_at", null);

          const hasActiveLabels = remainingLabels && remainingLabels.length > 0;

          const { error: updateError } = await supabaseClient
            .from("printavo_invoices")
            .update({
              tracking_number: hasActiveLabels ? undefined : null,
              shipping_status: hasActiveLabels ? "shipped" : "pending",
              shipping_labels: hasActiveLabels ? undefined : null,
            })
            .eq("id", invoice.id);

          if (updateError) {
            console.error("Failed to update invoice after void:", updateError);
            await logWebhookEvent(
              supabaseClient,
              invoice.company_id,
              "SHIP_NOTIFY_VOID",
              orderNumber,
              invoice.id,
              payload,
              false,
              updateError.message
            );
          } else {
            console.log(`Successfully processed void for invoice ${orderNumber}`);
            await logWebhookEvent(
              supabaseClient,
              invoice.company_id,
              "SHIP_NOTIFY_VOID",
              orderNumber,
              invoice.id,
              payload,
              true
            );
          }
        } else {
          const { error: updateError } = await supabaseClient
            .from("printavo_invoices")
            .update({
              tracking_number: trackingNumber,
              carrier: carrierCode,
              service: serviceCode,
              shipping_status: "shipped",
              shipped_at: new Date().toISOString(),
            })
            .eq("id", invoice.id);

          if (updateError) {
            console.error("Failed to update invoice:", updateError);
            await logWebhookEvent(
              supabaseClient,
              invoice.company_id,
              "SHIP_NOTIFY",
              orderNumber,
              invoice.id,
              payload,
              false,
              updateError.message
            );
          } else {
            console.log(`Successfully updated invoice ${orderNumber} with tracking ${trackingNumber}`);
            await logWebhookEvent(
              supabaseClient,
              invoice.company_id,
              "SHIP_NOTIFY",
              orderNumber,
              invoice.id,
              payload,
              true
            );
          }
        }

        break;
      }

      case "ITEM_DELIVERED": {
        const itemDelivered = payload as ItemDeliveredPayload;
        const orderNumber = itemDelivered.data.orderNumber;

        console.log(`Processing ITEM_DELIVERED for order ${orderNumber}`);

        const { data: invoice, error: invoiceError } = await supabaseClient
          .from("printavo_invoices")
          .select("id, company_id")
          .eq("invoice_number", orderNumber)
          .maybeSingle();

        if (invoiceError || !invoice) {
          console.error(`Invoice not found for order ${orderNumber}:`, invoiceError);
          await logWebhookEvent(
            supabaseClient,
            "unknown",
            "ITEM_DELIVERED",
            orderNumber,
            null,
            payload,
            false,
            "Invoice not found"
          );
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: updateError } = await supabaseClient
          .from("printavo_invoices")
          .update({
            shipping_status: "delivered",
            delivered_at: new Date().toISOString(),
          })
          .eq("id", invoice.id);

        if (updateError) {
          console.error("Failed to update invoice:", updateError);
          await logWebhookEvent(
            supabaseClient,
            invoice.company_id,
            "ITEM_DELIVERED",
            orderNumber,
            invoice.id,
            payload,
            false,
            updateError.message
          );
        } else {
          console.log(`Successfully marked invoice ${orderNumber} as delivered`);
          await logWebhookEvent(
            supabaseClient,
            invoice.company_id,
            "ITEM_DELIVERED",
            orderNumber,
            invoice.id,
            payload,
            true
          );
        }

        break;
      }

      default:
        console.log(`Unsupported event type: ${eventType}`);
        await logWebhookEvent(
          supabaseClient,
          "unknown",
          eventType,
          payload.data?.orderNumber || "unknown",
          null,
          payload,
          true,
          "Event type not supported"
        );
        break;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in shipstation-webhook function:", error);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
