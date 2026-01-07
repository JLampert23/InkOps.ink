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
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90Plus: number;
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

export function getAllInvoicesForAging(invoices: Invoice[]): Invoice[] {
  return invoices.filter(invoice => {
    const amountOutstanding = invoice.amountOutstanding || 0;
    return amountOutstanding > 0;
  });
}

export function categorizeIntoAgingBuckets(invoices: Invoice[]): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { name: 'current', label: 'Current', minDays: 0, maxDays: 30, invoices: [], total: 0, count: 0 },
    { name: '1-30', label: '1-30', minDays: 31, maxDays: 60, invoices: [], total: 0, count: 0 },
    { name: '31-60', label: '31-60', minDays: 61, maxDays: 90, invoices: [], total: 0, count: 0 },
    { name: '61-90', label: '61-90', minDays: 91, maxDays: 120, invoices: [], total: 0, count: 0 },
    { name: '90+', label: '90+', minDays: 121, maxDays: null, invoices: [], total: 0, count: 0 },
  ];

  const allInvoices = getAllInvoicesForAging(invoices);

  allInvoices.forEach(invoice => {
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

  const allInvoices = getAllInvoicesForAging(invoices);

  allInvoices.forEach(invoice => {
    const customerId = invoice.contact?.customer?.id || invoice.contact?.id || 'unknown';
    const customerName = invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown Customer';
    const balance = invoice.amountOutstanding || 0;
    const daysPastDue = calculateDaysPastDue(invoice.dueAt, invoice.invoiceAt || invoice.createdAt);

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customerId,
        customerName,
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90Plus: 0,
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

    if (daysPastDue <= 30) {
      customer.current += balance;
    } else if (daysPastDue <= 60) {
      customer.days1to30 += balance;
    } else if (daysPastDue <= 90) {
      customer.days31to60 += balance;
    } else if (daysPastDue <= 120) {
      customer.days61to90 += balance;
    } else {
      customer.days90Plus += balance;
    }
  });

  const customers = Array.from(customerMap.values());

  customers.forEach(customer => {
    const invoicesForCustomer = allInvoices.filter(inv => {
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
