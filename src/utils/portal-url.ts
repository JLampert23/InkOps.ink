export function getCurrentSubdomain(): string | null {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  if (parts.length >= 3 && parts[parts.length - 2] === 'inkops' && parts[parts.length - 1] === 'ink') {
    return parts.slice(0, -2).join('.');
  }

  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    return parts.length > 1 ? parts[0] : null;
  }

  return null;
}

export function getPortalBaseUrl(): string {
  const subdomain = getCurrentSubdomain();
  if (subdomain) {
    return `https://${subdomain}.inkops.ink`;
  }
  return window.location.origin;
}

export function getCustomerPortalUrl(customerId: string): string {
  const baseUrl = getPortalBaseUrl();
  return `${baseUrl}/customer/${customerId}`;
}

export function getQuoteApprovalUrl(quoteId: string): string {
  const baseUrl = getPortalBaseUrl();
  return `${baseUrl}/quote-approval/${quoteId}`;
}
