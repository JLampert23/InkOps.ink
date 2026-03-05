import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function extractSubdomainFromUrl(customerUrl: string | null): string | null {
  if (!customerUrl) return null;

  try {
    const url = new URL(customerUrl.startsWith("http") ? customerUrl : `https://${customerUrl}`);
    const hostname = url.hostname;
    const parts = hostname.split(".");

    if (parts.length >= 3 && parts[parts.length - 2] === "inkops" && parts[parts.length - 1] === "ink") {
      return parts.slice(0, -2).join(".");
    }

    if (parts.length >= 2) {
      return parts[0];
    }

    return parts[0] || null;
  } catch {
    const cleanUrl = customerUrl.replace(/^https?:\/\//, "").split("/")[0];
    const parts = cleanUrl.split(".");
    return parts[0] || null;
  }
}

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
      const { data: quoteNumber } = await supabase.rpc("generate_quote_number", {
        p_company_id: profile.company_id
      });

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

      // Get company settings to get inkops_subdomain and company_name
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("inkops_subdomain, company_name")
        .eq("id", profile.company_id)
        .maybeSingle();

      // Generate public approval URL using inkops.ink subdomain (ALWAYS use inkops.ink subdomain)
      let subdomain = companySettings?.inkops_subdomain;
      if (!subdomain && companySettings?.company_name) {
        subdomain = companySettings.company_name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
      }
      const approvalUrl = subdomain
        ? `https://${subdomain}.inkops.ink/quote-approval/${approvalToken}`
        : `https://inkops.ink/quote-approval/${approvalToken}`;

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

      const { data: lineItems } = await supabaseAdmin
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("line_number");

      const { data: imprints } = await supabaseAdmin
        .from("quote_imprints")
        .select("*")
        .eq("quote_id", quoteId)
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

      const workOrderNumber = quote.quote_number;
      const invoiceNumber = quote.quote_number;

      const { data: workOrder, error: woError } = await supabaseAdmin
        .from("work_orders")
        .insert([{
          work_order_number: workOrderNumber,
          company_id: profile.company_id,
          quote_id: quoteId,
          customer_name: quote.customer_name,
          status: "Pending Scheduling",
          priority: "medium",
          production_due_date: quote.production_due_date,
          customer_due_date: quote.customer_due_date,
          notes: quote.production_notes || quote.notes,
        }])
        .select()
        .single();

      if (woError) throw new Error("Failed to create work order: " + woError.message);

      if (lineItems && lineItems.length > 0) {
        const woLineItems = lineItems
          .filter((item: any) => item.line_type === "item" || !item.line_type)
          .map((item: any) => ({
            work_order_id: workOrder.id,
            company_id: profile.company_id,
            line_number: item.line_number,
            item_type: "garment",
            description: item.description || item.item_number || "",
            style_number: item.item_number,
            color: item.color,
            quantity: sumQty(item) || item.quantity || 0,
            sizes: buildSizesJson(item),
            notes: item.notes,
          }));

        const { error: woliError } = await supabaseAdmin.from("work_order_line_items").insert(woLineItems);
        if (woliError) console.error("WO line items error:", woliError.message);
      }

      const invoiceId = invoiceNumber;
      const { data: invoice, error: invError } = await supabaseAdmin
        .from("printavo_invoices")
        .insert([{
          id: invoiceId,
          invoice_number: invoiceNumber,
          company_id: profile.company_id,
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
            source: "quote_approval",
            quote_id: quoteId,
            quote_number: quote.quote_number,
            work_order_id: workOrder.id,
            work_order_number: workOrderNumber,
            approved_by: approverName,
            terms: quote.terms,
            customer_notes: quote.customer_notes,
          },
        }])
        .select()
        .single();

      if (invError) throw new Error("Failed to create invoice: " + invError.message);

      if (lineItems && lineItems.length > 0) {
        const invLineItems = lineItems.map((item: any) => ({
          invoice_id: invoiceId,
          company_id: profile.company_id,
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

        const { error: iliError } = await supabaseAdmin.from("invoice_line_items").insert(invLineItems);
        if (iliError) console.error("Invoice line items error:", iliError.message);
      }

      const garmentLineItems = lineItems?.filter((item: any) =>
        item.line_type === "item" || !item.line_type
      ) || [];

      for (const garment of garmentLineItems) {
        const totalQty = sumQty(garment) || garment.quantity || 0;
        await supabaseAdmin.from("garment_requirements_staging").insert([{
          company_id: profile.company_id,
          quote_id: quoteId,
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
        const today = new Date().toISOString().split('T')[0];
        const quoteDueDate = quote.production_due_date || quote.customer_due_date || today;
        const dueDate = quoteDueDate >= today ? quoteDueDate : today;
        const totalQtyAll = lineItems?.reduce((sum: number, li: any) => sum + (sumQty(li) || li.quantity || 0), 0) || 0;
        const scheduleEntries = imprints.map((imp: any, idx: number) => ({
          company_id: profile.company_id,
          quote_id: quoteId,
          work_order_id: workOrder.id,
          imprint_id: imp.id,
          type_of_work: imp.type_of_work || "Screen Print",
          imprint_number: imp.imprint_number || `IMP-${idx + 1}`,
          production_due_date: dueDate,
          quantity: totalQtyAll,
          customer_name: quote.customer_name,
          quote_number: quote.quote_number,
          scheduler_column: "Unscheduled",
          colors: imp.thread_ink_color || null,
          step_statuses: {},
          priority_order: idx,
        }));

        const { error: schedError } = await supabaseAdmin.from("production_schedule_entries").insert(scheduleEntries);
        if (schedError) console.error("Schedule entries error:", schedError.message);
      }

      await supabaseAdmin.from("billing_queue").insert([{
        company_id: profile.company_id,
        printavo_invoice_id: invoiceId,
        printavo_visual_id: invoiceNumber,
        customer_name: quote.customer_name,
        customer_email: quote.customer_email,
        customer_company: quote.customer_company,
        invoice_total: quote.total || 0,
        invoice_date: new Date().toISOString(),
        payment_status: "pending",
      }]);

      await supabaseAdmin
        .from("quotes")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by_name: approverName,
          converted_at: new Date().toISOString(),
        })
        .eq("id", quoteId);

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
