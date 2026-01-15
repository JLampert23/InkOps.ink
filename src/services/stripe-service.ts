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

export interface StripeInvoice {
  id: string;
  stripeInvoiceId: string;
  stripeCustomerId: string | null;
  hostedInvoiceUrl: string;
  invoicePdfUrl: string | null;
  printavoInvoiceId: string;
  totalAmount: number;
  minimumDueAmount: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  status: string;
  customerEmail: string | null;
  customerName: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export interface StripeInvoicePayment {
  id: string;
  paymentIntentId: string;
  chargeId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  receiptUrl: string | null;
  createdAt: string;
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

  async createStripeInvoiceWithMinimumDue(printavoInvoice: Invoice): Promise<StripeInvoice> {
    try {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshedSession) {
        throw new Error('Unable to refresh authentication. Please log in again.');
      }

      const { data: settings } = await supabase
        .from('company_settings')
        .select('id, stripe_secret_key')
        .maybeSingle();

      if (!settings?.stripe_secret_key) {
        throw new Error('Stripe is not configured. Please add your credentials in Settings → Integrations → Stripe');
      }

      const totalAmountCents = Math.round(printavoInvoice.total * 100);
      const minimumDueCents = Math.round(totalAmountCents * 0.50);

      const response = await fetch(`${supabaseUrl}/functions/v1/stripe-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshedSession.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          action: 'createInvoiceWithMinimumDue',
          data: {
            totalAmount: totalAmountCents,
            minimumDue: minimumDueCents,
            currency: 'usd',
            customerEmail: printavoInvoice.contact?.email || null,
            customerName: printavoInvoice.contact?.fullName || 'Customer',
            description: `Invoice ${printavoInvoice.visualId}`,
            metadata: {
              printavo_invoice_id: printavoInvoice.id,
              printavo_visual_id: printavoInvoice.visualId,
              customer_name: printavoInvoice.contact?.fullName || 'Unknown',
            },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to create Stripe invoice';
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        console.error('Stripe API error response:', errorText);
        throw new Error(errorMessage);
      }

      const result = await response.json();

      const { data: invoiceRecord, error: insertError } = await supabase
        .from('stripe_invoices')
        .insert([{
          company_id: settings.id,
          printavo_invoice_id: printavoInvoice.id,
          stripe_invoice_id: result.invoiceId,
          stripe_customer_id: result.customerId,
          hosted_invoice_url: result.hostedInvoiceUrl,
          invoice_pdf_url: result.invoicePdfUrl,
          total_amount: printavoInvoice.total,
          minimum_due_amount: printavoInvoice.total * 0.50,
          amount_paid: 0,
          amount_remaining: printavoInvoice.total,
          currency: 'usd',
          status: result.status,
          customer_email: printavoInvoice.contact?.email || null,
          customer_name: printavoInvoice.contact?.fullName || null,
          description: `Invoice ${printavoInvoice.visualId}`,
          metadata: {
            printavo_invoice_id: printavoInvoice.id,
            printavo_visual_id: printavoInvoice.visualId,
          },
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      return {
        id: invoiceRecord.id,
        stripeInvoiceId: invoiceRecord.stripe_invoice_id,
        stripeCustomerId: invoiceRecord.stripe_customer_id,
        hostedInvoiceUrl: invoiceRecord.hosted_invoice_url,
        invoicePdfUrl: invoiceRecord.invoice_pdf_url,
        printavoInvoiceId: invoiceRecord.printavo_invoice_id,
        totalAmount: parseFloat(invoiceRecord.total_amount),
        minimumDueAmount: parseFloat(invoiceRecord.minimum_due_amount),
        amountPaid: parseFloat(invoiceRecord.amount_paid),
        amountRemaining: parseFloat(invoiceRecord.amount_remaining),
        currency: invoiceRecord.currency,
        status: invoiceRecord.status,
        customerEmail: invoiceRecord.customer_email,
        customerName: invoiceRecord.customer_name,
        description: invoiceRecord.description,
        createdAt: invoiceRecord.created_at,
        updatedAt: invoiceRecord.updated_at,
        paidAt: invoiceRecord.paid_at,
      };
    } catch (error) {
      console.error('Error creating Stripe invoice:', error);
      throw error;
    }
  },

  async getStripeInvoice(printavoInvoiceId: string): Promise<StripeInvoice | null> {
    try {
      const { data, error } = await supabase
        .from('stripe_invoices')
        .select('*')
        .eq('printavo_invoice_id', printavoInvoiceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        stripeInvoiceId: data.stripe_invoice_id,
        stripeCustomerId: data.stripe_customer_id,
        hostedInvoiceUrl: data.hosted_invoice_url,
        invoicePdfUrl: data.invoice_pdf_url,
        printavoInvoiceId: data.printavo_invoice_id,
        totalAmount: parseFloat(data.total_amount) / 100,
        minimumDueAmount: parseFloat(data.minimum_due_amount) / 100,
        amountPaid: parseFloat(data.amount_paid) / 100,
        amountRemaining: parseFloat(data.amount_remaining) / 100,
        currency: data.currency,
        status: data.status,
        customerEmail: data.customer_email,
        customerName: data.customer_name,
        description: data.description,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        paidAt: data.paid_at,
      };
    } catch (error) {
      console.error('Error fetching Stripe invoice:', error);
      return null;
    }
  },

  async getStripeInvoicePaymentHistory(printavoInvoiceId: string): Promise<StripeInvoicePayment[]> {
    try {
      const { data: invoice } = await supabase
        .from('stripe_invoices')
        .select('id')
        .eq('printavo_invoice_id', printavoInvoiceId)
        .maybeSingle();

      if (!invoice) return [];

      const { data, error } = await supabase
        .from('stripe_payment_history')
        .select('*')
        .eq('stripe_invoice_id', invoice.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(payment => ({
        id: payment.id,
        paymentIntentId: payment.payment_intent_id,
        chargeId: payment.charge_id,
        amount: parseFloat(payment.amount) / 100,
        currency: payment.currency,
        status: payment.status,
        paymentMethod: payment.payment_method,
        receiptUrl: payment.receipt_url,
        createdAt: payment.created_at,
      }));
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return [];
    }
  },

  async refreshStripeInvoiceStatus(printavoInvoiceId: string): Promise<StripeInvoice | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in');
      }

      const invoice = await this.getStripeInvoice(printavoInvoiceId);
      if (!invoice) return null;

      const response = await fetch(`${supabaseUrl}/functions/v1/stripe-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          action: 'getInvoice',
          data: {
            invoiceId: invoice.stripeInvoiceId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invoice from Stripe');
      }

      const result = await response.json();

      const { data: updated } = await supabase
        .from('stripe_invoices')
        .update({
          status: result.status,
          amount_paid: result.amountPaid,
          amount_remaining: result.amountDue,
          paid_at: result.status === 'paid' ? new Date().toISOString() : null,
        })
        .eq('printavo_invoice_id', printavoInvoiceId)
        .select()
        .single();

      if (!updated) return invoice;

      return {
        ...invoice,
        status: updated.status,
        amountPaid: parseFloat(updated.amount_paid) / 100,
        amountRemaining: parseFloat(updated.amount_remaining) / 100,
        paidAt: updated.paid_at,
      };
    } catch (error) {
      console.error('Error refreshing invoice status:', error);
      return null;
    }
  },
};
