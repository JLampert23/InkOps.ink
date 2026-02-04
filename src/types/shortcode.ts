export interface ShortCodeData {
  // Customer data
  customer_first_name?: string;
  customer_last_name?: string;
  customer_full_name?: string;
  customer_company?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  customer_zip?: string;

  // Quote data
  quote_number?: string;
  quote_total?: string;
  quote_subtotal?: string;
  quote_tax?: string;
  quote_discount?: string;
  quote_date?: string;
  quote_expiry_date?: string;
  quote_link?: string;
  quote_status?: string;
  art_approval_link?: string;

  // Invoice data
  invoice_number?: string;
  invoice_total?: string;
  invoice_subtotal?: string;
  invoice_tax?: string;
  invoice_balance?: string;
  invoice_date?: string;
  invoice_due_date?: string;
  invoice_link?: string;
  invoice_status?: string;

  // Company/Organization data
  company_name?: string;
  company_address?: string;
  company_city?: string;
  company_state?: string;
  company_zip?: string;
  company_phone?: string;
  company_email?: string;
  company_website?: string;

  // User data (sender)
  user_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  user_email?: string;
  user_phone?: string;

  // Payment data
  payment_amount?: string;
  payment_method?: string;
  payment_date?: string;
  payment_link?: string;

  // General
  current_date?: string;
  current_year?: string;
}

export type ShortCodeKey = keyof ShortCodeData;

export const AVAILABLE_SHORT_CODES: Record<ShortCodeKey, string> = {
  // Customer
  customer_first_name: 'Customer First Name',
  customer_last_name: 'Customer Last Name',
  customer_full_name: 'Customer Full Name',
  customer_company: 'Customer Company',
  customer_email: 'Customer Email',
  customer_phone: 'Customer Phone',
  customer_address: 'Customer Address',
  customer_city: 'Customer City',
  customer_state: 'Customer State',
  customer_zip: 'Customer ZIP Code',

  // Quote
  quote_number: 'Quote Number',
  quote_total: 'Quote Total Amount',
  quote_subtotal: 'Quote Subtotal',
  quote_tax: 'Quote Tax Amount',
  quote_discount: 'Quote Discount',
  quote_date: 'Quote Date',
  quote_expiry_date: 'Quote Expiry Date',
  quote_link: 'Quote Approval Link',
  quote_status: 'Quote Status',
  art_approval_link: 'Art Approval Link',

  // Invoice
  invoice_number: 'Invoice Number',
  invoice_total: 'Invoice Total Amount',
  invoice_subtotal: 'Invoice Subtotal',
  invoice_tax: 'Invoice Tax Amount',
  invoice_balance: 'Invoice Outstanding Balance',
  invoice_date: 'Invoice Date',
  invoice_due_date: 'Invoice Due Date',
  invoice_link: 'Invoice Payment Link',
  invoice_status: 'Invoice Status',

  // Company
  company_name: 'Company Name',
  company_address: 'Company Address',
  company_city: 'Company City',
  company_state: 'Company State',
  company_zip: 'Company ZIP Code',
  company_phone: 'Company Phone',
  company_email: 'Company Email',
  company_website: 'Company Website',

  // User
  user_name: 'User Full Name',
  user_first_name: 'User First Name',
  user_last_name: 'User Last Name',
  user_email: 'User Email',
  user_phone: 'User Phone',

  // Payment
  payment_amount: 'Payment Amount',
  payment_method: 'Payment Method',
  payment_date: 'Payment Date',
  payment_link: 'Payment Link',

  // General
  current_date: 'Current Date',
  current_year: 'Current Year',
};
