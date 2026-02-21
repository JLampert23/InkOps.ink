import { supabase } from '../lib/supabase-client';
import { stripeService, StripePaymentLink, StripePayment, StripeInvoice } from './stripe-service';
import { CommunicationLog } from './billing-service';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  lineItemGroupId: string | null;
  style: string;
  color: string;
  sizes: string;
  rawData: any;
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

export interface ManualPayment {
  id: string;
  amount: number;
  paymentDate: string;
  paymentType: string;
  paymentMethod: string | null;
  checkNumber: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface InvoiceFee {
  id: string;
  name: string;
  description: string;
  amount: number;
  taxable: boolean;
}

export interface SMSLog {
  id: string;
  phoneNumber: string;
  messageBody: string;
  deliveryStatus: string;
  errorMessage: string | null;
  sentAt: string;
}

export interface ShippingLabel {
  id: string;
  labelUrl: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  service: string | null;
  cost: number | null;
  weightOz: number | null;
  packageLength: number | null;
  packageWidth: number | null;
  packageHeight: number | null;
  shipDate: string | null;
  createdAt: string;
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
  customerId: string | null;

  lineItems: InvoiceLineItem[];
  fees: InvoiceFee[];
  feesTotal: number;

  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountOutstanding: number;
  discounts: number;

  stripePaymentLink: StripePaymentLink | null;
  stripeInvoice: StripeInvoice | null;
  stripePayments: StripePayment[];
  printavoPayments: PrintavoPayment[];
  manualPayments: ManualPayment[];

  communicationLogs: CommunicationLog[];
  smsLogs: SMSLog[];

  notes: string | null;
  internalNotes: string | null;

  mockups: string[];

  billingQueueId: string | null;
  billingQueueStatus: string;
  sentAt: string | null;
  sentMethod: string | null;

  isFinanciallyLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;

  shippingLabelUrl: string | null;
  shippingLabels: ShippingLabel[];

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

      const { data: invoiceLineItems } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', printavoInvoiceId)
        .order('line_number', { ascending: true });

      const { data: printavoLineItems } = await supabase
        .from('printavo_line_items')
        .select('*')
        .eq('invoice_id', printavoInvoiceId)
        .order('line_item_group_id', { ascending: true });

      const useInvoiceLineItems = invoiceLineItems && invoiceLineItems.length > 0;

      const { data: billingQueueItem } = await supabase
        .from('billing_queue')
        .select('*')
        .eq('printavo_invoice_id', printavoInvoiceId)
        .maybeSingle();

      const stripePaymentLink = await stripeService.getPaymentLink(printavoInvoiceId);
      const stripeInvoice = await stripeService.getStripeInvoice(printavoInvoiceId);

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

      const { data: manualPaymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', printavoInvoiceId)
        .eq('source', 'manual')
        .order('payment_date', { ascending: false });

      const { data: communicationLogsData } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('printavo_invoice_id', printavoInvoiceId)
        .order('sent_at', { ascending: false });

      const { data: smsLogsData } = await supabase
        .from('sms_logs')
        .select('*')
        .eq('invoice_id', printavoInvoiceId)
        .order('sent_at', { ascending: false });

      const { data: shippingLabelsData } = await supabase
        .from('shipping_labels')
        .select('*')
        .eq('invoice_id', printavoInvoiceId)
        .order('created_at', { ascending: true });

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

      // Calculate actual status based on balance_remaining instead of using stale Printavo status
      const balanceRemaining = parseFloat(invoice.balance_remaining || invoice.amount_outstanding) || 0;
      const amountPaid = parseFloat(invoice.amount_paid) || 0;

      let calculatedStatus = 'Unpaid';
      let statusColor = '#EF4444'; // red

      if (balanceRemaining <= 0) {
        calculatedStatus = 'Paid';
        statusColor = '#10B981'; // green
      } else if (amountPaid > 0) {
        calculatedStatus = 'Partially Paid';
        statusColor = '#F59E0B'; // yellow/orange
      }

      // Extract addresses from individual fields first, then fallback to JSON fields and raw_data
      const billingAddress: InvoiceAddress = {
        line1: invoice.billing_address_line1 || invoice.billing_address?.line1 || customer.billingAddress?.address1 || rawData.billingAddress?.address1 || null,
        line2: invoice.billing_address_line2 || invoice.billing_address?.line2 || customer.billingAddress?.address2 || rawData.billingAddress?.address2 || null,
        city: invoice.billing_city || invoice.billing_address?.city || customer.billingAddress?.city || rawData.billingAddress?.city || null,
        state: invoice.billing_state || invoice.billing_address?.state || customer.billingAddress?.state || rawData.billingAddress?.state || null,
        zip: invoice.billing_zip || invoice.billing_address?.zip || customer.billingAddress?.postalCode || rawData.billingAddress?.zip || null,
        country: invoice.billing_country || invoice.billing_address?.country || customer.billingAddress?.country || rawData.billingAddress?.country || null,
      };

      const shippingAddress: InvoiceAddress = {
        line1: invoice.shipping_address_line1 || invoice.shipping_address?.line1 || customer.shippingAddress?.address1 || rawData.shippingAddress?.address1 || null,
        line2: invoice.shipping_address_line2 || invoice.shipping_address?.line2 || customer.shippingAddress?.address2 || rawData.shippingAddress?.address2 || null,
        city: invoice.shipping_city || invoice.shipping_address?.city || customer.shippingAddress?.city || rawData.shippingAddress?.city || null,
        state: invoice.shipping_state || invoice.shipping_address?.state || customer.shippingAddress?.state || rawData.shippingAddress?.state || null,
        zip: invoice.shipping_zip || invoice.shipping_address?.zip || customer.shippingAddress?.postalCode || rawData.shippingAddress?.zip || null,
        country: invoice.shipping_country || invoice.shipping_address?.country || customer.shippingAddress?.country || rawData.shippingAddress?.country || null,
      };

      return {
        id: invoice.id,
        printavoInvoiceId: invoice.id,
        visualId: invoice.invoice_number || '',
        status: calculatedStatus,
        statusColor: statusColor,

        contact: {
          name: invoice.customer_name || contact.fullName || '',
          email: invoice.customer_email || contact.email || '',
          phone: invoice.customer_phone || contact.phone || null,
          company: invoice.customer_company || customer.companyName || null,
        },

        billingAddress: billingAddress,
        shippingAddress: shippingAddress,

        invoiceDate: invoice.invoice_date || rawData.invoiceAt || rawData.createdAt,
        dueDate: invoice.due_date || rawData.paymentDueAt,
        productionDueDate: rawData.dueAt || null,
        customerPO: rawData.customerPurchaseOrder || rawData.poNumber || null,
        customerId: invoice.customer_id || customer.id || null,

        lineItems: useInvoiceLineItems
          ? (invoiceLineItems || []).filter((item: any) => item.item_type !== 'fee').map((item: any) => {
              let sizes = '-';
              if (item.sizes && typeof item.sizes === 'object') {
                const sizeEntries = Object.entries(item.sizes)
                  .filter(([_, qty]) => qty && Number(qty) > 0)
                  .map(([size, qty]) => `${size}:${qty}`);
                sizes = sizeEntries.join(', ') || '-';
              }

              return {
                id: item.id,
                description: item.description || 'Line Item',
                quantity: item.quantity || 0,
                unitPrice: parseFloat(item.unit_price) || 0,
                totalPrice: parseFloat(item.total) || parseFloat(item.subtotal) || 0,
                lineItemGroupId: null,
                style: item.style_number || item.style_name || '-',
                color: item.color || '-',
                sizes,
                rawData: null,
              };
            })
          : (printavoLineItems || []).map((item: any) => {
              const hasExtractedData = item.extracted_style || item.extracted_color || item.extracted_sizes;

              let style = item.extracted_style || '-';
              let color = item.extracted_color || '-';
              let sizes = '-';

              if (item.extracted_sizes && typeof item.extracted_sizes === 'object') {
                const sizeEntries = Object.entries(item.extracted_sizes)
                  .filter(([_, qty]) => qty && Number(qty) > 0)
                  .map(([size, qty]) => `${size}:${qty}`);
                sizes = sizeEntries.join(', ') || '-';
              }

              if (!hasExtractedData) {
                const parsed = this.parseLineItemDetails(item.description, item.raw_data);
                style = parsed.style;
                color = parsed.color;
                sizes = parsed.sizes;
              }

              return {
                id: item.id,
                description: item.description || 'Line Item',
                quantity: item.quantity || 0,
                unitPrice: parseFloat(item.unit_price) || 0,
                totalPrice: parseFloat(item.total_price) || 0,
                lineItemGroupId: item.line_item_group_id,
                style,
                color,
                sizes,
                rawData: item.raw_data,
              };
            }),

        fees: useInvoiceLineItems
          ? (invoiceLineItems || [])
              .filter((item: any) => item.item_type === 'fee')
              .map((item: any) => ({
                id: item.id,
                name: item.description || 'Fee',
                description: item.description || 'Additional Charge',
                amount: parseFloat(item.total) || parseFloat(item.subtotal) || 0,
                taxable: parseFloat(item.tax_amount) > 0,
              }))
          : this.extractFees(rawData),
        feesTotal: useInvoiceLineItems
          ? (invoiceLineItems || [])
              .filter((item: any) => item.item_type === 'fee')
              .reduce((sum: number, item: any) => sum + (parseFloat(item.total) || parseFloat(item.subtotal) || 0), 0)
          : this.calculateFeesTotal(rawData),

        subtotal: parseFloat(invoice.subtotal) || 0,
        tax: parseFloat(invoice.tax) || 0,
        total: parseFloat(invoice.total) || 0,
        amountPaid: parseFloat(invoice.amount_paid) || 0,
        amountOutstanding: parseFloat(invoice.amount_outstanding) || 0,
        discounts: rawData.discount || 0,

        stripePaymentLink,
        stripeInvoice,
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

        manualPayments: (manualPaymentsData || []).map((payment: any) => ({
          id: payment.id,
          amount: parseFloat(payment.amount) || 0,
          paymentDate: payment.payment_date,
          paymentType: payment.payment_type,
          paymentMethod: payment.payment_method,
          checkNumber: payment.check_number,
          notes: payment.notes,
          createdBy: payment.created_by,
          createdAt: payment.created_at,
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

        smsLogs: (smsLogsData || []).map((log: any) => ({
          id: log.id,
          phoneNumber: log.phone_number,
          messageBody: log.message_body,
          deliveryStatus: log.delivery_status,
          errorMessage: log.error_message,
          sentAt: log.sent_at,
        })),

        notes: rawData.notes || null,
        internalNotes: rawData.internalNotes || null,

        mockups,

        billingQueueId: billingQueueItem?.id || null,
        billingQueueStatus: billingQueueItem?.payment_status || 'not_in_queue',
        sentAt: billingQueueItem?.sent_at || null,
        sentMethod: billingQueueItem?.sent_method || null,

        isFinanciallyLocked: invoice.is_financially_locked || false,
        lockedAt: invoice.locked_at || null,
        lockedBy: invoice.locked_by || null,

        shippingLabelUrl: invoice.shipping_label_url || null,
        shippingLabels: (shippingLabelsData || []).map((label: any) => ({
          id: label.id,
          labelUrl: label.label_url,
          trackingNumber: label.tracking_number,
          carrier: label.carrier,
          service: label.service,
          cost: label.cost,
          weightOz: label.weight_oz,
          packageLength: label.package_length,
          packageWidth: label.package_width,
          packageHeight: label.package_height,
          shipDate: label.ship_date,
          createdAt: label.created_at,
        })),

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

    const { data: invoice } = await supabase
      .from('printavo_invoices')
      .select('*')
      .eq('id', printavoInvoiceId)
      .maybeSingle();

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const { data: billingQueueItem } = await supabase
      .from('billing_queue')
      .select('*')
      .eq('printavo_invoice_id', printavoInvoiceId)
      .maybeSingle();

    const { data: settings } = await supabase
      .from('company_settings')
      .select('id')
      .maybeSingle();

    const currentAmountPaid = parseFloat(invoice.amount_paid || '0');
    const currentAmountOutstanding = parseFloat(invoice.amount_outstanding || '0');
    const newAmountPaid = currentAmountPaid + amount;
    const newAmountOutstanding = Math.max(0, currentAmountOutstanding - amount);

    const updateData: any = {
      amount_paid: newAmountPaid.toString(),
      amount_outstanding: newAmountOutstanding.toString(),
    };

    if (newAmountOutstanding === 0) {
      updateData.status_stage = 'paid';
    }

    await supabase
      .from('printavo_invoices')
      .update(updateData)
      .eq('id', printavoInvoiceId);

    await supabase
      .from('printavo_payments')
      .insert([{
        invoice_id: printavoInvoiceId,
        amount: amount.toString(),
        payment_date: new Date().toISOString(),
        payment_method: 'manual',
        notes: 'Manual payment recorded by user',
      }]);

    if (newAmountOutstanding === 0) {
      await supabase
        .from('paid_invoices')
        .insert([{
          company_id: settings?.id,
          printavo_invoice_id: printavoInvoiceId,
          printavo_visual_id: invoice.invoice_number,
          customer_name: invoice.customer_name,
          customer_email: invoice.customer_email,
          invoice_total: invoice.total,
          amount_paid: newAmountPaid,
          payment_date: new Date().toISOString(),
          payment_method: 'manual',
          metadata: { marked_by: session.user.id, marked_at: new Date().toISOString() },
        }]);
    }

    if (billingQueueItem) {
      await supabase
        .from('billing_queue')
        .update({ payment_status: 'paid' })
        .eq('id', billingQueueItem.id);
    }

    await supabase
      .from('communication_logs')
      .insert([{
        printavo_invoice_id: printavoInvoiceId,
        communication_type: 'payment',
        method: 'manual',
        recipient: invoice.customer_email || 'N/A',
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

  extractFees(rawData: any): InvoiceFee[] {
    console.log('extractFees called with rawData:', rawData);
    console.log('rawData.fees:', rawData?.fees);

    if (!rawData || !rawData.fees || !rawData.fees.edges) {
      console.log('No fees found in rawData');
      return [];
    }

    const fees = rawData.fees.edges.map((edge: any) => {
      const fee = edge.node;
      return {
        id: fee.id || `fee-${Math.random()}`,
        name: fee.description || 'Fee',
        description: fee.description || 'Additional Charge',
        amount: parseFloat(fee.amount) || 0,
        taxable: fee.taxable || false,
      };
    });

    console.log('Extracted fees:', fees);
    return fees;
  },

  calculateFeesTotal(rawData: any): number {
    const fees = this.extractFees(rawData);
    return fees.reduce((sum, fee) => sum + fee.amount, 0);
  },

  parseLineItemDetails(description: string, rawData?: any): { style: string; color: string; sizes: string } {
    console.log('parseLineItemDetails called with:', { description, rawData });
    let style = '';
    let color = '';
    let sizes = '';

    if (rawData) {
      console.log('Checking rawData for style/color/sizes:', rawData);

      if (rawData.style) {
        const styleName = rawData.style.name || '';
        const styleNumber = rawData.style.number || '';
        style = styleName && styleNumber ? `${styleName} ${styleNumber}` : styleName || styleNumber || '';
      }

      if (!style && rawData.product) {
        const styleName = rawData.product.styleName || '';
        const styleNumber = rawData.product.styleNumber || '';
        style = styleName && styleNumber ? `${styleName} ${styleNumber}` : styleName || styleNumber || '';
      }

      if (!style) {
        style = rawData.styleName || rawData.styleNumber || '';
      }

      color = rawData.color?.name || rawData.product?.colorName || rawData.colorName || '';

      if (rawData.sizeQuantities && typeof rawData.sizeQuantities === 'object') {
        const sizeEntries = Object.entries(rawData.sizeQuantities)
          .filter(([_, qty]) => qty && Number(qty) > 0)
          .map(([size, qty]) => `${size}:${qty}`);
        sizes = sizeEntries.join(', ');
      } else if (rawData.sizes && typeof rawData.sizes === 'object') {
        const sizeEntries = Object.entries(rawData.sizes)
          .filter(([_, qty]) => qty && Number(qty) > 0)
          .map(([size, qty]) => `${size}:${qty}`);
        sizes = sizeEntries.join(', ');
      } else if (rawData.sizeBreakdown) {
        sizes = rawData.sizeBreakdown;
      }
      console.log('After rawData parsing:', { style, color, sizes });
    }

    if (!style || !color) {
      const patterns = [
        /^([A-Za-z0-9&\+\s]+?)\s+([A-Z0-9]+)\s*[-–]\s*(.+?)(?:\s*[-–]|$)/i,
        /^([A-Za-z\s]+)\s*[-–]\s*([A-Za-z\s]+?)(?:\s*[-–]|$)/,
      ];

      for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match) {
          if (!style && match[1] && match[2]) {
            style = `${match[1].trim()} ${match[2].trim()}`;
          }
          if (!color && match[3]) {
            color = match[3].trim();
          }
          break;
        }
      }

      const brandMatch = description.match(/(Gildan|Next Level|Bella\+Canvas|Hanes|Fruit of the Loom|Champion|Comfort Colors|Port & Company|District|American Apparel|Jerzees|Anvil|Augusta|Sport-Tek|Port Authority)\s*([A-Za-z0-9]+)/i);
      if (brandMatch && !style) {
        style = `${brandMatch[1]} ${brandMatch[2]}`;
      }

      const colorMatch = description.match(/[-–]\s*([A-Za-z\s]+?)(?:\s*[-–]|\s*$)/);
      if (colorMatch && !color) {
        const possibleColor = colorMatch[1].trim();
        const colorWords = ['Black', 'White', 'Navy', 'Red', 'Blue', 'Green', 'Gray', 'Grey', 'Yellow', 'Orange', 'Purple', 'Pink', 'Brown', 'Maroon', 'Heather', 'Charcoal', 'Royal', 'Forest', 'Ash', 'Sand', 'Natural', 'Cardinal', 'Gold', 'Kelly', 'Light', 'Dark'];
        if (colorWords.some(c => possibleColor.toLowerCase().includes(c.toLowerCase()))) {
          color = possibleColor;
        }
      }
    }

    if (!sizes) {
      const sizesMatch = description.match(/\b((?:(?:2?X?S|S|M|L|2?X?L|3XL|4XL|5XL|YS|YM|YL)(?:\s*:\s*\d+)?(?:\s*[,\/]\s*)?)+)\b/i);
      if (sizesMatch) {
        sizes = sizesMatch[1].replace(/\//g, ', ');
      }
    }

    return {
      style: style || '-',
      color: color || '-',
      sizes: sizes || '-',
    };
  },
};
