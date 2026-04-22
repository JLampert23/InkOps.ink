import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendInvoiceRequest {
  invoice_id: string;
  recipient_email?: string;
  subject?: string;
  message?: string;
  auto_send?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invoice_id, recipient_email, subject, message, auto_send = false }: SendInvoiceRequest = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get invoice details with line items
    const { data: invoice, error: invoiceError } = await supabase
      .from("printavo_invoices")
      .select("*")
      .eq("id", invoice_id)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get line items
    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoice_id)
      .order("line_number");

    // Get company settings for sender info
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name, company_email, email_from_address, resend_api_key, invoice_terms, company_logo_primary_url")
      .maybeSingle();

    // Fetch contact name if invoice has a contact_id
    let contactName: string | null = null;
    if (invoice.contact_id) {
      const { data: contact } = await supabase
        .from("customer_contacts")
        .select("full_name")
        .eq("id", invoice.contact_id)
        .maybeSingle();
      contactName = contact?.full_name || null;
    }
    const greetingName = contactName || invoice.customer_name || "Customer";

    if (!companySettings?.resend_api_key) {
      return new Response(
        JSON.stringify({ error: "Email service not configured. Please add Resend API key in settings." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const recipientEmailAddress = recipient_email || invoice.customer_email;

    if (!recipientEmailAddress) {
      return new Response(
        JSON.stringify({ error: "No recipient email address provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const formatCurrency = (value: number | null | undefined): string => {
      return (value ?? 0).toFixed(2);
    };

    // Build line items table for email
    const lineItemsHtml = lineItems
      ?.map(
        (item: any) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.description || ''}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${item.quantity ?? 0}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">$${formatCurrency(item.unit_price)}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">$${formatCurrency(item.total)}</td>
        </tr>
      `
      )
      .join("");

    const emailSubject =
      subject ||
      `Invoice ${invoice.invoice_number} from ${companySettings.company_name || "Your Company"}`;

    const emailMessage =
      message ||
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Invoice ${invoice.invoice_number}</h2>

        <p>Dear ${greetingName},</p>

        <p>Please find your invoice details below:</p>

        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
          <p style="margin: 5px 0;"><strong>Invoice Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
          <p style="margin: 5px 0;"><strong>Due Date:</strong> ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A"}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${invoice.status_stage === "paid" ? "#10b981" : "#ef4444"}; font-weight: bold;">${invoice.status_stage.toUpperCase()}</span></p>
        </div>

        ${lineItems && lineItems.length > 0
          ? `
        <h3 style="color: #1f2937;">Invoice Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #3b82f6; color: white;">
              <th style="padding: 10px; text-align: left;">Description</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Unit Price</th>
              <th style="padding: 10px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>
        `
          : ""
        }

        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: right;">
          <p style="margin: 5px 0;"><strong>Subtotal:</strong> $${formatCurrency(invoice.subtotal)}</p>
          <p style="margin: 5px 0;"><strong>Tax:</strong> $${formatCurrency(invoice.tax)}</p>
          <p style="margin: 5px 0; font-size: 18px; color: #1f2937;"><strong>Total:</strong> <strong>$${formatCurrency(invoice.total)}</strong></p>
          ${(invoice.amount_paid ?? 0) > 0
            ? `<p style="margin: 5px 0;"><strong>Amount Paid:</strong> $${formatCurrency(invoice.amount_paid)}</p>
               <p style="margin: 5px 0; font-size: 18px; color: #ef4444;"><strong>Balance Due:</strong> <strong>$${formatCurrency(invoice.amount_outstanding)}</strong></p>`
            : ""
          }
        </div>

        <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>

        <p style="margin-top: 30px;">Best regards,<br>
        <strong>${companySettings.company_name || "Your Company"}</strong></p>

        ${companySettings.company_email ? `<p style="color: #6b7280; font-size: 14px;">${companySettings.company_email}</p>` : ""}

        ${companySettings?.invoice_terms && companySettings.invoice_terms.trim() && companySettings.invoice_terms !== '<p><br></p>'
          ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
               <p style="font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">Terms &amp; Conditions</p>
               <div style="font-size: 12px; color: #9ca3af; line-height: 1.5;">${companySettings.invoice_terms}</div>
             </div>`
          : ""
        }
      </div>
    `;

    // Send email using Resend
    const fromAddress = companySettings.email_from_address || companySettings.company_email || "noreply@example.com";

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${companySettings.resend_api_key}`,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: recipientEmailAddress,
        subject: emailSubject,
        html: emailMessage,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error("Resend API error:", errorData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errorData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendData = await resendResponse.json();

    // Log the email send in activity if this is linked to a quote
    if (invoice.raw_data?.quote_id) {
      await supabase.from("quote_activity_log").insert({
        quote_id: invoice.raw_data.quote_id,
        company_id: invoice.company_id,
        action: "invoice_emailed",
        performed_by_name: auto_send ? "System" : "User",
        meta: {
          invoice_id: invoice_id,
          invoice_number: invoice.invoice_number,
          recipient: recipientEmailAddress,
          resend_id: resendData.id,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invoice sent successfully",
        email_id: resendData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending invoice:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
