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
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error('Failed to get session');
    }

    if (!session?.access_token) {
      console.error('No session found');
      throw new Error('User not authenticated - please refresh the page and try again');
    }

    console.log('Using session token for email service');

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  static async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      const headers = await this.getHeaders();
      console.log('Sending email request to:', this.getApiUrl());

      const response = await fetch(this.getApiUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      console.log('Email response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email error response:', errorText);

        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || `Failed to send email (${response.status})`);
        } catch {
          throw new Error(`Failed to send email: ${errorText || response.statusText}`);
        }
      }

      const result: SendEmailResponse = await response.json();
      console.log('Email sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Email service error:', error);
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
