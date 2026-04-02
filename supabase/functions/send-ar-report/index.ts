import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { format } from 'npm:date-fns@4.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ARInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  balance_remaining: number;
  days_overdue: number;
  aging_bucket: '0-30' | '31-60' | '61-90' | '90+';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { automation_id, company_id, manual_trigger = false } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: automation, error: automationError } = await supabase
      .from('ar_report_automations')
      .select('*')
      .eq('id', automation_id)
      .maybeSingle();

    if (automationError || !automation) {
      throw new Error('Automation not found');
    }

    const { data: company, error: companyError } = await supabase
      .from('company_settings')
      .select('company_name, resend_api_key, email_from_address')
      .eq('id', company_id)
      .maybeSingle();

    if (companyError || !company) {
      throw new Error('Company not found');
    }

    if (!company.resend_api_key || !company.email_from_address) {
      throw new Error('Email configuration not found');
    }

    let query = supabase
      .from('printavo_invoices')
      .select('*')
      .in('status_stage', ['billing_queue', 'accounts_receivable'])
      .gt('amount_outstanding', '0')
      .order('due_date', { ascending: true });

    const filters = automation.filters || {};

    if (filters.customer) {
      query = query.eq('customer_name', filters.customer);
    }

    const { data: invoicesData, error: invoicesError } = await query;

    if (invoicesError) throw invoicesError;

    const invoices: ARInvoice[] = (invoicesData || []).map((inv: any) => {
      const total = parseFloat(inv.total || 0);
      const amountPaid = parseFloat(inv.amount_paid || 0);
      const balanceRemaining = parseFloat(inv.amount_outstanding || 0);
      const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
      const today = new Date();
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

      let agingBucket: '0-30' | '31-60' | '61-90' | '90+' = '0-30';
      if (daysOverdue > 90) agingBucket = '90+';
      else if (daysOverdue > 60) agingBucket = '61-90';
      else if (daysOverdue > 30) agingBucket = '31-60';

      return {
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: inv.customer_name,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date || inv.invoice_date,
        total,
        amount_paid: amountPaid,
        balance_remaining: balanceRemaining,
        days_overdue: daysOverdue,
        aging_bucket: agingBucket,
      };
    });

    if (filters.agingBucket) {
      const filtered = invoices.filter(inv => inv.aging_bucket === filters.agingBucket);
      invoices.length = 0;
      invoices.push(...filtered);
    }

    const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance_remaining, 0);
    const totalInvoices = invoices.length;

    const columns = automation.columns || [
      'invoice_number',
      'customer_name',
      'invoice_date',
      'due_date',
      'total',
      'amount_paid',
      'balance_remaining',
      'aging_bucket',
    ];

    let reportContent = '';
    let attachmentContent = '';

    if (automation.format === 'csv') {
      const headers = columns.map((col: string) => {
        const columnNames: Record<string, string> = {
          invoice_number: 'Invoice #',
          customer_name: 'Customer',
          invoice_date: 'Invoice Date',
          due_date: 'Due Date',
          total: 'Total Amount',
          amount_paid: 'Amount Paid',
          balance_remaining: 'Balance Remaining',
          days_overdue: 'Days Overdue',
          aging_bucket: 'Aging Bucket',
        };
        return columnNames[col] || col;
      });

      const rows: string[] = [headers.map(h => `"${h}"`).join(',')];

      invoices.forEach(invoice => {
        const values = columns.map((col: string) => {
          const value = (invoice as any)[col];

          if (col === 'invoice_date' || col === 'due_date') {
            return `"${format(new Date(value), 'MM/dd/yyyy')}"`;
          }

          if (col === 'total' || col === 'amount_paid' || col === 'balance_remaining') {
            return `"$${value.toFixed(2)}"`;
          }

          return `"${value}"`;
        });

        rows.push(values.join(','));
      });

      rows.push('');
      rows.push('"Summary"');
      rows.push(`"Total Outstanding","$${totalOutstanding.toFixed(2)}"`);
      rows.push(`"Invoice Count","${totalInvoices}"`);

      attachmentContent = rows.join('\n');
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #337ab7; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .summary-item { display: flex; justify-content: space-between; padding: 5px 0; }
          .summary-label { font-weight: bold; }
          .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Accounts Receivable Report</h1>
          <p>${format(new Date(), 'MMMM dd, yyyy')}</p>
        </div>
        <div class="content">
          <h2>Summary</h2>
          <div class="summary">
            <div class="summary-item">
              <span class="summary-label">Total Outstanding:</span>
              <span>$${totalOutstanding.toFixed(2)}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Total Invoices:</span>
              <span>${totalInvoices}</span>
            </div>
          </div>
          <p>The complete report is attached to this email as a ${automation.format.toUpperCase()} file.</p>
          <p>This is an automated report generated from your accounts receivable system.</p>
        </div>
        <div class="footer">
          <p>${company.company_name || 'Your Company'}</p>
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;

    const resendApiKey = company.resend_api_key;
    const recipients = automation.recipients;

    let emailSuccess = true;
    let emailError = null;

    try {
      const emailPayload: any = {
        from: company.email_from_address,
        to: recipients,
        subject: `Accounts Receivable Report - ${format(new Date(), 'MMM dd, yyyy')}`,
        html: emailHtml,
      };

      if (automation.format === 'csv' && attachmentContent) {
        emailPayload.attachments = [{
          filename: `ar-report-${format(new Date(), 'yyyy-MM-dd')}.csv`,
          content: btoa(attachmentContent),
        }];
      }

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(emailPayload),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        throw new Error(`Email send failed: ${JSON.stringify(errorData)}`);
      }
    } catch (error) {
      emailSuccess = false;
      emailError = error.message;
    }

    await supabase
      .from('ar_report_logs')
      .insert([{
        automation_id,
        company_id,
        executed_at: new Date().toISOString(),
        format: automation.format,
        filters: automation.filters || {},
        recipients: automation.recipients,
        success: emailSuccess,
        error_message: emailError,
        invoice_count: totalInvoices,
        total_outstanding: totalOutstanding,
      }]);

    return new Response(
      JSON.stringify({
        success: emailSuccess,
        invoice_count: totalInvoices,
        total_outstanding: totalOutstanding,
        error: emailError,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});