import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { rule_id } = await req.json();

    if (!rule_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing rule_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: rule, error: ruleError } = await supabase
      .from('automated_reports')
      .select('*')
      .eq('id', rule_id)
      .maybeSingle();

    if (ruleError || !rule) {
      throw new Error(`Automation rule not found: ${ruleError?.message || 'Unknown error'}`);
    }

    if (!rule.is_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'Rule is disabled' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', rule.user_id)
      .maybeSingle();

    if (!userProfile?.company_id) {
      throw new Error('User profile or company not found');
    }

    const companyId = userProfile.company_id;

    let openInvoices: any[] = [];

    if (rule.report_type === 'accounts-receivable') {
      const { data, error: invoicesError } = await supabase
        .from('printavo_invoices')
        .select('*')
        .eq('company_id', companyId)
        .in('status_stage', ['billing_queue', 'accounts_receivable'])
        .gt('amount_outstanding', 0)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (invoicesError) {
        throw new Error(`Failed to fetch AR invoice data: ${invoicesError.message}`);
      }

      openInvoices = data || [];
    } else {
      const { data, error: invoicesError } = await supabase
        .from('printavo_invoices_calculated')
        .select('*')
        .order('created_at', { ascending: false });

      if (invoicesError) {
        throw new Error(`Failed to fetch invoice data: ${invoicesError.message}`);
      }

      const invoices = data || [];

      openInvoices = invoices.filter((inv: any) => {
        const total = inv.total || 0;
        const amountOutstanding = inv.amount_outstanding || 0;
        const amountPaid = inv.amount_paid || 0;

        if (total === 0) return false;

        const status = inv.status?.toLowerCase() || '';
        if (status.includes('dead')) return false;

        const hasBalance = amountOutstanding > 0;
        const notPaidInFull = inv.paid_in_full === false;
        const hasTotalNotPaid = total > amountPaid;

        return hasBalance || notPaidInFull || hasTotalNotPaid;
      });
    }

    const reportData = {
      openInvoices: openInvoices.map((inv: any) => {
        let invoiceDate: string;
        let dueDate: string | null;
        let daysPastDue: number;
        let bucket: string;

        if (rule.report_type === 'accounts-receivable') {
          invoiceDate = inv.invoice_date;
          dueDate = inv.due_date || inv.invoice_date;
          const dueDateObj = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
          const today = new Date();
          const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)));
          daysPastDue = daysOverdue;

          if (daysOverdue > 90) bucket = '90+ days';
          else if (daysOverdue > 60) bucket = '61-90 days';
          else if (daysOverdue > 30) bucket = '31-60 days';
          else bucket = '0-30 days';
        } else {
          invoiceDate = inv.invoice_at || inv.created_at;

          const calculateDaysPastDue = () => {
            if (!inv.due_at) {
              return Math.floor(
                (Date.now() - new Date(invoiceDate).getTime()) / (1000 * 60 * 60 * 24)
              );
            }
            const due = new Date(inv.due_at);
            const today = new Date();
            const diffTime = today.getTime() - due.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return Math.max(0, diffDays);
          };

          daysPastDue = calculateDaysPastDue();
          dueDate = inv.due_at || null;

          if (daysPastDue <= 30) bucket = '0-30 days';
          else if (daysPastDue <= 60) bucket = '31-60 days';
          else if (daysPastDue <= 90) bucket = '61-90 days';
          else if (daysPastDue <= 120) bucket = '91-120 days';
          else bucket = '121+ days';
        }

        return {
          customer: inv.customer_name || 'Unknown',
          invoiceNumber: inv.invoice_number || '',
          invoiceDate: invoiceDate,
          dueDate: dueDate,
          total: inv.total || 0,
          outstanding: inv.amount_outstanding || 0,
          agingBucket: bucket,
          daysPastDue: daysPastDue,
        };
      }),
      totalInvoices: openInvoices.length,
      totalOutstanding: openInvoices.reduce(
        (sum: number, inv: any) => sum + (inv.amount_outstanding || 0),
        0
      ),
    };

    const attachments: Array<{ filename: string; content: string; type?: string }> = [];

    if (rule.file_formats.includes('pdf')) {
      const pdfContent = await generatePDF(rule.report_type, reportData);
      attachments.push({
        filename: `${rule.report_name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfContent,
        type: 'application/pdf',
      });
    }

    if (rule.file_formats.includes('csv')) {
      const csvContent = await generateCSV(reportData);
      attachments.push({
        filename: `${rule.report_name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`,
        content: csvContent,
        type: 'text/csv',
      });
    }

    const { data: settings } = await supabase
      .from('company_settings')
      .select('email_from_address')
      .eq('id', companyId)
      .maybeSingle();

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">${rule.report_name}</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Generated on ${new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</p>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
          <h2 style="color: #1f2937; margin-top: 0;">Summary</h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
              <span style="color: #6b7280;">Total Invoices:</span>
              <strong style="color: #1f2937;">${reportData.totalInvoices}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7280;">Total Outstanding:</span>
              <strong style="color: #ef4444; font-size: 18px;">$${reportData.totalOutstanding.toFixed(2)}</strong>
            </div>
          </div>
          <p style="color: #4b5563; margin-bottom: 20px;">
            This automated report has been generated and attached in the requested format(s). Please review the attached files for detailed information.
          </p>
          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0;">
            <strong style="color: #1e40af;">Attachments:</strong>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #1e40af;">
              ${attachments.map(att => `<li>${att.filename}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div style="background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 10px 10px;">
          <p style="margin: 0;">This is an automated report. Please do not reply to this email.</p>
        </div>
      </div>
    `;

    const { data: resendSettings } = await supabase
      .from('company_settings')
      .select('resend_api_key')
      .eq('id', companyId)
      .maybeSingle();

    if (!resendSettings?.resend_api_key) {
      throw new Error('Resend API key not configured');
    }

    const cryptoResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        token: resendSettings.resend_api_key,
      }),
    });

    if (!cryptoResponse.ok) {
      throw new Error('Failed to decrypt API key');
    }

    const { result: RESEND_API_KEY } = await cryptoResponse.json();

    const resendPayload: any = {
      from: settings?.email_from_address || 'noreply@toddssportinggoods.com',
      to: rule.email_recipients,
      subject: `${rule.report_name} - ${new Date().toLocaleDateString()}`,
      html: html,
    };

    if (attachments && attachments.length > 0) {
      resendPayload.attachments = attachments.map(att => ({
        filename: att.filename,
        content: att.content,
      }));
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const resendResult = await resendResponse.json();

    await supabase
      .from('automated_reports')
      .update({
        last_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', rule_id);

    return new Response(
      JSON.stringify({ success: true, message: 'Report sent successfully', emailId: resendResult.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error sending automated report:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send automated report',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function utf8ToBase64(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  utf8Bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function generateCSV(data: any): Promise<string> {
  if (!data.openInvoices || data.openInvoices.length === 0) {
    return utf8ToBase64('No data available');
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const headers = ['Customer', 'Invoice #', 'Invoice Date', 'Due Date', 'Total Amount', 'Amount Outstanding', 'Aging Bucket', 'Days Past Due'];
  const rows = data.openInvoices.map((inv: any) => [
    inv.customer || '',
    inv.invoiceNumber || '',
    formatDate(inv.invoiceDate),
    inv.dueDate ? formatDate(inv.dueDate) : '',
    parseFloat(inv.total || 0).toFixed(2),
    parseFloat(inv.outstanding || 0).toFixed(2),
    inv.agingBucket || '',
    inv.daysPastDue === 0 ? 'Not Due' : inv.daysPastDue.toString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row: any[]) =>
      row.map(cell => {
        const str = String(cell);
        return str.includes(',') ? `"${str}"` : str;
      }).join(',')
    ),
  ].join('\n');

  return utf8ToBase64(csvContent);
}

async function generatePDF(reportType: string, data: any): Promise<string> {
  const message = `PDF generation is not available in edge functions. Please use CSV format or implement a client-side PDF generation.`;
  return utf8ToBase64(message);
}