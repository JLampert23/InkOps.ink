import { SendEmailRequest, SendEmailResponse } from '../types/email';
import { supabase } from '../lib/supabase-client';
import { ShortCodeData } from '../types/shortcode';
import { ShortCodeEngine } from './shortcode-service';

export class EmailService {
  private static getApiUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL environment variable is not set');
    }
    return `${supabaseUrl}/functions/v1/send-email`;
  }

  private static async getHeaders(): Promise<HeadersInit> {
    const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !session?.access_token) {
      console.error('Session refresh failed, signing out user');
      await supabase.auth.signOut();
      throw new Error('Your session has expired. Please log in again.');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Token validation failed, signing out user');
      await supabase.auth.signOut();
      throw new Error('Your session is invalid. Please log in again.');
    }

    console.log('Using validated session token for email service');

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
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

  /**
   * Sends a custom email with short code replacement
   * @param to - Recipient email address(es)
   * @param subject - Email subject (can contain short codes)
   * @param body - Email body HTML (can contain short codes)
   * @param shortCodeData - Data dictionary for short code replacement
   */
  static async sendEmailWithShortCodes(
    to: string | string[],
    subject: string,
    body: string,
    shortCodeData: ShortCodeData
  ): Promise<SendEmailResponse> {
    return this.sendEmail({
      to,
      subject,
      template: 'custom',
      html: body,
      shortCodeData,
    });
  }

  /**
   * Sends a quote email with short code support
   */
  static async sendQuoteEmail(
    to: string | string[],
    subject: string,
    body: string,
    quoteData: {
      quote: any;
      customer: any;
      company: any;
      user: any;
      approvalUrl?: string;
    }
  ): Promise<SendEmailResponse> {
    const shortCodeData: ShortCodeData = {
      // Customer
      customer_first_name: quoteData.customer?.customer_name?.split(' ')[0] || '',
      customer_last_name: quoteData.customer?.customer_name?.split(' ').slice(1).join(' ') || '',
      customer_full_name: quoteData.customer?.customer_name || '',
      customer_company: quoteData.customer?.customer_company || '',
      customer_email: quoteData.customer?.customer_email || '',
      customer_phone: quoteData.customer?.customer_phone || '',

      // Quote
      quote_number: quoteData.quote?.quote_number || '',
      quote_total: ShortCodeEngine.formatCurrency(quoteData.quote?.total_amount || 0),
      quote_subtotal: ShortCodeEngine.formatCurrency(quoteData.quote?.subtotal || 0),
      quote_tax: ShortCodeEngine.formatCurrency(quoteData.quote?.sales_tax || 0),
      quote_date: quoteData.quote?.created_date ? ShortCodeEngine.formatDate(quoteData.quote.created_date) : '',
      quote_expiry_date: quoteData.quote?.expiry_date ? ShortCodeEngine.formatDate(quoteData.quote.expiry_date) : '',
      quote_link: quoteData.approvalUrl || '',
      quote_status: quoteData.quote?.status || '',

      // Company
      company_name: quoteData.company?.company_name || '',
      company_phone: quoteData.company?.bill_phone || '',
      company_email: quoteData.company?.bill_email || '',

      // User
      user_name: quoteData.user?.full_name || '',
      user_email: quoteData.user?.email || '',

      // General
      current_date: ShortCodeEngine.formatDate(new Date()),
      current_year: new Date().getFullYear().toString(),
    };

    return this.sendEmailWithShortCodes(to, subject, body, shortCodeData);
  }

  /**
   * Sends an invoice email with short code support
   */
  static async sendInvoiceEmail(
    to: string | string[],
    subject: string,
    body: string,
    invoiceData: {
      invoice: any;
      customer: any;
      company: any;
      user: any;
      paymentUrl?: string;
    }
  ): Promise<SendEmailResponse> {
    const shortCodeData: ShortCodeData = {
      // Customer
      customer_first_name: invoiceData.customer?.customer_name?.split(' ')[0] || '',
      customer_last_name: invoiceData.customer?.customer_name?.split(' ').slice(1).join(' ') || '',
      customer_full_name: invoiceData.customer?.customer_name || invoiceData.invoice?.customer_name || '',
      customer_company: invoiceData.customer?.customer_company || invoiceData.invoice?.customer_company || '',
      customer_email: invoiceData.customer?.customer_email || invoiceData.invoice?.customer_email || '',
      customer_phone: invoiceData.customer?.customer_phone || invoiceData.invoice?.customer_phone || '',

      // Invoice
      invoice_number: invoiceData.invoice?.invoice_number || '',
      invoice_total: ShortCodeEngine.formatCurrency(invoiceData.invoice?.total || 0),
      invoice_subtotal: ShortCodeEngine.formatCurrency(invoiceData.invoice?.subtotal || 0),
      invoice_tax: ShortCodeEngine.formatCurrency(invoiceData.invoice?.tax || 0),
      invoice_balance: ShortCodeEngine.formatCurrency(invoiceData.invoice?.balance || 0),
      invoice_date: invoiceData.invoice?.date ? ShortCodeEngine.formatDate(invoiceData.invoice.date) : '',
      invoice_due_date: invoiceData.invoice?.due_date ? ShortCodeEngine.formatDate(invoiceData.invoice.due_date) : '',
      invoice_link: invoiceData.paymentUrl || '',
      invoice_status: invoiceData.invoice?.status || '',

      // Company
      company_name: invoiceData.company?.company_name || '',
      company_phone: invoiceData.company?.bill_phone || '',
      company_email: invoiceData.company?.bill_email || '',

      // User
      user_name: invoiceData.user?.full_name || '',
      user_email: invoiceData.user?.email || '',

      // General
      current_date: ShortCodeEngine.formatDate(new Date()),
      current_year: new Date().getFullYear().toString(),
    };

    return this.sendEmailWithShortCodes(to, subject, body, shortCodeData);
  }
}
