import { Invoice, PaymentWithInvoice } from '../types/printavo';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ARAgingBucket {
  name: string;
  label: string;
  minDays: number;
  maxDays: number | null;
  total: number;
  count: number;
  invoices: Invoice[];
}

export interface PaymentReportData {
  payments: PaymentWithInvoice[];
  totalAmount: number;
  paymentCount: number;
  averagePayment: number;
}

export interface SalesReportPeriod {
  period: string;
  periodDate: Date;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
}

export interface CustomerMetrics {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
  lastInvoiceDate: Date | null;
  averageInvoiceAmount: number;
}

export function filterInvoicesByDateRange(
  invoices: Invoice[],
  dateRange: DateRange
): Invoice[] {
  return invoices.filter(invoice => {
    const invoiceDate = new Date(invoice.invoiceAt || invoice.createdAt);
    return isWithinInterval(invoiceDate, {
      start: startOfDay(dateRange.startDate),
      end: endOfDay(dateRange.endDate),
    });
  });
}

export function filterPaymentsByDateRange(
  payments: PaymentWithInvoice[],
  dateRange: DateRange
): PaymentWithInvoice[] {
  return payments.filter(payment => {
    const paymentDate = new Date(
      payment.transactionDate || payment.timestamps?.createdAt || ''
    );
    return isWithinInterval(paymentDate, {
      start: startOfDay(dateRange.startDate),
      end: endOfDay(dateRange.endDate),
    });
  });
}

export function buildARAgingReport(
  invoices: Invoice[],
  dateRange?: DateRange
): ARAgingBucket[] {
  let filteredInvoices = invoices;

  if (dateRange) {
    filteredInvoices = filterInvoicesByDateRange(invoices, dateRange);
  }

  const openInvoices = filteredInvoices.filter(
    inv => (inv.amountOutstanding || 0) > 0
  );

  const buckets: ARAgingBucket[] = [
    { name: 'current', label: '0-30 days', minDays: 0, maxDays: 30, total: 0, count: 0, invoices: [] },
    { name: '30-60', label: '31-60 days', minDays: 31, maxDays: 60, total: 0, count: 0, invoices: [] },
    { name: '60-90', label: '61-90 days', minDays: 61, maxDays: 90, total: 0, count: 0, invoices: [] },
    { name: '90-plus', label: '90+ days', minDays: 91, maxDays: null, total: 0, count: 0, invoices: [] },
  ];

  openInvoices.forEach(invoice => {
    const invoiceDate = invoice.invoiceAt || invoice.createdAt;
    const dueDate = invoice.dueAt;
    const today = new Date();

    let daysPastDue: number;
    if (dueDate) {
      const due = new Date(dueDate);
      const diffTime = today.getTime() - due.getTime();
      daysPastDue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    } else {
      const created = new Date(invoiceDate);
      const diffTime = today.getTime() - created.getTime();
      daysPastDue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    for (const bucket of buckets) {
      const inBucket =
        daysPastDue >= bucket.minDays &&
        (bucket.maxDays === null || daysPastDue <= bucket.maxDays);

      if (inBucket) {
        bucket.total += invoice.amountOutstanding || 0;
        bucket.count += 1;
        bucket.invoices.push(invoice);
        break;
      }
    }
  });

  return buckets;
}

export function buildPaymentsReport(
  payments: PaymentWithInvoice[],
  dateRange: DateRange
): PaymentReportData {
  const filteredPayments = filterPaymentsByDateRange(payments, dateRange);

  const totalAmount = filteredPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const paymentCount = filteredPayments.length;
  const averagePayment = paymentCount > 0 ? totalAmount / paymentCount : 0;

  return {
    payments: filteredPayments,
    totalAmount,
    paymentCount,
    averagePayment,
  };
}

export function buildCustomerSummaryReport(
  invoices: Invoice[],
  dateRange: DateRange
): CustomerMetrics[] {
  const filteredInvoices = filterInvoicesByDateRange(invoices, dateRange);

  const customerMap = new Map<string, CustomerMetrics>();

  filteredInvoices.forEach(invoice => {
    const customerId = invoice.contact?.customer?.id || invoice.contact?.id || 'unknown';
    const customerName =
      invoice.contact?.customer?.companyName ||
      invoice.contact?.fullName ||
      'Unknown';

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customerId,
        customerName,
        totalRevenue: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        invoiceCount: 0,
        lastInvoiceDate: null,
        averageInvoiceAmount: 0,
      });
    }

    const metrics = customerMap.get(customerId)!;
    metrics.totalRevenue += invoice.total || 0;
    metrics.totalPaid += invoice.amountPaid || 0;
    metrics.totalOutstanding += invoice.amountOutstanding || 0;
    metrics.invoiceCount += 1;

    const invoiceDate = new Date(invoice.invoiceAt || invoice.createdAt);
    if (!metrics.lastInvoiceDate || invoiceDate > metrics.lastInvoiceDate) {
      metrics.lastInvoiceDate = invoiceDate;
    }
  });

  const customers = Array.from(customerMap.values());

  customers.forEach(customer => {
    customer.averageInvoiceAmount =
      customer.invoiceCount > 0
        ? customer.totalRevenue / customer.invoiceCount
        : 0;
  });

  return customers;
}

export function calculatePaymentMethodBreakdown(
  payments: PaymentWithInvoice[]
): Record<string, { count: number; total: number }> {
  const breakdown: Record<string, { count: number; total: number }> = {};

  payments.forEach(payment => {
    const method = payment.paymentMethod || 'Unknown';

    if (!breakdown[method]) {
      breakdown[method] = { count: 0, total: 0 };
    }

    breakdown[method].count += 1;
    breakdown[method].total += payment.amount;
  });

  return breakdown;
}

export function calculateInvoiceStatusBreakdown(invoices: Invoice[]): {
  paid: number;
  partial: number;
  unpaid: number;
  overdue: number;
} {
  const breakdown = {
    paid: 0,
    partial: 0,
    unpaid: 0,
    overdue: 0,
  };

  invoices.forEach(invoice => {
    const outstanding = invoice.amountOutstanding || 0;
    const paid = invoice.amountPaid || 0;

    if (outstanding === 0 && paid > 0) {
      breakdown.paid += 1;
    } else if (paid > 0 && outstanding > 0) {
      breakdown.partial += 1;
    } else if (outstanding > 0) {
      const dueDate = invoice.dueAt ? new Date(invoice.dueAt) : null;
      const isOverdue = dueDate && dueDate < new Date();

      if (isOverdue) {
        breakdown.overdue += 1;
      } else {
        breakdown.unpaid += 1;
      }
    }
  });

  return breakdown;
}
