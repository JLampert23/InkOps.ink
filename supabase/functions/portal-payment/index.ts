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
  action: "createPaymentLink";
  companyId: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  customerEmail?: string;
  customerName?: string;
  description?: string;
}

async function getDecryptedStripeKey(encryptedKey: string): Promise<string> {
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
    throw new Error("Failed to decrypt Stripe key");
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

    const { action, companyId, invoiceId, customerId, amount, customerEmail, customerName, description } = requestData;

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
      .select("stripe_secret_key, stripe_public_key, inkops_subdomain, company_name")
      .eq("id", companyId)
      .maybeSingle();

    if (settingsError || !companySettings?.stripe_secret_key) {
      return new Response(
        JSON.stringify({ error: "Stripe is not configured for this company" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripeSecretKey = await getDecryptedStripeKey(companySettings.stripe_secret_key);

    if (action === "createPaymentLink") {
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

      // 2026-06-12 [3.2-3] — post-payment redirect. Prefer the requesting
      // origin (the portal page the customer is on). Previously the fallback
      // was supabaseUrl — the API host, which has no portal — so customers
      // paying from a context with no Origin header landed on a 404 after
      // paying. Now fall back to the company's portal subdomain (same
      // construction as send-magic-link), then inkops.ink as last resort.
      let portalBaseUrl = req.headers.get("origin");
      if (!portalBaseUrl) {
        let subdomain = companySettings.inkops_subdomain;
        if (!subdomain && companySettings.company_name) {
          subdomain = companySettings.company_name.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 30);
        }
        portalBaseUrl = subdomain ? `https://${subdomain}.inkops.ink` : "https://inkops.ink";
      }

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
            url: `${portalBaseUrl}/portal/customer/${customerId}?payment=success`,
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

      const paymentLink = await linkResponse.json();

      return new Response(
        JSON.stringify({
          paymentLinkId: paymentLink.id,
          url: paymentLink.url,
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
