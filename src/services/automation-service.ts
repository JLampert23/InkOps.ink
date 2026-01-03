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
    const { data: invoices, error } = await supabase
      .from('calculated_invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch invoice data: ${error.message}`);
    }

    return { invoices: invoices || [] };
  }

  private static async generatePDF(reportType: string, data: any): Promise<string> {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;

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

    if (data.invoices && data.invoices.length > 0) {
      const tableData = data.invoices.slice(0, 50).map((inv: any) => [
        inv.visual_id || '',
        inv.customer_name || '',
        inv.formatted_status || '',
        `$${parseFloat(inv.total || 0).toFixed(2)}`,
        `$${parseFloat(inv.amount_outstanding || 0).toFixed(2)}`,
        new Date(inv.created_at).toLocaleDateString(),
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Invoice', 'Customer', 'Status', 'Total', 'Outstanding', 'Date']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
      });
    }

    return btoa(doc.output('datauristring').split(',')[1]);
  }

  private static async generateCSV(reportType: string, data: any): Promise<string> {
    if (!data.invoices || data.invoices.length === 0) {
      return btoa('No data available');
    }

    const headers = ['Invoice', 'Customer', 'Status', 'Total', 'Outstanding', 'Date'];
    const rows = data.invoices.map((inv: any) => [
      inv.visual_id || '',
      inv.customer_name || '',
      inv.formatted_status || '',
      parseFloat(inv.total || 0).toFixed(2),
      parseFloat(inv.amount_outstanding || 0).toFixed(2),
      new Date(inv.created_at).toLocaleDateString(),
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

    return btoa(csvContent);
  }

  private static async sendEmail(
    recipients: string[],
    reportName: string,
    attachments: Array<{ filename: string; content: string; type?: string }>,
    reportData: any
  ): Promise<void> {
    const { EmailService } = await import('./email-service');

    const totalInvoices = reportData.invoices?.length || 0;
    const totalOutstanding = reportData.invoices?.reduce(
      (sum: number, inv: any) => sum + parseFloat(inv.amount_outstanding || 0),
      0
    );

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
