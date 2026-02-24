export function getPortalBaseUrl(subdomain: string | null): string {
  if (subdomain) {
    return `https://${subdomain}.inkops.ink`;
  }
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
