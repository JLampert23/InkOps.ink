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
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Not authenticated");
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

      // Generate public approval URL
      const approvalUrl = `${supabaseUrl}/functions/v1/quote-approval/${approvalToken}`;

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
