import { SendEmailRequest, SendEmailResponse } from '../types/email';
import { supabase } from '../lib/supabase-client';

export class EmailService {
  private static getApiUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL environment variable is not set');
    }
    return `${supabaseUrl}/functions/v1/send-email`;
  }

  private static async getHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('User not authenticated');
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  static async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      const headers = await this.getHeaders();
      const response = await fetch(this.getApiUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      const result: SendEmailResponse = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  static async sendInvoiceReminder(
    to: string | string[],
    data: {
      customerName: string;
      invoiceNumber: string;
      amountDue: string;
      dueDate: string;
      invoiceUrl?: string;
      companyName?: string;
      companyEmail?: string;
      companyPhone?: string;
    }
  ): Promise<SendEmailResponse> {
    return this.sendEmail({
      to,
      subject: `Invoice Reminder - Invoice #${data.invoiceNumber}`,
      template: 'invoice-reminder',
      data,
    });
  }

  static async sendPaymentReceived(
    to: string | string[],
    data: {
      customerName: string;
      invoiceNumber: string;
      paymentAmount: string;
      paymentDate: string;
      remainingBalance?: string;
      invoiceUrl?: string;
      companyName?: string;
      companyEmail?: string;
      companyPhone?: string;
    }
  ): Promise<SendEmailResponse> {
    return this.sendEmail({
      to,
      subject: `Payment Received - Invoice #${data.invoiceNumber}`,
      template: 'payment-received',
      data,
    });
  }

  static async sendOverdueNotice(
    to: string | string[],
    data: {
      customerName: string;
      invoiceNumber: string;
      amountDue: string;
      dueDate: string;
      daysOverdue: number;
      invoiceUrl?: string;
      companyName?: string;
      companyEmail?: string;
      companyPhone?: string;
    }
  ): Promise<SendEmailResponse> {
    return this.sendEmail({
      to,
      subject: `Overdue Invoice Notice - Invoice #${data.invoiceNumber}`,
      template: 'overdue-notice',
      data,
    });
  }

  static async sendWelcomeEmail(
    to: string | string[],
    data: {
      customerName: string;
      dashboardUrl?: string;
      companyName?: string;
      companyEmail?: string;
      companyPhone?: string;
    }
  ): Promise<SendEmailResponse> {
    return this.sendEmail({
      to,
      subject: `Welcome to ${data.companyName || 'our platform'}!`,
      template: 'welcome',
      data,
    });
  }

  static async sendCustomEmail(
    to: string | string[],
    subject: string,
    html: string
  ): Promise<SendEmailResponse> {
    return this.sendEmail({
      to,
      subject,
      template: 'custom',
      html,
    });
  }
}
