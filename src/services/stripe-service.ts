import { supabase } from '../lib/supabase-client';
import { Payment } from '../types/production';
import { Invoice } from '../types/printavo';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export interface StripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  clientSecret: string;
}

export interface StripePaymentLink {
  id: string;
  url: string;
  invoiceId: string;
  amount: number;
  status: string;
}

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
}

export interface CustomerPaymentHistory {
  customerId: string;
  customerName: string;
  payments: StripePayment[];
  totalPaid: number;
}

export interface StripePayment {
  id: string;
  printavoInvoiceId: string;
  amount: number;
  currency: string;
  status: string;
  customerEmail: string;
  customerName: string;
  paymentMethod: string;
  createdAt: string;
  stripePaymentIntentId: string;
}

export const stripeService = {
  async createPaymentLink(printavoInvoice: Invoice): Promise<StripePaymentLink> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to create payment links');
      }

      const { data: settings } = await supabase
        .from('company_settings')
        .select('id, stripe_secret_key')
        .maybeSingle();

      if (!settings?.stripe_secret_key) {
        throw new Error('Stripe is not configured. Please add your credentials in Settings → Integrations → Stripe');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/stripe-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          action: 'createPaymentLink',
          data: {
            amount: Math.round(printavoInvoice.total * 100),
            currency: 'usd',
            metadata: {
              printavo_invoice_id: printavoInvoice.id,
              printavo_visual_id: printavoInvoice.visualId,
              customer_name: printavoInvoice.contact?.fullName || 'Unknown',
              customer_email: printavoInvoice.contact?.email || '',
            },
            customerEmail: printavoInvoice.contact?.email,
            description: `Payment for Invoice ${printavoInvoice.visualId}`,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment link');
      }

      const result = await response.json();

      await supabase.from('stripe_payment_links').insert([{
        company_id: settings.id,
        printavo_invoice_id: printavoInvoice.id,
        printavo_visual_id: printavoInvoice.visualId,
        stripe_payment_link_id: result.paymentLinkId,
        stripe_payment_link_url: result.url,
        amount: printavoInvoice.total,
        currency: 'usd',
        status: 'active',
        customer_email: printavoInvoice.contact?.email || null,
        customer_name: printavoInvoice.contact?.fullName || null,
        metadata: {
          printavo_invoice_id: printavoInvoice.id,
          printavo_visual_id: printavoInvoice.visualId,
        },
      }]);

      return {
        id: result.paymentLinkId,
        url: result.url,
        invoiceId: printavoInvoice.id,
        amount: printavoInvoice.total,
        status: 'active',
      };
    } catch (error) {
      console.error('Error creating payment link:', error);
      throw error;
    }
  },

  async getPaymentLink(printavoInvoiceId: string): Promise<StripePaymentLink | null> {
    try {
      const { data, error } = await supabase
        .from('stripe_payment_links')
        .select('*')
        .eq('printavo_invoice_id', printavoInvoiceId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.stripe_payment_link_id,
        url: data.stripe_payment_link_url,
        invoiceId: data.printavo_invoice_id,
        amount: parseFloat(data.amount),
        status: data.status,
      };
    } catch (error) {
      console.error('Error fetching payment link:', error);
      return null;
    }
  },

  async getPaymentStatus(printavoInvoiceId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('stripe_payments')
        .select('status')
        .eq('printavo_invoice_id', printavoInvoiceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.status || 'unpaid';
    } catch (error) {
      console.error('Error fetching payment status:', error);
      return 'unknown';
    }
  },

  async getCustomerPayments(customerEmail: string): Promise<StripePayment[]> {
    try {
      const { data, error } = await supabase
        .from('stripe_payments')
        .select('*')
        .eq('customer_email', customerEmail)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(payment => ({
        id: payment.id,
        printavoInvoiceId: payment.printavo_invoice_id,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        status: payment.status,
        customerEmail: payment.customer_email,
        customerName: payment.customer_name,
        paymentMethod: payment.payment_method || 'card',
        createdAt: payment.created_at,
        stripePaymentIntentId: payment.stripe_payment_intent_id,
      }));
    } catch (error) {
      console.error('Error fetching customer payments:', error);
      return [];
    }
  },

  async getAllPayments(): Promise<StripePayment[]> {
    try {
      const { data, error } = await supabase
        .from('stripe_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(payment => ({
        id: payment.id,
        printavoInvoiceId: payment.printavo_invoice_id,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        status: payment.status,
        customerEmail: payment.customer_email,
        customerName: payment.customer_name,
        paymentMethod: payment.payment_method || 'card',
        createdAt: payment.created_at,
        stripePaymentIntentId: payment.stripe_payment_intent_id,
      }));
    } catch (error) {
      console.error('Error fetching all payments:', error);
      return [];
    }
  },

  async getCustomerPaymentHistory(customerEmail: string): Promise<CustomerPaymentHistory | null> {
    try {
      const payments = await this.getCustomerPayments(customerEmail);
      if (payments.length === 0) return null;

      const totalPaid = payments
        .filter(p => p.status === 'succeeded')
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        customerId: customerEmail,
        customerName: payments[0]?.customerName || 'Unknown',
        payments,
        totalPaid,
      };
    } catch (error) {
      console.error('Error fetching customer payment history:', error);
      return null;
    }
  },

  async createPaymentIntent(amount: number, currency: string = 'usd', metadata?: Record<string, any>): Promise<StripePaymentIntent> {
    console.log('Creating Stripe payment intent:', { amount, currency, metadata });
    throw new Error('Stripe integration not implemented. Configure Stripe credentials first.');
  },

  async confirmPayment(paymentIntentId: string): Promise<Payment> {
    console.log('Confirming Stripe payment:', paymentIntentId);
    throw new Error('Stripe integration not implemented. Configure Stripe credentials first.');
  },

  async fetchPaymentHistory(invoiceId?: string): Promise<Payment[]> {
    try {
      const payments = await this.getAllPayments();

      return payments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        status: payment.status as Payment['status'],
        method: payment.paymentMethod,
        createdAt: payment.createdAt,
        stripePaymentId: payment.stripePaymentIntentId,
        invoiceId: payment.printavoInvoiceId,
      }));
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return [];
    }
  },

  async initiateRefund(refund: RefundRequest): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to process refunds');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/stripe-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          action: 'createRefund',
          data: refund,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initiate refund');
      }
    } catch (error) {
      console.error('Error initiating refund:', error);
      throw error;
    }
  },

  async fetchStripeBalance(): Promise<{ available: number; pending: number }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { available: 0, pending: 0 };
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/stripe-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          action: 'getBalance',
        }),
      });

      if (!response.ok) {
        return { available: 0, pending: 0 };
      }

      const result = await response.json();
      return {
        available: (result.available?.[0]?.amount || 0) / 100,
        pending: (result.pending?.[0]?.amount || 0) / 100,
      };
    } catch (error) {
      console.error('Error fetching Stripe balance:', error);
      return { available: 0, pending: 0 };
    }
  },

  async fetchRecentCharges(limit: number = 10): Promise<any[]> {
    console.log('Fetching recent Stripe charges');
    return [];
  },

  async validateStripeConfig(): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('stripe_secret_key')
        .maybeSingle();

      return !!data?.stripe_secret_key;
    } catch (error) {
      console.error('Error validating Stripe config:', error);
      return false;
    }
  },
};
