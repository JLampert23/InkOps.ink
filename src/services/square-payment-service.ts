import { supabase } from '../lib/supabase-client';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface SquarePaymentLink {
  id: string;
  url: string;
  invoiceId: string;
  amount: number;
  status: string;
}

export interface SquarePayment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  status: string;
  customerEmail: string | null;
  customerName: string | null;
  paymentMethod: string;
  cardBrand: string | null;
  cardLastFour: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

export const squarePaymentService = {
  async isSquarePaymentsEnabled(): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('square_payments_enabled, square_access_token, square_location_id')
        .maybeSingle();

      return !!(data?.square_payments_enabled && data?.square_access_token && data?.square_location_id);
    } catch (error) {
      console.error('Error checking Square payments status:', error);
      return false;
    }
  },

  async enableSquarePayments(enabled: boolean): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!userProfile?.company_id) throw new Error('Company not found');

    const { error } = await supabase
      .from('company_settings')
      .update({ square_payments_enabled: enabled })
      .eq('id', userProfile.company_id);

    if (error) throw error;
  },

  async getPaymentLink(invoiceId: string): Promise<SquarePaymentLink | null> {
    try {
      const { data, error } = await supabase
        .from('square_payment_links')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.square_checkout_id,
        url: data.square_checkout_url,
        invoiceId: data.invoice_id,
        amount: parseFloat(data.amount),
        status: data.status,
      };
    } catch (error) {
      console.error('Error fetching Square payment link:', error);
      return null;
    }
  },

  async getPaymentStatus(invoiceId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('square_payments')
        .select('status')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.status || 'unpaid';
    } catch (error) {
      console.error('Error fetching Square payment status:', error);
      return 'unknown';
    }
  },

  async getPaymentsForInvoice(invoiceId: string): Promise<SquarePayment[]> {
    try {
      const { data, error } = await supabase
        .from('square_payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(payment => ({
        id: payment.id,
        invoiceId: payment.invoice_id,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        status: payment.status,
        customerEmail: payment.customer_email,
        customerName: payment.customer_name,
        paymentMethod: payment.payment_method,
        cardBrand: payment.card_brand,
        cardLastFour: payment.card_last_four,
        receiptUrl: payment.receipt_url,
        createdAt: payment.created_at,
      }));
    } catch (error) {
      console.error('Error fetching Square payments:', error);
      return [];
    }
  },

  async getAllPayments(): Promise<SquarePayment[]> {
    try {
      const { data, error } = await supabase
        .from('square_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(payment => ({
        id: payment.id,
        invoiceId: payment.invoice_id,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        status: payment.status,
        customerEmail: payment.customer_email,
        customerName: payment.customer_name,
        paymentMethod: payment.payment_method,
        cardBrand: payment.card_brand,
        cardLastFour: payment.card_last_four,
        receiptUrl: payment.receipt_url,
        createdAt: payment.created_at,
      }));
    } catch (error) {
      console.error('Error fetching all Square payments:', error);
      return [];
    }
  },

  async testConnection(): Promise<{ success: boolean; message: string; locations?: unknown[] }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const response = await fetch(`${supabaseUrl}/functions/v1/square-proxy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: '/v2/locations',
          method: 'GET',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          message: error.error || 'Failed to connect to Square',
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: `Connected successfully. Found ${data.locations?.length || 0} location(s).`,
        locations: data.locations,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  },
};
