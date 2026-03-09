export function generateSubdomainFromCompanyName(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 30);
}

export function getPortalBaseUrl(subdomain: string | null, companyName?: string | null): string {
  let effectiveSubdomain = subdomain;

  if (!effectiveSubdomain && companyName) {
    effectiveSubdomain = generateSubdomainFromCompanyName(companyName);
  }

  if (!effectiveSubdomain) {
    return window.location.origin;
  }

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
