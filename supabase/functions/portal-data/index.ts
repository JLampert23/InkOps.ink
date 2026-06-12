import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Customer-Token",
};

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

    const { data: session } = await supabase
      .from('customer_portal_sessions')
      .select('customer_id, email, expires_at')
      .eq('magic_token', customerToken)
      .single();

    // NOTE (2026-06-12 review): the -24h offset is INTENTIONAL. expires_at is
    // the magic-link token's 15-minute login window; the established session
    // stays valid for ~24h beyond it so customers aren't logged out minutes
    // after clicking their email link. Do not "fix" this to a strict
    // expires_at check — that regresses the portal into 15-minute sessions.
    if (!session || new Date(session.expires_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === 'approve_quote') {
        return await handleQuoteApproval(supabase, supabaseUrl, customer, session, body, corsHeaders);
      }

      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let data;

    switch (dataType) {
      case 'quote_detail': {
        const quoteId = url.searchParams.get('quote_id');
        if (!quoteId) {
          return new Response(
            JSON.stringify({ error: "quote_id is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: quote, error: quoteError } = await supabase
          .from('quotes')
          .select('*')
          .eq('id', quoteId)
          .eq('company_id', customer.company_id)
          .ilike('customer_email', customer.email)
          .neq('status', 'draft')
          .maybeSingle();

        if (quoteError) throw quoteError;
        if (!quote) {
          return new Response(
            JSON.stringify({ error: "Quote not found or access denied" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { data: lineItems } = await supabase
          .from('quote_line_items')
          .select('*')
          .eq('quote_id', quoteId)
          .order('line_number');

        const { data: imprints } = await supabase
          .from('quote_imprints')
          .select('*')
          .eq('quote_id', quoteId)
          .order('sort_order');

        const { data: companySettings } = await supabase
          .from('company_settings')
          .select(`
            company_name,
            company_address,
            company_city,
            company_state,
            company_zip,
            company_phone,
            company_email,
            company_website,
            logo_url,
            company_logo_primary_url,
            company_logo_secondary_url
          `)
          .eq('id', customer.company_id)
          .maybeSingle();

        data = {
          quote,
          line_items: lineItems || [],
          imprints: imprints || [],
          company_settings: companySettings || {},
        };
        break;
      }

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
            total,
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
          .neq('status', 'draft')
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = quotes;
        break;
      }

      case 'invoices': {
        const { data: invoices, error } = await supabase
          .from('printavo_invoices')
          .select(`
            id,
            invoice_number,
            invoice_date,
            due_date,
            total,
            balance_remaining,
            amount_outstanding,
            status_stage,
            customer_name,
            customer_email
          `)
          .eq('company_id', customer.company_id)
          .ilike('customer_email', customer.email)
          .order('created_at', { ascending: false });

        if (error) throw error;
        data = (invoices || []).map((inv: any) => ({
          ...inv,
          balance: inv.balance_remaining ?? inv.amount_outstanding ?? 0,
          total: inv.total ?? 0,
        }));
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

async function handleQuoteApproval(
  supabase: any,
  supabaseUrl: string,
  customer: { email: string; company_id: string },
  session: { customer_id: string; email: string },
  body: {
    quote_id: string;
    approved: boolean;
    approver_name: string;
    approver_email: string;
    notes?: string;
  },
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
  const { quote_id, approved, approver_name, approver_email, notes } = body;

  if (!quote_id || approved === undefined || !approver_name || !approver_email) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quote_id)
    .eq('company_id', customer.company_id)
    .ilike('customer_email', customer.email)
    .maybeSingle();

  if (quoteError || !quote) {
    return new Response(
      JSON.stringify({ error: "Quote not found or access denied" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const approvableStatuses = ['sent', 'pending', 'sent_for_approval', 'awaiting_approval', 'approval_sent'];
  if (!approvableStatuses.includes(quote.status)) {
    return new Response(
      JSON.stringify({ error: `This quote has already been processed (status: ${quote.status})` }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const newStatus = approved ? "approved" : "rejected";
  const statusField = approved ? "approved_at" : "rejected_at";

  const updateFields: Record<string, any> = {
    status: newStatus,
    [statusField]: new Date().toISOString(),
    approved_by_name: approver_name,
  };

  if (approved) {
    updateFields.converted_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update(updateFields)
    .eq("id", quote_id);

  if (updateError) {
    console.error("Quote update failed:", updateError);
    return new Response(
      JSON.stringify({ error: "Failed to update quote status" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  await supabase.from("quote_activity_log").insert([{
    quote_id: quote_id,
    company_id: customer.company_id,
    action: approved ? "approved_by_customer_portal" : "rejected_by_customer_portal",
    performed_by: null,
    performed_by_name: approver_name,
    meta: {
      approver_email,
      notes: notes || null,
      source: "customer_portal",
    },
  }]);

  if (approved) {
    try {
      const { data: lineItems } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quote_id)
        .order("line_number");

      const { data: imprints } = await supabase
        .from("quote_imprints")
        .select("*")
        .eq("quote_id", quote_id)
        .order("sort_order");

      const sumQty = (item: any) =>
        (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
        (item.qty_yl || 0) + (item.qty_yxl || 0) + (item.qty_xs || 0) +
        (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) +
        (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
        (item.qty_4xl || 0);

      const buildSizesJson = (item: any) => ({
        yxs: item.qty_yxs || 0, ys: item.qty_ys || 0, ym: item.qty_ym || 0,
        yl: item.qty_yl || 0, yxl: item.qty_yxl || 0,
        xs: item.qty_xs || 0, s: item.qty_s || 0, m: item.qty_m || 0,
        l: item.qty_l || 0, xl: item.qty_xl || 0,
        "2xl": item.qty_2xl || 0, "3xl": item.qty_3xl || 0, "4xl": item.qty_4xl || 0,
      });

      const { data: existingWOs } = await supabase
        .from("work_orders")
        .select("work_order_number")
        .eq("company_id", customer.company_id)
        .order("created_at", { ascending: false })
        .limit(1);

      let workOrderNumber: string;
      if (existingWOs && existingWOs.length > 0) {
        const match = existingWOs[0].work_order_number.match(/WO-(\d+)/);
        workOrderNumber = `WO-${String((match ? parseInt(match[1]) : 0) + 1).padStart(6, '0')}`;
      } else {
        workOrderNumber = "WO-000001";
      }

      const { data: existingInvoices } = await supabase
        .from("printavo_invoices")
        .select("invoice_number")
        .eq("company_id", customer.company_id)
        .not("invoice_number", "is", null)
        .order("created_at", { ascending: false })
        .limit(1);

      let invoiceNumber: string;
      if (existingInvoices && existingInvoices.length > 0 && existingInvoices[0].invoice_number) {
        const match = existingInvoices[0].invoice_number.match(/INV-(\d+)/);
        invoiceNumber = `INV-${String((match ? parseInt(match[1]) : 0) + 1).padStart(6, '0')}`;
      } else {
        invoiceNumber = "INV-000001";
      }

      const { data: workOrder, error: woError } = await supabase
        .from("work_orders")
        .insert([{
          work_order_number: workOrderNumber,
          company_id: customer.company_id,
          quote_id: quote_id,
          customer_name: quote.customer_name,
          status: "Pending Scheduling",
          priority: "medium",
          production_due_date: quote.production_due_date,
          customer_due_date: quote.customer_due_date,
          notes: quote.production_notes || quote.notes,
        }])
        .select()
        .single();

      if (woError) {
        console.error("Work order creation failed:", woError.message);
      } else {
        if (lineItems && lineItems.length > 0) {
          const woLineItems = lineItems
            .filter((item: any) => item.line_type === "item" || !item.line_type)
            .map((item: any) => ({
              work_order_id: workOrder.id,
              company_id: customer.company_id,
              line_number: item.line_number,
              item_type: "garment",
              description: item.description || item.item_number || "",
              style_number: item.item_number,
              color: item.color,
              quantity: sumQty(item) || item.quantity || 0,
              sizes: buildSizesJson(item),
              notes: item.notes,
            }));

          await supabase.from("work_order_line_items").insert(woLineItems);
        }

        const garmentLineItems = lineItems?.filter((item: any) =>
          item.line_type === "item" || !item.line_type
        ) || [];

        for (const garment of garmentLineItems) {
          const totalQty = sumQty(garment) || garment.quantity || 0;
          await supabase.from("garment_requirements_staging").insert([{
            company_id: customer.company_id,
            quote_id: quote_id,
            work_order_id: workOrder.id,
            style_number: garment.item_number,
            style_name: garment.description,
            color: garment.color,
            sizes: buildSizesJson(garment),
            total_quantity: totalQty,
            unit_cost: garment.wholesale_price || garment.garment_unit_price || 0,
            supplier_name: garment.supplier_name,
            supplier_type: garment.supplier_name ? "distributor" : null,
          }]);
        }

        if (imprints && imprints.length > 0) {
          const dueDate = quote.production_due_date || quote.customer_due_date || new Date().toISOString().split('T')[0];
          const scheduleEntries = imprints.map((imp: any, idx: number) => ({
            company_id: customer.company_id,
            quote_id: quote_id,
            work_order_id: workOrder.id,
            imprint_id: imp.id,
            type_of_work: imp.type_of_work || "Screen Print",
            imprint_number: imp.imprint_number || `IMP-${idx + 1}`,
            production_due_date: dueDate,
            quantity: lineItems?.reduce((sum: number, li: any) => sum + (sumQty(li) || li.quantity || 0), 0) || 0,
            customer_name: quote.customer_name,
            quote_number: quote.quote_number,
            scheduler_column: "Unscheduled",
            colors: imp.thread_ink_color || null,
            step_statuses: {},
            priority_order: idx,
          }));

          await supabase.from("production_schedule_entries").insert(scheduleEntries);
        }
      }

      const invoiceId = invoiceNumber;
      const { error: invError } = await supabase
        .from("printavo_invoices")
        .insert([{
          id: invoiceId,
          invoice_number: invoiceNumber,
          company_id: customer.company_id,
          customer_id: session.customer_id,
          customer_name: quote.customer_name,
          customer_email: quote.customer_email,
          customer_company: quote.customer_company,
          customer_phone: quote.customer_phone,
          subtotal: quote.subtotal || 0,
          tax: quote.tax_amount || 0,
          total: quote.total || 0,
          amount_paid: 0,
          amount_outstanding: quote.total || 0,
          balance_remaining: quote.total || 0,
          status: "Open",
          status_stage: "billing_queue",
          invoice_date: new Date().toISOString(),
          due_date: quote.payment_due_date || null,
          billing_line1: quote.bill_address_1,
          billing_line2: quote.bill_address_2,
          billing_city: quote.bill_city,
          billing_state: quote.bill_state,
          billing_zip: quote.bill_zip,
          shipping_line1: quote.ship_address_1,
          shipping_line2: quote.ship_address_2,
          shipping_city: quote.ship_city,
          shipping_state: quote.ship_state,
          shipping_zip: quote.ship_zip,
          raw_data: {
            source: "customer_portal_approval",
            quote_id: quote_id,
            quote_number: quote.quote_number,
            work_order_id: workOrder?.id,
            work_order_number: workOrderNumber,
            approved_by: approver_name,
            terms: quote.terms,
          },
        }]);

      if (invError) {
        console.error("Invoice creation failed:", invError.message);
      } else {
        if (lineItems && lineItems.length > 0) {
          const invLineItems = lineItems.map((item: any) => ({
            invoice_id: invoiceId,
            company_id: customer.company_id,
            line_number: item.line_number,
            item_type: item.line_type === "fee" ? "fee" : "garment",
            description: item.description || item.item_number || "",
            style_number: item.item_number,
            color: item.color,
            sizes: buildSizesJson(item),
            quantity: sumQty(item) || item.quantity || 1,
            unit_price: item.unit_price || 0,
            subtotal: item.total_price || 0,
            total: item.total_price || 0,
            notes: item.notes,
          }));

          await supabase.from("invoice_line_items").insert(invLineItems);
        }

        await supabase.from("billing_queue").insert([{
          company_id: customer.company_id,
          printavo_invoice_id: invoiceId,
          printavo_visual_id: invoiceNumber,
          customer_name: quote.customer_name,
          customer_email: quote.customer_email,
          customer_company: quote.customer_company,
          invoice_total: quote.total || 0,
          invoice_date: new Date().toISOString(),
          payment_status: "pending",
        }]);
      }
    } catch (conversionError: any) {
      console.error("Conversion workflow error:", conversionError.message);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: approved
        ? "Quote approved successfully!"
        : "Quote declined. Thank you for your response.",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
  } catch (err: any) {
    console.error("handleQuoteApproval error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to process quote approval" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
