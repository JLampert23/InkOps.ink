import { Invoice } from '../types/printavo';

export interface AgingBucket {
  name: string;
  label: string;
  minDays: number;
  maxDays: number | null;
  invoices: Invoice[];
  total: number;
  count: number;
}

export interface CustomerAging {
  customerId: string;
  customerName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120: number;
  total: number;
  invoiceCount: number;
  oldestInvoiceAge: number;
  averageInvoiceAge: number;
}

export function calculateDaysOutstanding(createdAt: string): number {
  const created = new Date(createdAt);
  const today = new Date();
  const diffTime = today.getTime() - created.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function calculateDaysPastDue(dueDate: string | null | undefined, invoiceDate: string): number {
  if (!dueDate) {
    return calculateDaysOutstanding(invoiceDate);
  }

  const due = new Date(dueDate);
  const today = new Date();
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function isInvoiceOpen(invoice: Invoice): boolean {
  const total = invoice.total || 0;
  const amountPaid = invoice.amountPaid || 0;
  const amountOutstanding = invoice.amountOutstanding || 0;

  if (total === 0) {
    return false;
  }

  const status = invoice.status?.name?.toLowerCase() || '';
  if (status.includes('dead')) {
    return false;
  }

  const hasBalance = amountOutstanding > 0;
  const notPaidInFull = invoice.paidInFull === false;
  const hasTotalNotPaid = total > amountPaid;

  return hasBalance || notPaidInFull || hasTotalNotPaid;
}

export function getOpenInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter(isInvoiceOpen);
}

export function categorizeIntoAgingBuckets(invoices: Invoice[]): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { name: 'current', label: '1-30 days', minDays: 0, maxDays: 30, invoices: [], total: 0, count: 0 },
    { name: '30', label: '31-60 days', minDays: 31, maxDays: 60, invoices: [], total: 0, count: 0 },
    { name: '60', label: '61-90 days', minDays: 61, maxDays: 90, invoices: [], total: 0, count: 0 },
    { name: '90', label: '91-120 days', minDays: 91, maxDays: 120, invoices: [], total: 0, count: 0 },
    { name: '120', label: '121+ days', minDays: 121, maxDays: null, invoices: [], total: 0, count: 0 },
  ];

  const openInvoices = getOpenInvoices(invoices);

  openInvoices.forEach(invoice => {
    const daysOutstanding = calculateDaysOutstanding(invoice.createdAt);
    const balance = invoice.amountOutstanding || 0;

    for (const bucket of buckets) {
      if (bucket.maxDays === null) {
        if (daysOutstanding >= bucket.minDays) {
          bucket.invoices.push(invoice);
          bucket.total += balance;
          bucket.count++;
          break;
        }
      } else {
        if (daysOutstanding >= bucket.minDays && daysOutstanding <= bucket.maxDays) {
          bucket.invoices.push(invoice);
          bucket.total += balance;
          bucket.count++;
          break;
        }
      }
    }
  });

  return buckets;
}

export function calculateCustomerAging(invoices: Invoice[]): CustomerAging[] {
  const customerMap = new Map<string, CustomerAging>();

  const openInvoices = getOpenInvoices(invoices);

  openInvoices.forEach(invoice => {
    const customerId = invoice.contact?.customer?.id || invoice.contact?.id || 'unknown';
    const customerName = invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown Customer';
    const balance = invoice.amountOutstanding || 0;
    const daysOutstanding = calculateDaysOutstanding(invoice.createdAt);

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customerId,
        customerName,
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        days120: 0,
        total: 0,
        invoiceCount: 0,
        oldestInvoiceAge: 0,
        averageInvoiceAge: 0,
      });
    }

    const customer = customerMap.get(customerId)!;
    customer.total += balance;
    customer.invoiceCount++;
    customer.oldestInvoiceAge = Math.max(customer.oldestInvoiceAge, daysOutstanding);

    if (daysOutstanding <= 30) {
      customer.current += balance;
    } else if (daysOutstanding <= 60) {
      customer.days30 += balance;
    } else if (daysOutstanding <= 90) {
      customer.days60 += balance;
    } else if (daysOutstanding <= 120) {
      customer.days90 += balance;
    } else {
      customer.days120 += balance;
    }
  });

  const customers = Array.from(customerMap.values());

  customers.forEach(customer => {
    const invoicesForCustomer = openInvoices.filter(inv => {
      const custId = inv.contact?.customer?.id || inv.contact?.id || 'unknown';
      return custId === customer.customerId;
    });

    const totalDays = invoicesForCustomer.reduce((sum, inv) =>
      sum + calculateDaysOutstanding(inv.createdAt), 0
    );
    customer.averageInvoiceAge = customer.invoiceCount > 0
      ? Math.round(totalDays / customer.invoiceCount)
      : 0;
  });

  return customers.sort((a, b) => b.total - a.total);
}

export function calculateTotalAR(invoices: Invoice[]): number {
  return getOpenInvoices(invoices).reduce(
    (sum, invoice) => sum + (invoice.amountOutstanding || 0),
    0
  );
}

export function calculateAverageDaysOutstanding(invoices: Invoice[]): number {
  const openInvoices = getOpenInvoices(invoices);
  if (openInvoices.length === 0) return 0;

  const totalDays = openInvoices.reduce(
    (sum, invoice) => sum + calculateDaysOutstanding(invoice.createdAt),
    0
  );

  return Math.round(totalDays / openInvoices.length);
}

export function getHighestOutstandingCustomer(invoices: Invoice[]): { name: string; balance: number } {
  const customerAging = calculateCustomerAging(invoices);
  if (customerAging.length === 0) return { name: 'None', balance: 0 };

  const highest = customerAging[0];
  return { name: highest.customerName, balance: highest.total };
}
