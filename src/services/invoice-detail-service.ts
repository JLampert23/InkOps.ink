import { supabase } from '../lib/supabase-client';
import { stripeService, StripePaymentLink, StripePayment } from './stripe-service';
import { CommunicationLog } from './billing-service';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  lineItemGroupId: string | null;
}

export interface InvoiceContact {
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
}

export interface InvoiceAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
}

export interface PrintavoPayment {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
  notes: string | null;
}

export interface InvoiceDetail {
  id: string;
  printavoInvoiceId: string;
  visualId: string;
  status: string;
  statusColor: string | null;

  contact: InvoiceContact;
  billingAddress: InvoiceAddress;
  shippingAddress: InvoiceAddress;

  invoiceDate: string | null;
  dueDate: string | null;
  productionDueDate: string | null;
  customerPO: string | null;

  lineItems: InvoiceLineItem[];

  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountOutstanding: number;
  discounts: number;

  stripePaymentLink: StripePaymentLink | null;
  stripePayments: StripePayment[];
  printavoPayments: PrintavoPayment[];

  communicationLogs: CommunicationLog[];

  notes: string | null;
  internalNotes: string | null;

  mockups: string[];

  billingQueueId: string | null;
  billingQueueStatus: string;
  sentAt: string | null;
  sentMethod: string | null;

  rawData: any;
}

export const invoiceDetailService = {
  async getInvoiceDetail(printavoInvoiceId: string): Promise<InvoiceDetail | null> {
    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from('printavo_invoices')
        .select('*')
        .eq('id', printavoInvoiceId)
        .maybeSingle();

      if (invoiceError || !invoice) {
        console.error('Invoice not found:', invoiceError);
        return null;
      }

      const { data: lineItems } = await supabase
        .from('printavo_line_items')
        .select('*')
        .eq('invoice_id', printavoInvoiceId)
        .order('line_item_group_id', { ascending: true });

      const { data: billingQueueItem } = await supabase
        .from('billing_queue')
        .select('*')
        .eq('printavo_invoice_id', printavoInvoiceId)
        .maybeSingle();

      const stripePaymentLink = await stripeService.getPaymentLink(printavoInvoiceId);

      const { data: stripePaymentsData } = await supabase
        .from('stripe_payments')
        .select('*')
        .eq('printavo_invoice_id', printavoInvoiceId)
        .order('created_at', { ascending: false });

      const { data: printavoPaymentsData } = await supabase
        .from('printavo_payments')
        .select('*')
        .eq('invoice_id', printavoInvoiceId)
        .order('payment_date', { ascending: false });

      const { data: communicationLogsData } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('printavo_invoice_id', printavoInvoiceId)
        .order('sent_at', { ascending: false });

      const rawData = invoice.raw_data || {};
      const contact = rawData.contact || {};
      const customer = contact.customer || {};

      const mockups: string[] = [];
      if (rawData.orderMockups?.edges) {
        rawData.orderMockups.edges.forEach((edge: any) => {
          if (edge.node?.imageUrl) {
            mockups.push(edge.node.imageUrl);
          }
        });
      }

      const statusInfo = await this.getStatusInfo(invoice.status);

      return {
        id: invoice.id,
        printavoInvoiceId: invoice.id,
        visualId: invoice.invoice_number || '',
        status: invoice.status || 'Unknown',
        statusColor: statusInfo?.color || '#6B7280',

        contact: {
          name: invoice.customer_name || contact.fullName || '',
          email: invoice.customer_email || contact.email || '',
          phone: contact.phone || null,
          company: invoice.customer_company || customer.companyName || null,
        },

        billingAddress: this.extractAddress(customer.billingAddress),
        shippingAddress: this.extractAddress(customer.shippingAddress),

        invoiceDate: invoice.invoice_date || rawData.invoiceAt || rawData.createdAt,
        dueDate: invoice.due_date || rawData.paymentDueAt,
        productionDueDate: rawData.dueAt || null,
        customerPO: rawData.customerPurchaseOrder || rawData.poNumber || null,

        lineItems: (lineItems || []).map((item: any) => ({
          id: item.id,
          description: item.description || 'Line Item',
          quantity: item.quantity || 0,
          unitPrice: parseFloat(item.unit_price) || 0,
          totalPrice: parseFloat(item.total_price) || 0,
          lineItemGroupId: item.line_item_group_id,
        })),

        subtotal: parseFloat(invoice.subtotal) || 0,
        tax: parseFloat(invoice.tax) || 0,
        total: parseFloat(invoice.total) || 0,
        amountPaid: parseFloat(invoice.amount_paid) || 0,
        amountOutstanding: parseFloat(invoice.amount_outstanding) || 0,
        discounts: rawData.discount || 0,

        stripePaymentLink,
        stripePayments: (stripePaymentsData || []).map((payment: any) => ({
          id: payment.id,
          printavoInvoiceId: payment.printavo_invoice_id,
          amount: parseFloat(payment.amount) || 0,
          currency: payment.currency || 'usd',
          status: payment.status,
          customerEmail: payment.customer_email,
          customerName: payment.customer_name,
          paymentMethod: payment.payment_method || 'card',
          createdAt: payment.created_at,
          stripePaymentIntentId: payment.stripe_payment_intent_id,
        })),

        printavoPayments: (printavoPaymentsData || []).map((payment: any) => ({
          id: payment.id,
          amount: parseFloat(payment.amount) || 0,
          paymentDate: payment.payment_date,
          paymentMethod: payment.payment_method,
          notes: payment.notes,
        })),

        communicationLogs: (communicationLogsData || []).map((log: any) => ({
          id: log.id,
          printavoInvoiceId: log.printavo_invoice_id,
          communicationType: log.communication_type,
          method: log.method,
          recipient: log.recipient,
          subject: log.subject,
          message: log.message,
          status: log.status,
          sentAt: log.sent_at,
        })),

        notes: rawData.notes || null,
        internalNotes: rawData.internalNotes || null,

        mockups,

        billingQueueId: billingQueueItem?.id || null,
        billingQueueStatus: billingQueueItem?.payment_status || 'not_in_queue',
        sentAt: billingQueueItem?.sent_at || null,
        sentMethod: billingQueueItem?.sent_method || null,

        rawData,
      };
    } catch (error) {
      console.error('Error fetching invoice detail:', error);
      return null;
    }
  },

  async getInvoiceByQueueId(queueId: string): Promise<InvoiceDetail | null> {
    const { data: queueItem } = await supabase
      .from('billing_queue')
      .select('printavo_invoice_id')
      .eq('id', queueId)
      .maybeSingle();

    if (!queueItem) return null;

    return this.getInvoiceDetail(queueItem.printavo_invoice_id);
  },

  async getStatusInfo(statusName: string): Promise<{ color: string; position: number } | null> {
    const { data } = await supabase
      .from('printavo_statuses')
      .select('color, position')
      .eq('name', statusName)
      .maybeSingle();

    return data;
  },

  extractAddress(addressData: any): InvoiceAddress {
    if (!addressData) {
      return {
        line1: null,
        line2: null,
        city: null,
        state: null,
        zip: null,
        country: null,
      };
    }

    return {
      line1: addressData.address1 || addressData.line1 || null,
      line2: addressData.address2 || addressData.line2 || null,
      city: addressData.city || null,
      state: addressData.state || addressData.stateIso || null,
      zip: addressData.zip || addressData.postalCode || null,
      country: addressData.country || addressData.countryIso || null,
    };
  },

  async markAsPaidManual(printavoInvoiceId: string, amount: number): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data: billingQueueItem } = await supabase
      .from('billing_queue')
      .select('*')
      .eq('printavo_invoice_id', printavoInvoiceId)
      .maybeSingle();

    if (!billingQueueItem) {
      throw new Error('Invoice not found in billing queue');
    }

    const { data: settings } = await supabase
      .from('company_settings')
      .select('id')
      .maybeSingle();

    await supabase
      .from('paid_invoices')
      .insert([{
        company_id: settings?.id,
        printavo_invoice_id: printavoInvoiceId,
        printavo_visual_id: billingQueueItem.printavo_visual_id,
        customer_name: billingQueueItem.customer_name,
        customer_email: billingQueueItem.customer_email,
        invoice_total: billingQueueItem.invoice_total,
        amount_paid: amount,
        payment_date: new Date().toISOString(),
        payment_method: 'manual',
        metadata: { marked_by: session.user.id, marked_at: new Date().toISOString() },
      }]);

    await supabase
      .from('billing_queue')
      .update({ payment_status: 'paid' })
      .eq('id', billingQueueItem.id);

    await supabase
      .from('communication_logs')
      .insert([{
        printavo_invoice_id: printavoInvoiceId,
        communication_type: 'payment',
        method: 'manual',
        recipient: billingQueueItem.customer_email || 'N/A',
        subject: 'Manual Payment Recorded',
        message: `Payment of $${amount.toFixed(2)} recorded manually`,
        status: 'completed',
        sent_by: session.user.id,
      }]);
  },

  async syncInvoice(printavoInvoiceId: string): Promise<void> {
    console.log('Syncing invoice:', printavoInvoiceId);
  },

  formatAddress(address: InvoiceAddress): string {
    const parts: string[] = [];

    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);

    const cityStateZip: string[] = [];
    if (address.city) cityStateZip.push(address.city);
    if (address.state) cityStateZip.push(address.state);
    if (address.zip) cityStateZip.push(address.zip);

    if (cityStateZip.length > 0) {
      parts.push(cityStateZip.join(', '));
    }

    if (address.country && address.country !== 'USA' && address.country !== 'US') {
      parts.push(address.country);
    }

    return parts.join('\n');
  },

  hasAddress(address: InvoiceAddress): boolean {
    return !!(address.line1 || address.city || address.state || address.zip);
  },
};
