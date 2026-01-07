import { supabase } from '../lib/supabase-client';

export interface AutomationRule {
  id: string;
  user_id: string;
  report_type: string;
  report_name: string;
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  schedule_time: string;
  schedule_timezone: string;
  schedule_day_of_week?: number;
  schedule_day_of_month?: number;
  email_recipients: string[];
  file_formats: ('pdf' | 'csv')[];
  is_enabled: boolean;
  last_sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAutomationRuleInput {
  report_type: string;
  report_name: string;
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  schedule_time: string;
  schedule_timezone: string;
  schedule_day_of_week?: number;
  schedule_day_of_month?: number;
  email_recipients: string[];
  file_formats: ('pdf' | 'csv')[];
  is_enabled: boolean;
}

export class AutomationService {
  static async listAutomationRules(): Promise<AutomationRule[]> {
    const { data, error } = await supabase
      .from('automated_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch automation rules: ${error.message}`);
    }

    return data || [];
  }

  static async getAutomationRule(id: string): Promise<AutomationRule | null> {
    const { data, error } = await supabase
      .from('automated_reports')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch automation rule: ${error.message}`);
    }

    return data;
  }

  static async createAutomationRule(rule: CreateAutomationRuleInput): Promise<AutomationRule> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('User not authenticated');
    }

    const scheduleTime = rule.schedule_time.includes(':') && rule.schedule_time.split(':').length === 2
      ? `${rule.schedule_time}:00`
      : rule.schedule_time;

    const { data, error } = await supabase
      .from('automated_reports')
      .insert({
        user_id: user.user.id,
        ...rule,
        schedule_time: scheduleTime,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create automation rule: ${error.message}`);
    }

    return data;
  }

  static async updateAutomationRule(id: string, updates: Partial<CreateAutomationRuleInput>): Promise<AutomationRule> {
    const updateData: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.schedule_time) {
      updateData.schedule_time = updates.schedule_time.includes(':') && updates.schedule_time.split(':').length === 2
        ? `${updates.schedule_time}:00`
        : updates.schedule_time;
    }

    const { data, error } = await supabase
      .from('automated_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update automation rule: ${error.message}`);
    }

    return data;
  }

  static async toggleAutomationRule(id: string, enabled: boolean): Promise<void> {
    const { error } = await supabase
      .from('automated_reports')
      .update({
        is_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to toggle automation rule: ${error.message}`);
    }
  }

  static async deleteAutomationRule(id: string): Promise<void> {
    const { error } = await supabase
      .from('automated_reports')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete automation rule: ${error.message}`);
    }
  }

  static async generateAndSendReport(ruleId: string): Promise<void> {
    const rule = await this.getAutomationRule(ruleId);
    if (!rule) {
      throw new Error('Automation rule not found');
    }

    const reportData = await this.fetchReportData(rule.report_type);

    const attachments: Array<{ filename: string; content: string; type?: string }> = [];

    if (rule.file_formats.includes('pdf')) {
      const pdfContent = await this.generatePDF(rule.report_type, reportData);
      attachments.push({
        filename: `${rule.report_name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfContent,
        type: 'application/pdf',
      });
    }

    if (rule.file_formats.includes('csv')) {
      const csvContent = await this.generateCSV(rule.report_type, reportData);
      attachments.push({
        filename: `${rule.report_name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`,
        content: csvContent,
        type: 'text/csv',
      });
    }

    await this.sendEmail(rule.email_recipients, rule.report_name, attachments, reportData);

    await supabase
      .from('automated_reports')
      .update({
        last_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ruleId);
  }

  private static async fetchReportData(reportType: string): Promise<any> {
    const { data: rawInvoices, error } = await supabase
      .from('printavo_invoices_calculated')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch invoice data: ${error.message}`);
    }

    const invoices = rawInvoices || [];

    const openInvoices = invoices.filter(inv => {
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

    const agingBuckets = [
      { name: 'current', label: '1-30 days', minDays: 0, maxDays: 30, invoices: [] as any[], total: 0, count: 0 },
      { name: '30', label: '31-60 days', minDays: 31, maxDays: 60, invoices: [] as any[], total: 0, count: 0 },
      { name: '60', label: '61-90 days', minDays: 61, maxDays: 90, invoices: [] as any[], total: 0, count: 0 },
      { name: '90', label: '91-120 days', minDays: 91, maxDays: 120, invoices: [] as any[], total: 0, count: 0 },
      { name: '120', label: '121+ days', minDays: 121, maxDays: null, invoices: [] as any[], total: 0, count: 0 },
    ];

    const formattedInvoices = openInvoices.map(inv => {
      const invoiceDate = inv.invoice_at || inv.created_at;
      const daysOutstanding = Math.floor(
        (Date.now() - new Date(invoiceDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      const calculateDaysPastDue = () => {
        if (!inv.due_at) {
          return daysOutstanding;
        }
        const due = new Date(inv.due_at);
        const today = new Date();
        const diffTime = today.getTime() - due.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
      };

      const daysPastDue = calculateDaysPastDue();

      let bucket = '';
      if (daysPastDue <= 30) {
        bucket = '0-30 days';
      } else if (daysPastDue <= 60) {
        bucket = '31-60 days';
      } else if (daysPastDue <= 90) {
        bucket = '61-90 days';
      } else if (daysPastDue <= 120) {
        bucket = '91-120 days';
      } else {
        bucket = '121+ days';
      }

      for (const agingBucket of agingBuckets) {
        if (agingBucket.maxDays === null) {
          if (daysOutstanding >= agingBucket.minDays) {
            agingBucket.invoices.push(inv);
            agingBucket.total += inv.amount_outstanding || 0;
            agingBucket.count++;
            break;
          }
        } else {
          if (daysOutstanding >= agingBucket.minDays && daysOutstanding <= agingBucket.maxDays) {
            agingBucket.invoices.push(inv);
            agingBucket.total += inv.amount_outstanding || 0;
            agingBucket.count++;
            break;
          }
        }
      }

      return {
        customer: inv.customer_name || 'Unknown',
        invoiceNumber: inv.invoice_number || '',
        invoiceDate: invoiceDate,
        dueDate: inv.due_at || null,
        total: inv.total || 0,
        outstanding: inv.amount_outstanding || 0,
        agingBucket: bucket,
        daysPastDue: daysPastDue,
      };
    });

    const totalOutstanding = openInvoices.reduce(
      (sum, inv) => sum + (inv.amount_outstanding || 0),
      0
    );

    return {
      openInvoices: formattedInvoices,
      totalInvoices: openInvoices.length,
      totalOutstanding,
      agingBuckets: agingBuckets.map(b => ({
        label: b.label,
        total: b.total,
        count: b.count,
      })),
    };
  }

  private static utf8ToBase64(str: string): string {
    const utf8Bytes = new TextEncoder().encode(str);
    let binary = '';
    utf8Bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  private static async generatePDF(reportType: string, data: any): Promise<string> {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const { format } = await import('date-fns');

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 12, 'F');

    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`${reportType} Report`, 14, 9);

    yPosition = 25;

    if (data.openInvoices && data.openInvoices.length > 0) {
      const tableData = data.openInvoices.map((inv: any) => [
        inv.invoiceNumber || '',
        inv.customer || '',
        format(new Date(inv.invoiceDate), 'MMM d, yyyy'),
        inv.dueDate ? format(new Date(inv.dueDate), 'MMM d, yyyy') : 'N/A',
        `$${parseFloat(inv.total || 0).toFixed(2)}`,
        `$${parseFloat(inv.outstanding || 0).toFixed(2)}`,
        inv.agingBucket || '',
        inv.daysPastDue === 0 ? 'Not Due' : `${inv.daysPastDue}d`,
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Invoice #', 'Customer', 'Invoice Date', 'Due Date', 'Total', 'Outstanding', 'Aging Bucket', 'Days Past Due']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 28 },
          3: { cellWidth: 28 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 30 },
          7: { cellWidth: 25 },
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY || yPosition + 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary:', 14, finalY + 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Total Open Invoices: ${data.totalInvoices}`, 14, finalY + 22);
      doc.text(`Total Outstanding: $${data.totalOutstanding.toFixed(2)}`, 14, finalY + 28);

      if (data.agingBuckets && data.agingBuckets.length > 0) {
        let summaryY = finalY + 34;
        data.agingBuckets.forEach((bucket: any) => {
          doc.text(`${bucket.label}: $${bucket.total.toFixed(2)} (${bucket.count} invoices)`, 14, summaryY);
          summaryY += 6;
        });
      }
    }

    const pdfOutput = doc.output('arraybuffer');
    const uint8Array = new Uint8Array(pdfOutput);
    let binary = '';
    uint8Array.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  private static async generateCSV(reportType: string, data: any): Promise<string> {
    if (!data.openInvoices || data.openInvoices.length === 0) {
      return this.utf8ToBase64('No data available');
    }

    const { format } = await import('date-fns');

    const headers = ['Customer', 'Invoice #', 'Invoice Date', 'Due Date', 'Total Amount', 'Amount Outstanding', 'Aging Bucket', 'Days Past Due'];
    const rows = data.openInvoices.map((inv: any) => [
      inv.customer || '',
      inv.invoiceNumber || '',
      format(new Date(inv.invoiceDate), 'MMM d, yyyy'),
      inv.dueDate ? format(new Date(inv.dueDate), 'MMM d, yyyy') : '',
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

    return this.utf8ToBase64(csvContent);
  }

  private static async sendEmail(
    recipients: string[],
    reportName: string,
    attachments: Array<{ filename: string; content: string; type?: string }>,
    reportData: any
  ): Promise<void> {
    const { EmailService } = await import('./email-service');

    const totalInvoices = reportData.totalInvoices || 0;
    const totalOutstanding = reportData.totalOutstanding || 0;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">${reportName}</h1>
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
              <strong style="color: #1f2937;">${totalInvoices}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #6b7280;">Total Outstanding:</span>
              <strong style="color: #ef4444; font-size: 18px;">$${totalOutstanding.toFixed(2)}</strong>
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

    const response = await EmailService.sendEmail({
      to: recipients,
      subject: `${reportName} - ${new Date().toLocaleDateString()}`,
      template: 'custom',
      html,
      attachments,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to send email');
    }
  }
}
