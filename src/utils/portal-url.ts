export function getPortalBaseUrl(_subdomain: string | null): string {
  return window.location.origin;
}

export function getCustomerPortalUrl(customerId: string, subdomain: string | null): string {
  const baseUrl = getPortalBaseUrl(subdomain);
  return `${baseUrl}/customer/${customerId}`;
}

export function getQuoteApprovalUrl(quoteId: string, subdomain: string | null): string {
  const baseUrl = getPortalBaseUrl(subdomain);
  return `${baseUrl}/quote-approval/${quoteId}`;
}
