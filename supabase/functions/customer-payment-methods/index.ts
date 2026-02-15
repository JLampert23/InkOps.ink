import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AddPaymentMethodRequest {
  customer_id: string;
  stripe_payment_method_id: string;
  is_default?: boolean;
}

interface DeletePaymentMethodRequest {
  payment_method_id: string;
  customer_id: string;
}

interface SetDefaultPaymentMethodRequest {
  payment_method_id: string;
  customer_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const url = new URL(req.url);
    const method = req.method;

    if (method === "GET") {
      const customerId = url.searchParams.get("customer_id");

      if (!customerId) {
        return new Response(
          JSON.stringify({ error: "customer_id is required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: paymentMethods, error } = await supabase
        .from("customer_stripe_payment_methods")
        .select("*")
        .eq("customer_id", customerId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          payment_methods: paymentMethods || []
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (method === "POST") {
      const body = await req.json() as AddPaymentMethodRequest;
      const { customer_id, stripe_payment_method_id, is_default } = body;

      if (!customer_id || !stripe_payment_method_id) {
        return new Response(
          JSON.stringify({ error: "customer_id and stripe_payment_method_id are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: customer } = await supabase
        .from("customers")
        .select("company_id")
        .eq("id", customer_id)
        .maybeSingle();

      if (!customer) {
        return new Response(
          JSON.stringify({ error: "Customer not found" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("stripe_secret_key")
        .eq("id", customer.company_id)
        .maybeSingle();

      if (!companySettings?.stripe_secret_key) {
        return new Response(
          JSON.stringify({ error: "Stripe not configured" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const stripeResponse = await fetch(
        `https://api.stripe.com/v1/payment_methods/${stripe_payment_method_id}`,
        {
          headers: {
            "Authorization": `Bearer ${companySettings.stripe_secret_key}`,
          },
        }
      );

      if (!stripeResponse.ok) {
        throw new Error("Failed to retrieve payment method from Stripe");
      }

      const stripePaymentMethod = await stripeResponse.json();

      let paymentMethodData: any = {
        customer_id,
        company_id: customer.company_id,
        stripe_payment_method_id,
        payment_method_type: stripePaymentMethod.type,
        is_default: is_default || false,
      };

      if (stripePaymentMethod.type === "card") {
        paymentMethodData = {
          ...paymentMethodData,
          last_four: stripePaymentMethod.card.last4,
          brand: stripePaymentMethod.card.brand,
          exp_month: stripePaymentMethod.card.exp_month,
          exp_year: stripePaymentMethod.card.exp_year,
        };
      } else if (stripePaymentMethod.type === "us_bank_account") {
        paymentMethodData = {
          ...paymentMethodData,
          last_four: stripePaymentMethod.us_bank_account.last4,
          brand: stripePaymentMethod.us_bank_account.bank_name,
        };
      }

      const { data: savedMethod, error } = await supabase
        .from("customer_stripe_payment_methods")
        .insert(paymentMethodData)
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          payment_method: savedMethod
        }),
        {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (method === "PUT") {
      const body = await req.json() as SetDefaultPaymentMethodRequest;
      const { payment_method_id, customer_id } = body;

      if (!payment_method_id || !customer_id) {
        return new Response(
          JSON.stringify({ error: "payment_method_id and customer_id are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error } = await supabase
        .from("customer_stripe_payment_methods")
        .update({ is_default: true })
        .eq("id", payment_method_id)
        .eq("customer_id", customer_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          message: "Default payment method updated"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (method === "DELETE") {
      const body = await req.json() as DeletePaymentMethodRequest;
      const { payment_method_id, customer_id } = body;

      if (!payment_method_id || !customer_id) {
        return new Response(
          JSON.stringify({ error: "payment_method_id and customer_id are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error } = await supabase
        .from("customer_stripe_payment_methods")
        .delete()
        .eq("id", payment_method_id)
        .eq("customer_id", customer_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment method deleted"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error managing payment methods:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
