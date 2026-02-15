import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Customer-Token",
};

interface PortalDataRequest {
  customerToken: string;
  dataType: 'quotes' | 'invoices' | 'proofs' | 'work_orders';
  customerId?: string;
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

    // Get customer token from header or body
    const customerToken = req.headers.get('X-Customer-Token');
    const url = new URL(req.url);
    const dataType = url.searchParams.get('type') || 'quotes';

    if (!customerToken) {
      return new Response(
        JSON.stringify({ error: "Customer token required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify customer session
    const { data: session } = await supabase
      .from('customer_portal_sessions')
      .select('customer_id, email, expires_at')
      .eq('magic_token', customerToken)
      .single();

    if (!session || new Date(session.expires_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get customer email for filtering
    const { data: customer } = await supabase
      .from('customers')
      .select('email, company_id')
      .eq('id', session.customer_id)
      .single();

    if (!customer) {
      return new Response(
        JSON.stringify({ error: "Customer not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let data;

    // Fetch data based on type
    switch (dataType) {
      case 'quotes': {
        const { data: quotes, error } = await supabase
          .from('quotes')
          .select(`
            id,
            quote_number,
            created_at,
            expiry_date,
            subtotal,
            tax_amount,
            status,
            customer_name,
            customer_email,
            notes,
            quote_line_items (
              id,
              description,
              quantity,
              unit_price,
              total_price
            )
          `)
          .eq('company_id', customer.company_id)
          .ilike('customer_email', customer.email)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = quotes;
        break;
      }

      case 'invoices': {
        const { data: invoices, error } = await supabase
          .from('printavo_invoices')
          .select('*')
          .eq('company_id', customer.company_id)
          .ilike('customer_email', customer.email)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = invoices;
        break;
      }

      case 'proofs': {
        const { data: proofs, error } = await supabase
          .from('proofs')
          .select(`
            id,
            quote_id,
            proof_number,
            composite_image_url,
            status,
            created_at,
            quotes!inner (
              customer_id,
              customer_email,
              company_id
            )
          `)
          .eq('quotes.company_id', customer.company_id)
          .ilike('quotes.customer_email', customer.email)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = proofs;
        break;
      }

      case 'work_orders': {
        const { data: workOrders, error } = await supabase
          .from('work_orders')
          .select('*')
          .eq('company_id', customer.company_id)
          .eq('customer_id', session.customer_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = workOrders;
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid data type" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error fetching portal data:", error);
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
