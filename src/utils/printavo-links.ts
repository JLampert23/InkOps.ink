/**
 * Utility functions for generating Printavo links
 */

/**
 * Generate a link to an invoice in Printavo
 * @param invoiceId - The internal invoice ID (not the visualId)
 * @returns The full URL to the invoice in Printavo
 */
export function getPrintavoInvoiceUrl(invoiceId: string): string {
  // Printavo URLs use the internal ID, not the visualId
  // Example: https://www.printavo.com/invoices/21448938
  return `https://www.printavo.com/invoices/${invoiceId}`;
}

/**
 * Generate a link to a customer in Printavo
 * @param customerId - The customer ID
 * @returns The full URL to the customer in Printavo
 */
export function getPrintavoCustomerUrl(customerId: string): string {
  return `https://www.printavo.com/customers/${customerId}`;
}
