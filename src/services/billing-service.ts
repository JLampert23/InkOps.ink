import { supabase } from '../lib/supabase-client';
import { stripeService } from './stripe-service';
import { Invoice } from '../types/printavo';

export interface BillingQueueItem {
  id: string;
  printavoInvoiceId: string;
  printavoVisualId: string;
  printavoStatus: string;
  customerName: string;
  customerEmail: string;
  customerCompany: string;
  customerPhone?: string;
  customerId?: string;
  invoiceTotal: number;
  invoiceDate: string;
  dueDate: string;
  stripePaymentLinkId: string | null;
  stripeInvoiceId: string | null;
  sentAt: string | null;
  sentMethod: string | null;
  paymentStatus: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
}

export interface CommunicationLog {
  id: string;
  printavoInvoiceId: string;
  communicationType: string;
  method: string;
  recipient: string;
  subject: string;
  message: string;
  status: string;
  sentAt: string;
}

export interface PaidInvoice {
  id: string;
  printavoInvoiceId: string;
  printavoVisualId: string;
  customerName: string;
  customerEmail: string;
  invoiceTotal: number;
  amountPaid: number;
  invoiceDate: string;
  paymentDate: string;
  stripePaymentIntentId: string;
  paymentMethod: string;
}

export const billingService = {
  async triggerPrintavoSync(): Promise<{ syncId: string; status: string }> {
    const { data, error } = await supabase.functions.invoke('printavo-sync', {
      body: { mode: 'quick' },
    });

    if (error) {
      throw new Error(error.message || 'Failed to trigger Printavo sync');
    }

    return data;
  },

  async waitForPrintavoSync(syncId: string, maxWaitMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < maxWaitMs) {
      const { data: syncLog } = await supabase
        .from('printavo_sync_log')
        .select('status, error_message')
        .eq('id', syncId)
        .maybeSingle();

      if (!syncLog) {
        return false;
      }

      if (syncLog.status === 'completed') {
        return true;
      }

      if (syncLog.status === 'failed') {
        console.error('Printavo sync failed:', syncLog.error_message);
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.warn('Printavo sync timed out');
    return false;
  },

  async syncBillingQueue(selectedStatuses: string[]): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to sync billing queue');
      }

      console.log('Step 1: Triggering Printavo sync to fetch latest data...');
      try {
        const syncResult = await this.triggerPrintavoSync();
        console.log('Printavo sync started:', syncResult);

        if (syncResult.syncId && syncResult.status === 'running') {
          console.log('Waiting for Printavo sync to complete...');
          const success = await this.waitForPrintavoSync(syncResult.syncId, 90000);
          if (success) {
            console.log('Printavo sync completed successfully');
          } else {
            console.warn('Printavo sync did not complete in time, proceeding with cached data');
          }
        }
      } catch (syncError) {
        console.warn('Printavo sync failed, proceeding with cached data:', syncError);
      }

      console.log('Step 2: Syncing billing queue from local cache...');

      const { data: settings } = await supabase
        .from('company_settings')
        .select('id')
        .maybeSingle();

      if (!settings) {
        throw new Error('Company settings not found');
      }

      let statusesToSync = selectedStatuses;

      if (statusesToSync.length === 0) {
        const { data: billingStatuses } = await supabase
          .from('printavo_statuses')
          .select('name')
          .eq('is_billing_eligible', true);

        statusesToSync = (billingStatuses || []).map(s => s.name);
      }

      if (statusesToSync.length === 0) {
        console.log('No statuses selected for billing queue. Please enable billing statuses in Settings.');
        return;
      }

      console.log('Looking for invoices with statuses:', statusesToSync);

      const { data: invoices, error } = await supabase
        .from('printavo_invoices')
        .select('*')
        .in('status', statusesToSync);

      if (error) throw error;

      console.log(`Found ${invoices?.length || 0} invoices matching billing statuses`);

      if (!invoices || invoices.length === 0) {
        console.log('No invoices found matching billing statuses');
        return;
      }

      for (const invoice of invoices) {
        const { data: existing } = await supabase
          .from('billing_queue')
          .select('id, payment_status')
          .eq('printavo_invoice_id', invoice.id)
          .maybeSingle();

        if (existing) {
          if (existing.payment_status !== 'paid') {
            await supabase
              .from('billing_queue')
              .update({
                printavo_status: invoice.status,
                customer_name: invoice.customer_name,
                customer_email: invoice.customer_email,
                customer_company: invoice.customer_company,
                invoice_total: invoice.total,
                invoice_date: invoice.invoice_date,
                due_date: invoice.due_date,
              })
              .eq('id', existing.id);
          }
        } else {
          await supabase
            .from('billing_queue')
            .insert([{
              company_id: settings.id,
              printavo_invoice_id: invoice.id,
              printavo_visual_id: invoice.invoice_number,
              printavo_status: invoice.status,
              customer_name: invoice.customer_name,
              customer_email: invoice.customer_email,
              customer_company: invoice.customer_company,
              invoice_total: invoice.total,
              invoice_date: invoice.invoice_date,
              due_date: invoice.due_date,
              payment_status: 'unpaid',
            }]);
        }
      }

      console.log('Billing queue sync completed');
    } catch (error) {
      console.error('Error syncing billing queue:', error);
      throw error;
    }
  },

  async getBillingQueue(): Promise<BillingQueueItem[]> {
    try {
      // First get billing queue items
      const { data: queueData, error: queueError } = await supabase
        .from('billing_queue')
        .select('*')
        .is('sent_at', null)
        .neq('payment_status', 'paid')
        .order('created_at', { ascending: false });

      if (queueError) throw queueError;
      if (!queueData) return [];

      // Get customer IDs from invoices, then fetch customer data
      const invoiceIds = queueData.map(item => item.printavo_invoice_id);
      const { data: invoiceData } = await supabase
        .from('printavo_invoices')
        .select('id, customer_id')
        .in('id', invoiceIds);

      // Create a map of invoice ID to customer ID
      const invoiceToCustomerMap = new Map(
        (invoiceData || []).map(inv => [inv.id, inv.customer_id])
      );

      // Get unique customer IDs
      const customerIds = [...new Set(invoiceData?.map(inv => inv.customer_id).filter(Boolean) || [])];

      // Fetch customer data
      const { data: customerData } = await supabase
        .from('customers')
        .select(`
          id,
          phone,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_zip,
          billing_country,
          shipping_address_line1,
          shipping_address_line2,
          shipping_city,
          shipping_state,
          shipping_zip,
          shipping_country
        `)
        .in('id', customerIds);

      // Create a map of customer ID to customer data
      const customerDataMap = new Map(
        (customerData || []).map(cust => [cust.id, cust])
      );

      return queueData.map(item => {
        const customerId = invoiceToCustomerMap.get(item.printavo_invoice_id);
        const customer = customerId ? customerDataMap.get(customerId) : null;

        return {
          id: item.id,
          printavoInvoiceId: item.printavo_invoice_id,
          printavoVisualId: item.printavo_visual_id,
          printavoStatus: item.printavo_status,
          customerName: item.customer_name,
          customerEmail: item.customer_email,
          customerCompany: item.customer_company,
          customerPhone: customer?.phone,
          customerId: customerId,
          invoiceTotal: parseFloat(item.invoice_total),
          invoiceDate: item.invoice_date,
          dueDate: item.due_date,
          stripePaymentLinkId: item.stripe_payment_link_id,
          stripeInvoiceId: item.stripe_invoice_id,
          sentAt: item.sent_at,
          sentMethod: item.sent_method,
          paymentStatus: item.payment_status,
          metadata: item.metadata,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          billingAddressLine1: customer?.billing_address_line1,
          billingAddressLine2: customer?.billing_address_line2,
          billingCity: customer?.billing_city,
          billingState: customer?.billing_state,
          billingZip: customer?.billing_zip,
          billingCountry: customer?.billing_country,
          shippingAddressLine1: customer?.shipping_address_line1,
          shippingAddressLine2: customer?.shipping_address_line2,
          shippingCity: customer?.shipping_city,
          shippingState: customer?.shipping_state,
          shippingZip: customer?.shipping_zip,
          shippingCountry: customer?.shipping_country,
        };
      });
    } catch (error) {
      console.error('Error fetching billing queue:', error);
      return [];
    }
  },

  async generatePaymentLink(queueItemId: string): Promise<string> {
    try {
      const { data: queueItem, error: queueError } = await supabase
        .from('billing_queue')
        .select('*')
        .eq('id', queueItemId)
        .maybeSingle();

      if (queueError || !queueItem) {
        throw new Error('Billing queue item not found');
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('printavo_invoices')
        .select('*')
        .eq('id', queueItem.printavo_invoice_id)
        .maybeSingle();

      if (invoiceError || !invoice) {
        throw new Error('Printavo invoice not found');
      }

      const mappedInvoice: Invoice = {
        id: invoice.id,
        visualId: invoice.invoice_number,
        total: parseFloat(invoice.total),
        contact: {
          fullName: invoice.customer_name,
          email: invoice.customer_email,
        },
      } as Invoice;

      const paymentLink = await stripeService.createPaymentLink(mappedInvoice);

      await supabase
        .from('billing_queue')
        .update({
          stripe_payment_link_id: paymentLink.id,
        })
        .eq('id', queueItemId);

      return paymentLink.url;
    } catch (error) {
      console.error('Error generating payment link:', error);
      throw error;
    }
  },

  async sendInvoiceEmail(queueItemId: string, customMessage?: string, sendSMS: boolean = false): Promise<{ emailSent: boolean; smsSent: boolean }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to send invoices');
      }

      const { data: queueItem } = await supabase
        .from('billing_queue')
        .select('*')
        .eq('id', queueItemId)
        .maybeSingle();

      if (!queueItem) {
        throw new Error('Billing queue item not found');
      }

      if (!queueItem.customer_email && !sendSMS) {
        throw new Error('Customer email not found');
      }

      let paymentLink = queueItem.stripe_payment_link_id;
      if (!paymentLink) {
        const url = await this.generatePaymentLink(queueItemId);
        const { data: link } = await supabase
          .from('stripe_payment_links')
          .select('stripe_payment_link_id')
          .eq('printavo_invoice_id', queueItem.printavo_invoice_id)
          .maybeSingle();
        paymentLink = url;
      }

      const { data: linkData } = await supabase
        .from('stripe_payment_links')
        .select('stripe_payment_link_url')
        .eq('printavo_invoice_id', queueItem.printavo_invoice_id)
        .maybeSingle();

      const paymentUrl = linkData?.stripe_payment_link_url || '';

      let emailSent = false;
      let smsSent = false;

      if (queueItem.customer_email) {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            to: queueItem.customer_email,
            subject: `Invoice ${queueItem.printavo_visual_id} - Payment Required`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Invoice ${queueItem.printavo_visual_id}</h2>
                <p>Dear ${queueItem.customer_name},</p>
                ${customMessage ? `<p>${customMessage}</p>` : ''}
                <p>Your invoice is ready for payment.</p>
                <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
                  <p><strong>Invoice Number:</strong> ${queueItem.printavo_visual_id}</p>
                  <p><strong>Amount Due:</strong> $${parseFloat(queueItem.invoice_total).toFixed(2)}</p>
                  <p><strong>Due Date:</strong> ${queueItem.due_date ? new Date(queueItem.due_date).toLocaleDateString() : 'Upon receipt'}</p>
                </div>
                <p style="margin: 30px 0;">
                  <a href="${paymentUrl}"
                     style="background: #0066ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Pay Invoice Now
                  </a>
                </p>
                <p style="color: #666; font-size: 14px;">
                  If you have any questions, please don't hesitate to contact us.
                </p>
              </div>
            `,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to send email');
        }

        emailSent = true;

        await supabase
          .from('communication_logs')
          .insert([{
            printavo_invoice_id: queueItem.printavo_invoice_id,
            communication_type: 'invoice',
            method: 'email',
            recipient: queueItem.customer_email,
            subject: `Invoice ${queueItem.printavo_visual_id} - Payment Required`,
            message: customMessage || 'Invoice sent with payment link',
            status: 'sent',
            sent_by: session.user.id,
          }]);
      }

      if (sendSMS) {
        const { data: invoice } = await supabase
          .from('printavo_invoices')
          .select('customer_id')
          .eq('id', queueItem.printavo_invoice_id)
          .maybeSingle();

        if (invoice?.customer_id) {
          const { data: customer } = await supabase
            .from('customers')
            .select('phone')
            .eq('id', invoice.customer_id)
            .maybeSingle();

          if (customer?.phone) {
            const { twilioService } = await import('./twilio-service');
            const smsResult = await twilioService.sendInvoiceSMS({
              invoiceId: queueItem.printavo_invoice_id,
              customerId: invoice.customer_id,
              phoneNumber: twilioService.formatPhoneNumber(customer.phone),
              customerName: queueItem.customer_name,
              invoiceNumber: queueItem.printavo_visual_id,
              amount: parseFloat(queueItem.invoice_total),
              paymentLink: paymentUrl,
            });

            smsSent = smsResult.success;
          }
        }
      }

      const sentMethod = emailSent && smsSent ? 'email_and_sms' : emailSent ? 'email' : smsSent ? 'sms' : null;

      if (sentMethod) {
        await supabase
          .from('billing_queue')
          .update({
            sent_at: new Date().toISOString(),
            sent_method: sentMethod,
          })
          .eq('id', queueItemId);
      }

      return { emailSent, smsSent };
    } catch (error) {
      console.error('Error sending invoice:', error);
      throw error;
    }
  },

  async markAsPaid(queueItemId: string, paymentIntentId: string): Promise<void> {
    try {
      const { data: queueItem } = await supabase
        .from('billing_queue')
        .select('*')
        .eq('id', queueItemId)
        .maybeSingle();

      if (!queueItem) {
        throw new Error('Billing queue item not found');
      }

      const { data: payment } = await supabase
        .from('stripe_payments')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      const { data: settings } = await supabase
        .from('company_settings')
        .select('id')
        .maybeSingle();

      await supabase
        .from('paid_invoices')
        .insert([{
          company_id: settings?.id,
          printavo_invoice_id: queueItem.printavo_invoice_id,
          printavo_visual_id: queueItem.printavo_visual_id,
          customer_name: queueItem.customer_name,
          customer_email: queueItem.customer_email,
          invoice_total: queueItem.invoice_total,
          amount_paid: payment?.amount || queueItem.invoice_total,
          payment_date: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId,
          stripe_charge_id: payment?.stripe_charge_id,
          payment_method: payment?.payment_method || 'card',
          metadata: {
            original_queue_item: queueItem,
          },
        }]);

      await supabase
        .from('billing_queue')
        .update({
          payment_status: 'paid',
        })
        .eq('id', queueItemId);
    } catch (error) {
      console.error('Error marking as paid:', error);
      throw error;
    }
  },

  async getPaidInvoices(): Promise<PaidInvoice[]> {
    try {
      const { data, error } = await supabase
        .from('printavo_invoices')
        .select(`
          id,
          invoice_number,
          customer_name,
          customer_email,
          total,
          amount_paid,
          invoice_date,
          updated_at,
          payments (
            payment_date,
            stripe_payment_intent_id,
            payment_method
          )
        `)
        .eq('status_stage', 'paid')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(item => {
        const latestPayment = item.payments && item.payments.length > 0
          ? item.payments[item.payments.length - 1]
          : null;

        return {
          id: item.id,
          printavoInvoiceId: item.id,
          printavoVisualId: item.invoice_number,
          customerName: item.customer_name,
          customerEmail: item.customer_email,
          invoiceTotal: parseFloat(item.total),
          amountPaid: parseFloat(item.amount_paid),
          invoiceDate: item.invoice_date,
          paymentDate: latestPayment?.payment_date || item.updated_at,
          stripePaymentIntentId: latestPayment?.stripe_payment_intent_id || '',
          paymentMethod: latestPayment?.payment_method || 'card',
        };
      });
    } catch (error) {
      console.error('Error fetching paid invoices:', error);
      return [];
    }
  },

  async getCommunicationLogs(printavoInvoiceId: string): Promise<CommunicationLog[]> {
    try {
      const { data, error } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('printavo_invoice_id', printavoInvoiceId)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(log => ({
        id: log.id,
        printavoInvoiceId: log.printavo_invoice_id,
        communicationType: log.communication_type,
        method: log.method,
        recipient: log.recipient,
        subject: log.subject,
        message: log.message,
        status: log.status,
        sentAt: log.sent_at,
      }));
    } catch (error) {
      console.error('Error fetching communication logs:', error);
      return [];
    }
  },

  async removeFromQueue(queueItemId: string): Promise<void> {
    try {
      await supabase
        .from('billing_queue')
        .delete()
        .eq('id', queueItemId);
    } catch (error) {
      console.error('Error removing from queue:', error);
      throw error;
    }
  },

  async bulkGeneratePaymentLinks(queueItemIds: string[]): Promise<number> {
    let successCount = 0;

    for (const id of queueItemIds) {
      try {
        await this.generatePaymentLink(id);
        successCount++;
      } catch (error) {
        console.error(`Failed to generate link for ${id}:`, error);
      }
    }

    return successCount;
  },

  async bulkSendInvoices(queueItemIds: string[]): Promise<number> {
    let successCount = 0;

    for (const id of queueItemIds) {
      try {
        await this.sendInvoiceEmail(id);
        successCount++;
      } catch (error) {
        console.error(`Failed to send invoice for ${id}:`, error);
      }
    }

    return successCount;
  },

  async createStripeInvoice(queueItemId: string): Promise<string> {
    try {
      const { data: queueItem, error: queueError } = await supabase
        .from('billing_queue')
        .select('*')
        .eq('id', queueItemId)
        .maybeSingle();

      if (queueError || !queueItem) {
        throw new Error('Billing queue item not found');
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('printavo_invoices')
        .select('*')
        .eq('id', queueItem.printavo_invoice_id)
        .maybeSingle();

      if (invoiceError || !invoice) {
        throw new Error('Printavo invoice not found');
      }

      const mappedInvoice: Invoice = {
        id: invoice.id,
        visualId: invoice.invoice_number,
        total: parseFloat(invoice.total),
        contact: {
          fullName: invoice.customer_name,
          email: invoice.customer_email,
        },
      } as Invoice;

      const stripeInvoice = await stripeService.createStripeInvoiceWithMinimumDue(mappedInvoice);

      await supabase
        .from('billing_queue')
        .update({
          stripe_invoice_id: stripeInvoice.stripeInvoiceId,
          sent_at: new Date().toISOString(),
          sent_method: 'stripe_invoice',
        })
        .eq('id', queueItemId);

      return stripeInvoice.hostedInvoiceUrl;
    } catch (error) {
      console.error('Error creating Stripe invoice:', error);
      throw error;
    }
  },

  async bulkCreateStripeInvoices(queueItemIds: string[]): Promise<number> {
    let successCount = 0;

    for (const id of queueItemIds) {
      try {
        await this.createStripeInvoice(id);
        successCount++;
      } catch (error) {
        console.error(`Failed to create Stripe invoice for ${id}:`, error);
      }
    }

    return successCount;
  },

  async moveToAccountsReceivable(queueItemId: string): Promise<void> {
    const { data: queueItem, error: queueError } = await supabase
      .from('billing_queue')
      .select('printavo_invoice_id')
      .eq('id', queueItemId)
      .maybeSingle();

    if (queueError) throw queueError;
    if (!queueItem) throw new Error('Queue item not found');

    const { error: updateError } = await supabase
      .from('printavo_invoices')
      .update({ status_stage: 'accounts_receivable' })
      .eq('id', queueItem.printavo_invoice_id);

    if (updateError) throw updateError;

    const { error: deleteError } = await supabase
      .from('billing_queue')
      .delete()
      .eq('id', queueItemId);

    if (deleteError) throw deleteError;
  },
};
