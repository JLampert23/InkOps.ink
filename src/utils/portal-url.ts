export function generateSubdomainFromCompanyName(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 30);
}

/**
 * Gets the base URL for portal-related pages (quotes, customer portal, etc.)
 *
 * Priority order:
 * 1. If subdomain is provided and DNS is configured, use: https://{subdomain}.inkops.ink
 * 2. If VITE_MAIN_DOMAIN is set, use that (for when subdomains aren't configured)
 * 3. Otherwise, use current window.location.origin as fallback
 *
 * This allows the app to work even when custom subdomains aren't set up in DNS.
 */
export function getPortalBaseUrl(subdomain: string | null, companyName?: string | null): string {
  let effectiveSubdomain = subdomain;

  if (!effectiveSubdomain && companyName) {
    effectiveSubdomain = generateSubdomainFromCompanyName(companyName);
  }

  // If we have a main domain configured (e.g., Vercel deployment URL), use that
  // This allows quote approval and portal links to work without DNS setup
  const mainDomain = import.meta.env.VITE_MAIN_DOMAIN;
  if (mainDomain) {
    // Remove trailing slash if present
    return mainDomain.replace(/\/$/, '');
  }

  // If no subdomain and no main domain, use current origin
  if (!effectiveSubdomain) {
    return window.location.origin;
  }

  // Use subdomain URL (requires DNS to be configured)
  return `https://${effectiveSubdomain}.inkops.ink`;
}

export function getCustomerPortalUrl(
  customerId: string,
  subdomain: string | null,
  companyName?: string | null
): string {
  const baseUrl = getPortalBaseUrl(subdomain, companyName);
  return `${baseUrl}/customer/${customerId}`;
}

export function getQuoteApprovalUrl(
  quoteId: string,
  subdomain: string | null,
  companyName?: string | null
): string {
  const baseUrl = getPortalBaseUrl(subdomain, companyName);
  return `${baseUrl}/quote-approval/${quoteId}`;
}

export function getInvoicePortalUrl(
  invoiceId: string,
  customerId: string,
  subdomain: string | null,
  companyName?: string | null
): string {
  const baseUrl = getPortalBaseUrl(subdomain, companyName);
  return `${baseUrl}/customer/${customerId}/invoice/${invoiceId}`;
}

export function getWorkOrderPortalUrl(
  workOrderId: string,
  customerId: string,
  subdomain: string | null,
  companyName?: string | null
): string {
  const baseUrl = getPortalBaseUrl(subdomain, companyName);
  return `${baseUrl}/customer/${customerId}/work-order/${workOrderId}`;
}

export function isValidSubdomain(subdomain: string | null): boolean {
  if (!subdomain) return false;
  return /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(subdomain) || /^[a-z0-9]$/.test(subdomain);
}
