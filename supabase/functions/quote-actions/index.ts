import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { renderTemplate, type ShortCodeData } from "../_shared/shortcode-engine.ts";

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

    console.log('Auth header check:', {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20),
    });

    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase clients
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Use service role key to verify the JWT manually since verify_jwt is false
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    console.log('User verification result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      error: userError?.message,
    });

    if (userError || !user) {
      console.error('Failed to get user from JWT:', userError);
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          details: userError?.message || "Unable to verify user",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create authenticated client for user-scoped operations
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

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

      // Duplicate line items with ALL fields
      if (originalLineItems && originalLineItems.length > 0) {
        console.log(`[DUPLICATE] Found ${originalLineItems.length} line items to duplicate`);

        const newLineItems = originalLineItems.map((item: any) => ({
          quote_id: newQuote.id,
          company_id: profile.company_id,
          line_number: item.line_number,
          line_type: item.line_type,
          group_label: item.group_label,
          item_number: item.item_number,
          sku: item.sku,
          description: item.description,
          color: item.color,
          size_mode: item.size_mode,
          quantity: item.quantity,
          // All size columns
          qty_yxs: item.qty_yxs,
          qty_ys: item.qty_ys,
          qty_ym: item.qty_ym,
          qty_yl: item.qty_yl,
          qty_yxl: item.qty_yxl,
          qty_xs: item.qty_xs,
          qty_s: item.qty_s,
          qty_m: item.qty_m,
          qty_l: item.qty_l,
          qty_xl: item.qty_xl,
          qty_2xl: item.qty_2xl,
          qty_3xl: item.qty_3xl,
          qty_4xl: item.qty_4xl,
          // Pricing
          unit_price: item.unit_price,
          total_price: item.total_price,
          wholesale_price: item.wholesale_price,
          retail_price: item.retail_price,
          garment_unit_price: item.garment_unit_price,
          // Supplier info
          supplier_name: item.supplier_name,
          brand: item.brand,
          color_code: item.color_code,
          supplier_metadata: item.supplier_metadata,
          stock_availability: item.stock_availability,
          supplier_partid: item.supplier_partid,
          // Images
          garment_image_url: item.garment_image_url,
          garment_front_image_url: item.garment_front_image_url,
          garment_back_image_url: item.garment_back_image_url,
          garment_side_image_url: item.garment_side_image_url,
          garment_rear_image_url: item.garment_rear_image_url,
          garment_lifestyle_image_url: item.garment_lifestyle_image_url,
          garment_sleeve_image_url: item.garment_sleeve_image_url,
          garment_image_lifestyle_url: item.garment_image_lifestyle_url,
          garment_image_rear_url: item.garment_image_rear_url,
          garment_image_side_url: item.garment_image_side_url,
          garment_images_data: item.garment_images_data,
          // Decoration
          decoration_method: item.decoration_method,
          decoration_location: item.decoration_location,
          artwork_url: item.artwork_url,
          notes: item.notes,
        }));

        const { data: insertedLineItems, error: lineItemsError } = await supabaseAdmin
          .from("quote_line_items")
          .insert(newLineItems)
          .select();

        if (lineItemsError) {
          console.error('[DUPLICATE] Error inserting line items:', lineItemsError);
          throw new Error(`Failed to duplicate line items: ${lineItemsError.message}`);
        }

        console.log(`[DUPLICATE] Successfully inserted ${insertedLineItems?.length || 0} line items`);

        // Create a mapping of old line item IDs to new line item IDs
        const lineItemIdMap = new Map();
        if (insertedLineItems) {
          originalLineItems.forEach((oldItem: any, index: number) => {
            lineItemIdMap.set(oldItem.id, insertedLineItems[index].id);
          });
        }

        // Duplicate imprints
        const { data: originalImprints } = await supabaseAdmin
          .from("quote_imprints")
          .select("*")
          .eq("quote_id", quoteId)
          .order("sort_order");

        if (originalImprints && originalImprints.length > 0) {
          console.log(`[DUPLICATE] Found ${originalImprints.length} imprints to duplicate`);

          const newImprints = originalImprints.map((imprint: any) => ({
            quote_id: newQuote.id,
            company_id: profile.company_id,
            type_of_work: imprint.type_of_work,
            imprint_number: imprint.imprint_number,
            location: imprint.location,
            group_label: imprint.group_label,
            thread_ink_color: imprint.thread_ink_color,
            num_colors: imprint.num_colors,
            artwork_url: imprint.artwork_url,
            artwork_images: imprint.artwork_images,
            garment_images: imprint.garment_images,
            price_matrix_id: imprint.price_matrix_id,
            price: imprint.price,
            details: imprint.details,
            mockups: imprint.mockups,
            sort_order: imprint.sort_order,
            matrix: imprint.matrix,
            column_number: imprint.column_number,
            pricing_matrix_column: imprint.pricing_matrix_column,
          }));

          const { data: insertedImprints, error: imprintsError } = await supabaseAdmin
            .from("quote_imprints")
            .insert(newImprints)
            .select();

          if (imprintsError) {
            console.error('[DUPLICATE] Error inserting imprints:', imprintsError);
            throw new Error(`Failed to duplicate imprints: ${imprintsError.message}`);
          }

          console.log(`[DUPLICATE] Successfully inserted ${insertedImprints?.length || 0} imprints`);

          // Duplicate proofs if any (non-critical - don't fail duplication if proofs fail)
          try {
            const { data: originalProofs } = await supabaseAdmin
              .from("proofs")
              .select("*")
              .eq("quote_id", quoteId);

            if (originalProofs && originalProofs.length > 0 && insertedImprints) {
              console.log(`[DUPLICATE] Found ${originalProofs.length} proofs to duplicate`);

              const imprintIdMap = new Map();
              originalImprints.forEach((oldImprint: any, index: number) => {
                imprintIdMap.set(oldImprint.id, insertedImprints[index].id);
              });

              const newProofs = originalProofs.map((proof: any) => ({
                quote_id: newQuote.id,
                company_id: profile.company_id,
                customer_id: proof.customer_id,
                line_item_id: lineItemIdMap.get(proof.line_item_id) || null,
                imprint_id: imprintIdMap.get(proof.imprint_id) || null,
                proof_number: proof.proof_number,
                proof_version: proof.proof_version,
                garment_image_url: proof.garment_image_url,
                garment_name: proof.garment_name,
                garment_brand: proof.garment_brand,
                garment_description: proof.garment_description,
                composite_image_url: proof.composite_image_url,
                print_width: proof.print_width,
                print_height: proof.print_height,
                print_depth: proof.print_depth,
                print_unit: proof.print_unit,
                status: "draft",
                notes: proof.notes,
                type_of_work: proof.type_of_work,
                decoration_location_id: proof.decoration_location_id,
                pricing_matrix_id: proof.pricing_matrix_id,
                pricing_matrix_column: proof.pricing_matrix_column,
                imprint_unit_price: proof.imprint_unit_price,
                imprint_setup_fee: proof.imprint_setup_fee,
                group_label: proof.group_label,
                selected_colors: proof.selected_colors,
                created_by: user.id,
              }));

              const { error: proofsError } = await supabaseAdmin
                .from("proofs")
                .insert(newProofs);

              if (proofsError) {
                console.error('[DUPLICATE] Error inserting proofs (non-critical):', proofsError);
              } else {
                console.log(`[DUPLICATE] Successfully inserted ${newProofs.length} proofs`);
              }
            }
          } catch (proofsError: any) {
            console.error('[DUPLICATE] Non-critical error duplicating proofs:', proofsError.message);
          }
        }
      }

      // Duplicate fees
      const { data: originalFees } = await supabaseAdmin
        .from("quote_fees")
        .select("*")
        .eq("quote_id", quoteId)
        .order("line_number");

      if (originalFees && originalFees.length > 0) {
        console.log(`[DUPLICATE] Found ${originalFees.length} fees to duplicate`);

        const newFees = originalFees.map((fee: any) => ({
          quote_id: newQuote.id,
          company_id: profile.company_id,
          line_number: fee.line_number,
          fee_type: fee.fee_type,
          description: fee.description,
          amount: fee.amount,
          is_taxable: fee.is_taxable,
          notes: fee.notes,
        }));

        const { error: feesError } = await supabaseAdmin
          .from("quote_fees")
          .insert(newFees);

        if (feesError) {
          console.error('[DUPLICATE] Error inserting fees:', feesError);
          throw new Error(`Failed to duplicate fees: ${feesError.message}`);
        }

        console.log(`[DUPLICATE] Successfully inserted ${newFees.length} fees`);
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

      // Get company settings to retrieve the inkops subdomain (use admin client to bypass RLS)
      const { data: companySettings } = await supabaseAdmin
        .from("company_settings")
        .select("inkops_subdomain")
        .eq("id", profile.company_id)
        .maybeSingle();

      // Generate public approval URL using company subdomain
      const subdomain = companySettings?.inkops_subdomain || 'app';
      const approvalUrl = `https://${subdomain}.inkops.ink/quote-approval/${approvalToken}`;

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
            // Build shortcode data for template processing
            const shortcodeData: ShortCodeData = {
              customer_first_name: quote.customer_name?.split(' ')[0] || '',
              customer_last_name: quote.customer_name?.split(' ').slice(1).join(' ') || '',
              customer_full_name: quote.customer_name || '',
              customer_company: quote.customer_company || '',
              customer_email: quote.customer_email || '',
              customer_phone: quote.customer_phone || '',
              quote_number: quote.quote_number || '',
              quote_total: quote.total?.toFixed(2) || '0.00',
              quote_subtotal: quote.subtotal?.toFixed(2) || '0.00',
              quote_tax: quote.tax_amount?.toFixed(2) || '0.00',
              quote_link: approvalUrl,
              quote_date: quote.created_at ? new Date(quote.created_at).toLocaleDateString() : '',
              quote_expiry_date: expiresAt ? new Date(expiresAt).toLocaleDateString() : '',
              current_date: new Date().toLocaleDateString(),
              current_year: new Date().getFullYear().toString(),
            };

            // Process shortcodes in subject and body
            subject = renderTemplate(template.subject_template, shortcodeData);
            html = renderTemplate(template.body_template, shortcodeData);
          }
        }

        console.log('Attempting to send email to:', quote.customer_email);
        console.log('Email payload:', {
          to: quote.customer_email,
          subject,
          hasHtml: !!html,
          company_id: profile.company_id,
        });

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
          const errorText = await emailResponse.text();
          console.error('Failed to send email:', errorText);
          throw new Error(`Email sending failed: ${errorText}`);
        }

        const emailResult = await emailResponse.json();
        console.log('Email sent successfully:', emailResult);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        throw new Error(`Failed to send quote email: ${emailError.message || 'Unknown error'}`);
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

      const garmentItems = lineItems?.filter((item: any) => item.line_type === "item" || !item.line_type) || [];
      const totalQuantity = garmentItems.reduce((sum: number, item: any) => sum + (sumQty(item) || item.quantity || 0), 0);

      // Check if work order already exists
      let workOrder;
      const { data: existingWorkOrder } = await supabaseAdmin
        .from("work_orders")
        .select("*")
        .eq("quote_id", quoteId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (existingWorkOrder) {
        console.log("Work order already exists, using existing:", existingWorkOrder.id);
        workOrder = existingWorkOrder;
      } else {
        const { data: newWorkOrder, error: woError } = await supabaseAdmin
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
            total_quantity: totalQuantity,
            notes: quote.production_notes || quote.notes,
          }])
          .select()
          .single();

        if (woError) throw new Error("Failed to create work order: " + woError.message);
        workOrder = newWorkOrder;
      }

      // Only insert work order line items if they don't already exist
      if (!existingWorkOrder && lineItems && lineItems.length > 0) {
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

      // Check if invoice already exists
      const invoiceId = invoiceNumber;
      let invoice;
      const { data: existingInvoice } = await supabaseAdmin
        .from("printavo_invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (existingInvoice) {
        console.log("Invoice already exists, using existing:", existingInvoice.id);
        invoice = existingInvoice;
      } else {
        const { data: newInvoice, error: invError } = await supabaseAdmin
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
        invoice = newInvoice;
      }

      // Only insert invoice line items if invoice was just created
      if (!existingInvoice && lineItems && lineItems.length > 0) {
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

      // Only insert garment requirements if work order was just created
      if (!existingWorkOrder) {
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
      }

      // Only insert schedule entries if work order was just created
      if (!existingWorkOrder && imprints && imprints.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const quoteDueDate = quote.production_due_date || quote.customer_due_date || today;
        const dueDate = quoteDueDate >= today ? quoteDueDate : today;
        const totalQtyAll = lineItems?.reduce((sum: number, li: any) => sum + (sumQty(li) || li.quantity || 0), 0) || 0;

        console.log(`Creating ${imprints.length} schedule entries for quote ${quote.quote_number}`);

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

        console.log("Schedule entries to insert:", JSON.stringify(scheduleEntries, null, 2));

        const { data: insertedSchedule, error: schedError } = await supabaseAdmin
          .from("production_schedule_entries")
          .insert(scheduleEntries)
          .select();

        if (schedError) {
          console.error("CRITICAL: Failed to create schedule entries:", schedError);
          throw new Error(`Failed to create schedule entries: ${schedError.message}`);
        }

        console.log(`Successfully created ${insertedSchedule?.length || 0} schedule entries`);
      }

      // Check if billing queue entry already exists
      const { data: existingBillingQueue } = await supabaseAdmin
        .from("billing_queue")
        .select("*")
        .eq("printavo_invoice_id", invoiceId)
        .eq("company_id", profile.company_id)
        .maybeSingle();

      if (!existingBillingQueue) {
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
      }

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
