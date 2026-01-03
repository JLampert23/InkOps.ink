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
    if (!rule || !rule.is_enabled) {
      throw new Error('Automation rule not found or disabled');
    }

    const reportData = await this.fetchReportData(rule.report_type);

    const attachments: Array<{ filename: string; content: string; type: string }> = [];

    if (rule.file_formats.includes('pdf')) {
      const pdfContent = await this.generatePDF(rule.report_type, reportData);
      attachments.push({
        filename: `${rule.report_name}-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfContent,
        type: 'application/pdf',
      });
    }

    if (rule.file_formats.includes('csv')) {
      const csvContent = await this.generateCSV(rule.report_type, reportData);
      attachments.push({
        filename: `${rule.report_name}-${new Date().toISOString().split('T')[0]}.csv`,
        content: csvContent,
        type: 'text/csv',
      });
    }

    await this.sendEmail(rule.email_recipients, rule.report_name, attachments);

    await supabase
      .from('automated_reports')
      .update({
        last_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ruleId);
  }

  private static async fetchReportData(reportType: string): Promise<any> {
    console.log(`[Placeholder] Fetching data for report type: ${reportType}`);
    return {};
  }

  private static async generatePDF(reportType: string, data: any): Promise<string> {
    console.log(`[Placeholder] Generating PDF for report type: ${reportType}`, data);
    return 'base64-encoded-pdf-content';
  }

  private static async generateCSV(reportType: string, data: any): Promise<string> {
    console.log(`[Placeholder] Generating CSV for report type: ${reportType}`, data);
    return 'csv-content';
  }

  private static async sendEmail(
    recipients: string[],
    reportName: string,
    attachments: Array<{ filename: string; content: string; type: string }>
  ): Promise<void> {
    console.log(`[Placeholder] Sending email to: ${recipients.join(', ')}`);
    console.log(`[Placeholder] Report name: ${reportName}`);
    console.log(`[Placeholder] Attachments: ${attachments.map(a => a.filename).join(', ')}`);
  }
}
