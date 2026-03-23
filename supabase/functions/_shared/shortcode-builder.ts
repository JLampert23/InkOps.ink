import { formatCurrency, formatDate, type ShortCodeData } from './shortcode-engine.ts';

/**
 * Formats a document number for friendly display in emails
 * Strips the prefix and adds a friendly label
 * Examples:
 *   QTE-1234 → Quote 1234
 *   INV-1234 → Invoice 1234
 *   WO-1234 → Work Order 1234
 */
function formatFriendlyNumber(number: string, type: 'quote' | 'invoice' | 'work_order'): string {
  if (!number) return '';

  const labels = {
    quote: 'Quote',
    invoice: 'Invoice',
    work_order: 'Work Order'
  };

  // Strip common prefixes (QTE-, INV-, WO-)
  const numericPart = number.replace(/^(QTE-|INV-|WO-)/i, '');

  return `${labels[type]} ${numericPart}`;
}

/**
 * Builds shortcode data from a quote record
 */
export function buildQuoteShortCodes(
  quote: any,
  customer: any,
  company: any,
  user: any,
  approvalUrl?: string
): ShortCodeData {
  const customerFirstName = customer?.customer_name?.split(' ')[0] || '';
  const customerLastName = customer?.customer_name?.split(' ').slice(1).join(' ') || '';

  const userFirstName = user?.full_name?.split(' ')[0] || '';
  const userLastName = user?.full_name?.split(' ').slice(1).join(' ') || '';

  return {
    // Customer data
    customer_first_name: customerFirstName,
    customer_last_name: customerLastName,
    customer_full_name: customer?.customer_name || quote?.customer_name || '',
    customer_company: customer?.customer_company || quote?.customer_company || '',
    customer_email: customer?.customer_email || quote?.customer_email || '',
    customer_phone: customer?.customer_phone || quote?.customer_phone || '',
    customer_address: quote?.bill_address_1 || '',
    customer_city: quote?.bill_city || '',
    customer_state: quote?.bill_state || '',
    customer_zip: quote?.bill_zip || '',

    // Quote data
    quote_number: formatFriendlyNumber(quote?.quote_number || '', 'quote'),
    quote_total: formatCurrency(quote?.total_amount || 0),
    quote_subtotal: formatCurrency(quote?.subtotal || 0),
    quote_tax: formatCurrency(quote?.sales_tax || 0),
    quote_discount: formatCurrency(quote?.discount || 0),
    quote_date: quote?.created_date ? formatDate(quote.created_date) : '',
    quote_expiry_date: quote?.expiry_date ? formatDate(quote.expiry_date) : '',
    quote_link: approvalUrl || '',
    quote_status: quote?.status || '',

    // Company data
    company_name: company?.company_name || '',
    company_address: company?.bill_address_1 || '',
    company_city: company?.bill_city || '',
    company_state: company?.bill_state || '',
    company_zip: company?.bill_zip || '',
    company_phone: company?.bill_phone || '',
    company_email: company?.bill_email || '',
    company_website: company?.company_website || '',

    // User data
    user_name: user?.full_name || '',
    user_first_name: userFirstName,
    user_last_name: userLastName,
    user_email: user?.email || '',
    user_phone: user?.phone || '',

    // General
    current_date: formatDate(new Date()),
    current_year: new Date().getFullYear().toString(),
  };
}

/**
 * Builds shortcode data from an invoice record
 */
export function buildInvoiceShortCodes(
  invoice: any,
  customer: any,
  company: any,
  user: any,
  paymentUrl?: string
): ShortCodeData {
  const customerFirstName = customer?.customer_name?.split(' ')[0] || invoice?.customer_name?.split(' ')[0] || '';
  const customerLastName = customer?.customer_name?.split(' ').slice(1).join(' ') || invoice?.customer_name?.split(' ').slice(1).join(' ') || '';

  const userFirstName = user?.full_name?.split(' ')[0] || '';
  const userLastName = user?.full_name?.split(' ').slice(1).join(' ') || '';

  return {
    // Customer data
    customer_first_name: customerFirstName,
    customer_last_name: customerLastName,
    customer_full_name: customer?.customer_name || invoice?.customer_name || '',
    customer_company: customer?.customer_company || invoice?.customer_company || '',
    customer_email: customer?.customer_email || invoice?.customer_email || '',
    customer_phone: customer?.customer_phone || invoice?.customer_phone || '',
    customer_address: invoice?.bill_address_1 || '',
    customer_city: invoice?.bill_city || '',
    customer_state: invoice?.bill_state || '',
    customer_zip: invoice?.bill_zip || '',

    // Invoice data
    invoice_number: formatFriendlyNumber(invoice?.invoice_number || '', 'invoice'),
    invoice_total: formatCurrency(invoice?.total || 0),
    invoice_subtotal: formatCurrency(invoice?.subtotal || 0),
    invoice_tax: formatCurrency(invoice?.tax || 0),
    invoice_balance: formatCurrency(invoice?.balance || 0),
    invoice_date: invoice?.date ? formatDate(invoice.date) : '',
    invoice_due_date: invoice?.due_date ? formatDate(invoice.due_date) : '',
    invoice_link: paymentUrl || '',
    invoice_status: invoice?.status || '',

    // Company data
    company_name: company?.company_name || '',
    company_address: company?.bill_address_1 || '',
    company_city: company?.bill_city || '',
    company_state: company?.bill_state || '',
    company_zip: company?.bill_zip || '',
    company_phone: company?.bill_phone || '',
    company_email: company?.bill_email || '',
    company_website: company?.company_website || '',

    // User data
    user_name: user?.full_name || '',
    user_first_name: userFirstName,
    user_last_name: userLastName,
    user_email: user?.email || '',
    user_phone: user?.phone || '',

    // General
    current_date: formatDate(new Date()),
    current_year: new Date().getFullYear().toString(),
  };
}

/**
 * Builds shortcode data for payment confirmation
 */
export function buildPaymentShortCodes(
  payment: any,
  invoice: any,
  customer: any,
  company: any
): ShortCodeData {
  const customerFirstName = customer?.customer_name?.split(' ')[0] || invoice?.customer_name?.split(' ')[0] || '';
  const customerLastName = customer?.customer_name?.split(' ').slice(1).join(' ') || invoice?.customer_name?.split(' ').slice(1).join(' ') || '';

  return {
    // Customer data
    customer_first_name: customerFirstName,
    customer_last_name: customerLastName,
    customer_full_name: customer?.customer_name || invoice?.customer_name || '',
    customer_company: customer?.customer_company || invoice?.customer_company || '',
    customer_email: customer?.customer_email || invoice?.customer_email || '',
    customer_phone: customer?.customer_phone || invoice?.customer_phone || '',

    // Invoice data
    invoice_number: formatFriendlyNumber(invoice?.invoice_number || '', 'invoice'),
    invoice_total: formatCurrency(invoice?.total || 0),
    invoice_balance: formatCurrency(invoice?.balance || 0),
    invoice_date: invoice?.date ? formatDate(invoice.date) : '',

    // Payment data
    payment_amount: formatCurrency(payment?.amount || 0),
    payment_method: payment?.payment_method || payment?.source || 'Payment',
    payment_date: payment?.payment_date ? formatDate(payment.payment_date) : formatDate(new Date()),

    // Company data
    company_name: company?.company_name || '',
    company_phone: company?.bill_phone || '',
    company_email: company?.bill_email || '',
    company_website: company?.company_website || '',

    // General
    current_date: formatDate(new Date()),
    current_year: new Date().getFullYear().toString(),
  };
}
