import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface PaymentRequest {
  action: "createPaymentLink" | "getPaymentOptions";
  provider?: "stripe" | "square";
  companyId: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  customerEmail?: string;
  customerName?: string;
  description?: string;
}

async function decryptKey(encryptedKey: string): Promise<string> {
  const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      action: "decrypt",
      token: encryptedKey,
    }),
  });

  if (!decryptResponse.ok) {
    throw new Error("Failed to decrypt key");
  }

  const decryptResult = await decryptResponse.json();
  if (!decryptResult.success || !decryptResult.result) {
    throw new Error("Decryption failed");
  }

  return decryptResult.result;
}

async function callStripeAPI(
  endpoint: string,
  method: string,
  secretKey: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const url = `https://api.stripe.com/v1${endpoint}`;

  const headers: HeadersInit = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT")) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "object" && value !== null) {
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          params.append(`${key}[${subKey}]`, String(subValue));
        }
      } else {
        params.append(key, String(value));
      }
    }
    options.body = params;
  }

  return await fetch(url, options);
}

async function callSquareAPI(
  endpoint: string,
  method: string,
  accessToken: string,
  environment: string,
  body?: Record<string, unknown>
): Promise<Response> {
  const baseUrl = environment === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";

  const url = `${baseUrl}${endpoint}`;

  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Square-Version": "2024-12-18",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  return await fetch(url, options);
}

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
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
    const requestData: PaymentRequest = await req.json();

    const { action, provider, companyId, invoiceId, customerId, amount, customerEmail, customerName, description } = requestData;

    if (!companyId || !invoiceId || !customerId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("printavo_invoices")
      .select("id, company_id, customer_id, balance_remaining, visual_id, invoice_number")
      .eq("id", invoiceId)
      .eq("company_id", companyId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: companySettings, error: settingsError } = await supabase
      .from("company_settings")
      .select("stripe_secret_key, stripe_public_key, square_access_token, square_location_id, square_environment, square_payments_enabled")
      .eq("id", companyId)
      .maybeSingle();

    if (settingsError) {
      return new Response(
        JSON.stringify({ error: "Failed to load company settings" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "getPaymentOptions") {
      const stripeEnabled = !!(companySettings?.stripe_secret_key && companySettings?.stripe_public_key);
      const squareEnabled = !!(companySettings?.square_payments_enabled && companySettings?.square_access_token && companySettings?.square_location_id);

      return new Response(
        JSON.stringify({
          stripe: stripeEnabled,
          square: squareEnabled,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "createPaymentLink") {
      const selectedProvider = provider || "stripe";

      if (selectedProvider === "square") {
        if (!companySettings?.square_payments_enabled || !companySettings?.square_access_token || !companySettings?.square_location_id) {
          return new Response(
            JSON.stringify({ error: "Square payments are not configured for this company" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const squareAccessToken = await decryptKey(companySettings.square_access_token);
        const locationId = companySettings.square_location_id;
        const environment = companySettings.square_environment || "production";

        const redirectUrl = `${req.headers.get("origin") || supabaseUrl}/portal/customer/${customerId}?payment=success&provider=square`;

        const orderBody = {
          idempotency_key: generateIdempotencyKey(),
          order: {
            location_id: locationId,
            line_items: [
              {
                name: description || `Invoice ${invoice.visual_id || invoice.invoice_number}`,
                quantity: "1",
                base_price_money: {
                  amount: amount,
                  currency: "USD",
                },
              },
            ],
            metadata: {
              invoice_id: invoiceId,
              customer_id: customerId,
              company_id: companyId,
              source: "customer_portal",
            },
          },
        };

        const orderResponse = await callSquareAPI("/v2/orders", "POST", squareAccessToken, environment, orderBody);

        if (!orderResponse.ok) {
          const error = await orderResponse.json();
          console.error("Square order creation error:", error);
          throw new Error(error.errors?.[0]?.detail || "Failed to create Square order");
        }

        const orderResult = await orderResponse.json();
        const orderId = orderResult.order?.id;

        if (!orderId) {
          throw new Error("Failed to get order ID from Square");
        }

        const checkoutBody = {
          idempotency_key: generateIdempotencyKey(),
          order_id: orderId,
          checkout_options: {
            redirect_url: redirectUrl,
            ask_for_shipping_address: false,
          },
          pre_populated_data: customerEmail ? {
            buyer_email: customerEmail,
          } : undefined,
        };

        const checkoutResponse = await callSquareAPI("/v2/online-checkout/payment-links", "POST", squareAccessToken, environment, checkoutBody);

        if (!checkoutResponse.ok) {
          const error = await checkoutResponse.json();
          console.error("Square checkout creation error:", error);
          throw new Error(error.errors?.[0]?.detail || "Failed to create Square checkout link");
        }

        const checkoutResult = await checkoutResponse.json();
        const paymentLink = checkoutResult.payment_link;

        if (!paymentLink?.url) {
          throw new Error("Failed to get checkout URL from Square");
        }

        await supabase.from("square_payment_links").insert({
          company_id: companyId,
          invoice_id: invoiceId,
          square_checkout_id: paymentLink.id,
          square_checkout_url: paymentLink.url,
          square_order_id: orderId,
          amount: amount / 100,
          currency: "USD",
          status: "active",
          customer_email: customerEmail || null,
          customer_name: customerName || null,
          metadata: {
            invoice_id: invoiceId,
            customer_id: customerId,
            visual_id: invoice.visual_id,
          },
        });

        return new Response(
          JSON.stringify({
            paymentLinkId: paymentLink.id,
            url: paymentLink.url,
            provider: "square",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!companySettings?.stripe_secret_key) {
        return new Response(
          JSON.stringify({ error: "Stripe is not configured for this company" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const stripeSecretKey = await decryptKey(companySettings.stripe_secret_key);

      const priceResponse = await callStripeAPI("/prices", "POST", stripeSecretKey, {
        unit_amount: amount,
        currency: "usd",
        "product_data[name]": description || `Invoice ${invoice.visual_id || invoice.invoice_number}`,
      });

      if (!priceResponse.ok) {
        const error = await priceResponse.json();
        throw new Error(error.error?.message || "Failed to create price");
      }

      const price = await priceResponse.json();

      const paymentLinkBody: Record<string, unknown> = {
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": 1,
        "metadata[invoice_id]": invoiceId,
        "metadata[customer_id]": customerId,
        "metadata[company_id]": companyId,
        "metadata[source]": "customer_portal",
        after_completion: {
          type: "redirect",
          redirect: {
            url: `${req.headers.get("origin") || supabaseUrl}/portal/customer/${customerId}?payment=success&provider=stripe`,
          },
        },
      };

      if (customerEmail) {
        paymentLinkBody["customer_creation"] = "always";
      }

      const linkResponse = await callStripeAPI("/payment_links", "POST", stripeSecretKey, paymentLinkBody);

      if (!linkResponse.ok) {
        const error = await linkResponse.json();
        throw new Error(error.error?.message || "Failed to create payment link");
      }

      const stripePaymentLink = await linkResponse.json();

      return new Response(
        JSON.stringify({
          paymentLinkId: stripePaymentLink.id,
          url: stripePaymentLink.url,
          provider: "stripe",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Portal payment error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
