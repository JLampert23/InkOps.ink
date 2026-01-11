import { supabase } from '../lib/supabase-client';

export interface SendSMSParams {
  invoiceId: string;
  customerId: string;
  phoneNumber: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  paymentLink: string;
}

export interface SMSLog {
  id: string;
  invoice_id: string;
  customer_id: string;
  phone_number: string;
  message_body: string;
  delivery_status: string;
  twilio_sid: string | null;
  error_message: string | null;
  sent_at: string;
  created_at: string;
}

export const twilioService = {
  async sendInvoiceSMS(params: SendSMSParams): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('sms_message_template, twilio_enabled')
        .maybeSingle();

      if (!settings?.twilio_enabled) {
        return { success: false, error: 'SMS is not enabled' };
      }

      const messageTemplate = settings.sms_message_template ||
        'Hi {CustomerName}, your invoice {InvoiceNumber} is ready. Amount Due: ${Amount}. Pay here: {PaymentLink}. Reply STOP to unsubscribe.';

      const messageBody = messageTemplate
        .replace('{CustomerName}', params.customerName)
        .replace('{InvoiceNumber}', params.invoiceNumber)
        .replace('{Amount}', params.amount.toFixed(2))
        .replace('{PaymentLink}', params.paymentLink);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-sms`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: params.invoiceId,
          customerId: params.customerId,
          phoneNumber: params.phoneNumber,
          messageBody,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || 'Failed to send SMS' };
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending SMS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS'
      };
    }
  },

  async getSMSLogs(invoiceId: string): Promise<SMSLog[]> {
    try {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching SMS logs:', error);
      return [];
    }
  },

  async getCustomerSMSLogs(customerId: string): Promise<SMSLog[]> {
    try {
      const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .eq('customer_id', customerId)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching customer SMS logs:', error);
      return [];
    }
  },

  formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }

    return phone.startsWith('+') ? phone : `+${phone}`;
  },

  validatePhoneNumber(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  },
};
