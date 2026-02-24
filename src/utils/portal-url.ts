export function getPortalBaseUrl(companySubdomain: string | null): string {
  if (companySubdomain) {
    return `https://${companySubdomain}.inkops.ink`;
  }
  return window.location.origin;
}

export function getCustomerPortalUrl(customerId: string, companySubdomain: string | null): string {
  const baseUrl = getPortalBaseUrl(companySubdomain);
  return `${baseUrl}/customer/${customerId}`;
}

export function getQuoteApprovalUrl(quoteId: string, companySubdomain: string | null): string {
  const baseUrl = getPortalBaseUrl(companySubdomain);
  return `${baseUrl}/quote-approval/${quoteId}`;
}

export function extractSubdomainFromCustomerUrl(customerUrl: string | null): string | null {
  if (!customerUrl) return null;

  try {
    const url = new URL(customerUrl.startsWith('http') ? customerUrl : `https://${customerUrl}`);
    const hostname = url.hostname;
    const parts = hostname.split('.');

    if (parts.length >= 3 && parts[parts.length - 2] === 'inkops' && parts[parts.length - 1] === 'ink') {
      return parts.slice(0, -2).join('.');
    }

    if (parts.length >= 2 && (parts[parts.length - 1] === 'ink' || parts[parts.length - 1] === 'com')) {
      return parts[0];
    }

    return parts[0];
  } catch {
    const cleanUrl = customerUrl.replace(/^https?:\/\//, '').split('/')[0];
    const parts = cleanUrl.split('.');
    return parts[0] || null;
  }
}
