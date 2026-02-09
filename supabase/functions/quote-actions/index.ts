import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Extract the JWT token from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create authenticated Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user's JWT and get user details
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "Invalid or expired token",
          details: userError?.message
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, role, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.company_id) {
      throw new Error("User profile not found");
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[pathParts.length - 1];
    const quoteId = pathParts[pathParts.length - 2];

    // POST /quotes/:id/duplicate
    if (action === "duplicate") {
      // Get original quote
      const { data: original, error: fetchError } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!original) throw new Error("Quote not found");

      // Get line items
      const { data: originalLineItems } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("line_number");

      // Generate new quote number
      const { data: quoteNumber } = await supabase.rpc("generate_quote_number");

      // Create duplicate
      const duplicateData = {
        quote_number: quoteNumber,
        company_id: profile.company_id,
        customer_id: original.customer_id,
        customer_name: original.customer_name,
        customer_email: original.customer_email,
        customer_phone: original.customer_phone,
        customer_company: original.customer_company,
        billing_address: original.billing_address,
        shipping_address: original.shipping_address,
        tax_rate: original.tax_rate,
        pricing_reference: original.pricing_reference,
        notes: original.notes,
        customer_notes: original.customer_notes,
        status: "draft",
        created_by: user.id,
      };

      const { data: newQuote, error: createError } = await supabase
        .from("quotes")
        .insert([duplicateData])
        .select()
        .single();

      if (createError) throw createError;

      // Duplicate line items
      if (originalLineItems && originalLineItems.length > 0) {
        const newLineItems = originalLineItems.map((item: any) => ({
          quote_id: newQuote.id,
          company_id: profile.company_id,
          line_number: item.line_number,
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          decoration_method: item.decoration_method,
          decoration_location: item.decoration_location,
          artwork_url: item.artwork_url,
          notes: item.notes,
        }));

        await supabase
          .from("quote_line_items")
          .insert(newLineItems);
      }

      return new Response(
        JSON.stringify({ quote: newQuote }),
        {
          status: 201,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // POST /quotes/:id/send
    if (action === "send") {
      const body = await req.json();

      // Check if quote exists
      const { data: quote, error: fetchError } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!quote) throw new Error("Quote not found");

      // Generate approval token
      const approvalToken = crypto.randomUUID() + "-" + Date.now().toString(36);
      const expiresAt = body.expires_in_days
        ? new Date(Date.now() + body.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Create approval record
      const { data: approval, error: approvalError } = await supabase
        .from("quote_approvals")
        .insert([{
          quote_id: quoteId,
          company_id: profile.company_id,
          approval_token: approvalToken,
          expires_at: expiresAt,
          single_use: body.single_use !== false,
          auto_approve_after_days: body.auto_approve_after_days || null,
          auto_convert_on_approval: body.auto_convert_on_approval || false,
          created_by: user.id,
        }])
        .select()
        .single();

      if (approvalError) throw approvalError;

      // Update quote status to sent
      await supabase
        .from("quotes")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", quoteId);

      // Generate public approval URL - use app URL instead of edge function URL
      const appUrl = Deno.env.get("APP_URL") || req.headers.get("origin") || supabaseUrl;
      const approvalUrl = `${appUrl}/quote-approval/${approvalToken}`;

      // Send email with template or default
      try {
        let subject = `Quote ${quote.quote_number} - Review and Approve`;
        let html = `
          <p>Hello ${quote.customer_name || 'valued customer'},</p>
          <p>Your quote ${quote.quote_number} is ready for review.</p>
          <p><strong>Total: $${(quote.total || 0).toFixed(2)}</strong></p>
          <p>
            <a href="${approvalUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View and Approve Quote
            </a>
          </p>
          ${expiresAt ? `<p><small>This link expires on ${new Date(expiresAt).toLocaleDateString()}</small></p>` : ''}
          <p>Thank you for your business!</p>
        `;

        // If template_id is provided, use the communication template
        if (body.template_id) {
          const { data: template } = await supabase
            .from("communication_templates")
            .select("*")
            .eq("id", body.template_id)
            .eq("company_id", profile.company_id)
            .maybeSingle();

          if (template) {
            // Build context for shortcode processing
            const context = {
              quote: {
                ...quote,
                approval_url: approvalUrl,
                expires_at: expiresAt,
              },
              custom_message: body.custom_message || '',
            };

            // Process shortcodes via communication-templates edge function
            const shortcodeResponse = await fetch(
              `${supabaseUrl}/functions/v1/communication-templates/process`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${supabaseServiceKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  template_id: template.id,
                  context,
                }),
              }
            );

            if (shortcodeResponse.ok) {
              const processed = await shortcodeResponse.json();
              subject = processed.subject || subject;
              html = processed.body_html || html;
            }
          }
        }

        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: quote.customer_email,
            subject,
            html,
            company_id: profile.company_id,
          }),
        });

        if (!emailResponse.ok) {
          console.error('Failed to send email:', await emailResponse.text());
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail the whole request if email fails
      }

      return new Response(
        JSON.stringify({
          approval,
          approvalUrl,
          message: "Quote sent successfully",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // POST /quotes/:id/approve
    if (action === "approve") {
      const { data: quote, error: fetchError } = await supabaseAdmin
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!quote) throw new Error("Quote not found");
      if (quote.status === "approved") {
        throw new Error("Quote is already approved");
      }

      const body = await req.json();
      const approverName = body.approver_name || profile.full_name || profile.email;

      // Get line items
      const { data: lineItems } = await supabaseAdmin
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("line_number");

      // Generate work order number
      const { data: existingWOs } = await supabaseAdmin
        .from("work_orders")
        .select("work_order_number")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(1);

      let workOrderNumber: string;
      if (existingWOs && existingWOs.length > 0) {
        const lastNumber = existingWOs[0].work_order_number;
        const match = lastNumber.match(/WO-(\d+)/);
        const nextNum = match ? parseInt(match[1]) + 1 : 1;
        workOrderNumber = `WO-${String(nextNum).padStart(6, '0')}`;
      } else {
        workOrderNumber = "WO-000001";
      }

      // Generate invoice number
      const { data: existingInvoices } = await supabaseAdmin
        .from("invoices")
        .select("invoice_number")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false })
        .limit(1);

      let invoiceNumber: string;
      if (existingInvoices && existingInvoices.length > 0) {
        const lastNumber = existingInvoices[0].invoice_number;
        const match = lastNumber.match(/INV-(\d+)/);
        const nextNum = match ? parseInt(match[1]) + 1 : 1;
        invoiceNumber = `INV-${String(nextNum).padStart(6, '0')}`;
      } else {
        invoiceNumber = "INV-000001";
      }

      // Create work order
      const { data: workOrder, error: woError } = await supabaseAdmin
        .from("work_orders")
        .insert([{
          work_order_number: workOrderNumber,
          company_id: profile.company_id,
          quote_id: quoteId,
          customer_name: quote.customer_name,
          customer_email: quote.customer_email,
          customer_company: quote.customer_company,
          customer_phone: quote.customer_phone,
          status: "Pending Scheduling",
          production_due_date: quote.production_due_date,
          customer_due_date: quote.customer_due_date,
          notes: quote.production_notes || quote.notes,
          created_by: user.id,
        }])
        .select()
        .single();

      if (woError) throw new Error("Failed to create work order: " + woError.message);

      // Create work order line items
      if (lineItems && lineItems.length > 0) {
        const woLineItems = lineItems
          .filter((item: any) => item.line_type === "item" || !item.line_type)
          .map((item: any) => ({
            work_order_id: workOrder.id,
            company_id: profile.company_id,
            line_number: item.line_number,
            line_type: "garment",
            item_number: item.item_number,
            description: item.description,
            color: item.color,
            qty_yxs: item.qty_yxs || 0,
            qty_ys: item.qty_ys || 0,
            qty_ym: item.qty_ym || 0,
            qty_yl: item.qty_yl || 0,
            qty_yxl: item.qty_yxl || 0,
            qty_xs: item.qty_xs || 0,
            qty_s: item.qty_s || 0,
            qty_m: item.qty_m || 0,
            qty_l: item.qty_l || 0,
            qty_xl: item.qty_xl || 0,
            qty_2xl: item.qty_2xl || 0,
            qty_3xl: item.qty_3xl || 0,
            qty_4xl: item.qty_4xl || 0,
            notes: item.notes,
          }));

        await supabaseAdmin.from("work_order_line_items").insert(woLineItems);
      }

      // Create invoice
      const { data: invoice, error: invError } = await supabaseAdmin
        .from("invoices")
        .insert([{
          invoice_number: invoiceNumber,
          company_id: profile.company_id,
          quote_id: quoteId,
          work_order_id: workOrder.id,
          customer_name: quote.customer_name,
          customer_email: quote.customer_email,
          customer_company: quote.customer_company,
          customer_phone: quote.customer_phone,
          bill_company: quote.bill_company,
          bill_name: quote.bill_name,
          bill_address_1: quote.bill_address_1,
          bill_address_2: quote.bill_address_2,
          bill_city: quote.bill_city,
          bill_state: quote.bill_state,
          bill_zip: quote.bill_zip,
          bill_phone: quote.bill_phone,
          bill_email: quote.bill_email,
          ship_company: quote.ship_company,
          ship_name: quote.ship_name,
          ship_address_1: quote.ship_address_1,
          ship_address_2: quote.ship_address_2,
          ship_city: quote.ship_city,
          ship_state: quote.ship_state,
          ship_zip: quote.ship_zip,
          subtotal: quote.subtotal,
          tax_rate: quote.tax_rate,
          tax_amount: quote.tax_amount,
          discount_amount: quote.discount_amount,
          total: quote.total,
          balance_due: quote.total,
          status: "open",
          status_stage: "unpaid",
          invoice_date: new Date().toISOString(),
          payment_due_date: quote.payment_due_date,
          terms: quote.terms,
          notes: quote.customer_notes,
          created_by: user.id,
        }])
        .select()
        .single();

      if (invError) throw new Error("Failed to create invoice: " + invError.message);

      // Create invoice line items
      if (lineItems && lineItems.length > 0) {
        const invLineItems = lineItems.map((item: any) => ({
          invoice_id: invoice.id,
          company_id: profile.company_id,
          line_number: item.line_number,
          line_type: item.line_type || "item",
          item_number: item.item_number,
          description: item.description,
          quantity: (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
                    (item.qty_yl || 0) + (item.qty_yxl || 0) + (item.qty_xs || 0) +
                    (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) +
                    (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
                    (item.qty_4xl || 0),
          unit_price: item.unit_price,
          total_price: item.total_price,
        }));

        await supabaseAdmin.from("invoice_line_items").insert(invLineItems);
      }

      // Stage garment requirements
      const garmentLineItems = lineItems?.filter((item: any) =>
        item.line_type === "item" || !item.line_type
      ) || [];

      for (const garment of garmentLineItems) {
        await supabaseAdmin.from("garment_requirements_staging").insert([{
          company_id: profile.company_id,
          quote_id: quoteId,
          work_order_id: workOrder.id,
          item_number: garment.item_number,
          description: garment.description,
          color: garment.color,
          qty_yxs: garment.qty_yxs || 0,
          qty_ys: garment.qty_ys || 0,
          qty_ym: garment.qty_ym || 0,
          qty_yl: garment.qty_yl || 0,
          qty_yxl: garment.qty_yxl || 0,
          qty_xs: garment.qty_xs || 0,
          qty_s: garment.qty_s || 0,
          qty_m: garment.qty_m || 0,
          qty_l: garment.qty_l || 0,
          qty_xl: garment.qty_xl || 0,
          qty_2xl: garment.qty_2xl || 0,
          qty_3xl: garment.qty_3xl || 0,
          qty_4xl: garment.qty_4xl || 0,
          supplier_id: garment.supplier_id,
          supplier_name: garment.supplier_name,
          status: "pending",
        }]);
      }

      // Add to billing queue
      await supabaseAdmin.from("billing_queue").insert([{
        company_id: profile.company_id,
        invoice_id: invoice.id,
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        amount: quote.total,
        status: "pending",
      }]);

      // Update quote status
      await supabaseAdmin
        .from("quotes")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by_name: approverName,
          converted_at: new Date().toISOString(),
        })
        .eq("id", quoteId);

      // Log activity
      await supabaseAdmin
        .from("quote_activity_log")
        .insert([{
          quote_id: quoteId,
          company_id: profile.company_id,
          action: "manually_approved",
          performed_by: user.id,
          performed_by_name: approverName,
          meta: {
            work_order_number: workOrderNumber,
            invoice_number: invoiceNumber,
          },
        }]);

      return new Response(
        JSON.stringify({
          success: true,
          work_order: workOrder,
          invoice: invoice,
          message: "Quote approved successfully",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // POST /quotes/:id/convert
    if (action === "convert") {
      // Check if quote is approved
      const { data: quote, error: fetchError } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!quote) throw new Error("Quote not found");
      if (quote.status !== "approved") {
        throw new Error("Only approved quotes can be converted");
      }
      if (quote.converted_at) {
        throw new Error("Quote has already been converted");
      }

      // TODO: Create production job record
      // This is where you would create a record in your production_jobs table
      // For now, we'll just mark the quote as converted

      const productionJobId = crypto.randomUUID();

      await supabase
        .from("quotes")
        .update({
          status: "converted",
          converted_at: new Date().toISOString(),
          production_job_id: productionJobId,
        })
        .eq("id", quoteId);

      // Log activity
      await supabase
        .from("quote_activity_log")
        .insert([{
          quote_id: quoteId,
          company_id: profile.company_id,
          action: "converted_to_production",
          performed_by: user.id,
          performed_by_name: profile.full_name || profile.email,
          meta: { production_job_id: productionJobId },
        }]);

      return new Response(
        JSON.stringify({
          success: true,
          production_job_id: productionJobId,
          message: "Quote converted to production job",
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
