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
    { name: 'current', label: '1-30 days', minDays: 1, maxDays: 30, invoices: [], total: 0, count: 0 },
    { name: '30', label: '31-60 days', minDays: 31, maxDays: 60, invoices: [], total: 0, count: 0 },
    { name: '60', label: '61-90 days', minDays: 61, maxDays: 90, invoices: [], total: 0, count: 0 },
    { name: '90', label: '90+ days', minDays: 90, maxDays: null, invoices: [], total: 0, count: 0 },
  ];

  const filteredInvoices = invoices.filter(invoice => {
    const total = invoice.total || 0;
    const amountOutstanding = invoice.amountOutstanding || 0;
    const status = invoice.status?.name?.toLowerCase() || '';

    return total > 0
      && amountOutstanding > 0
      && !status.includes('dead');
  });

  filteredInvoices.forEach(invoice => {
    const daysPastDue = calculateDaysPastDue(invoice.dueAt, invoice.invoiceAt || invoice.createdAt);
    const balance = invoice.amountOutstanding || 0;

    for (const bucket of buckets) {
      if (bucket.maxDays === null) {
        if (daysPastDue >= bucket.minDays) {
          bucket.invoices.push(invoice);
          bucket.total += balance;
          bucket.count++;
          break;
        }
      } else {
        if (daysPastDue >= bucket.minDays && daysPastDue <= bucket.maxDays) {
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

  const filteredInvoices = invoices.filter(invoice => {
    const total = invoice.total || 0;
    const amountOutstanding = invoice.amountOutstanding || 0;
    const status = invoice.status?.name?.toLowerCase() || '';

    return total > 0
      && amountOutstanding > 0
      && !status.includes('dead');
  });

  filteredInvoices.forEach(invoice => {
    const customerId = invoice.contact?.customer?.id || invoice.contact?.id || 'unknown';
    const customerName = invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown Customer';
    const balance = invoice.amountOutstanding || 0;
    const daysPastDue = calculateDaysPastDue(invoice.dueAt, invoice.invoiceAt || invoice.createdAt);

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customerId,
        customerName,
        current: 0,
        days30: 0,
        days60: 0,
        days90: 0,
        total: 0,
        invoiceCount: 0,
        oldestInvoiceAge: 0,
        averageInvoiceAge: 0,
      });
    }

    const customer = customerMap.get(customerId)!;
    customer.total += balance;
    customer.invoiceCount++;
    customer.oldestInvoiceAge = Math.max(customer.oldestInvoiceAge, daysPastDue);

    if (daysPastDue >= 1 && daysPastDue <= 30) {
      customer.current += balance;
    } else if (daysPastDue >= 31 && daysPastDue <= 60) {
      customer.days30 += balance;
    } else if (daysPastDue >= 61 && daysPastDue <= 90) {
      customer.days60 += balance;
    } else if (daysPastDue >= 90) {
      customer.days90 += balance;
    }
  });

  const customers = Array.from(customerMap.values());

  customers.forEach(customer => {
    const invoicesForCustomer = filteredInvoices.filter(inv => {
      const custId = inv.contact?.customer?.id || inv.contact?.id || 'unknown';
      return custId === customer.customerId;
    });

    const totalDays = invoicesForCustomer.reduce((sum, inv) =>
      sum + calculateDaysPastDue(inv.dueAt, inv.invoiceAt || inv.createdAt), 0
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
