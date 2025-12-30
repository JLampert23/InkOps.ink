import { format, parseISO, isWithinInterval } from 'date-fns';
import type { Invoice, Payment } from '../types/printavo';

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  invoiceCount: number;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalPayments: number;
  outstandingBalance: number;
  totalFees: number;
  totalTax: number;
  averageInvoiceValue: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  monthlyRevenue: MonthlyRevenue[];
  revenueByStatus: Record<string, number>;
  paymentsByMethod: Record<string, number>;
  feesByType: Record<string, number>;
}

export function calculateFinancialSummary(
  invoices: Invoice[],
  payments: Payment[]
): FinancialSummary {
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

  const totalPayments = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

  const outstandingBalance = invoices.reduce((sum, inv) => {
    return sum + (inv.amountOutstanding || 0);
  }, 0);

  const totalFees = invoices.reduce((sum, inv) => {
    const invoiceFees = inv.fees?.edges?.reduce((feeSum, edge) => feeSum + edge.node.amount, 0) || 0;
    return sum + invoiceFees;
  }, 0);

  const totalTax = invoices.reduce((sum, inv) => sum + (inv.salesTaxAmount || 0), 0);

  const averageInvoiceValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;

  const paidInvoiceCount = invoices.filter(inv => inv.paidInFull).length;

  const monthlyRevenue = calculateMonthlyRevenue(invoices);

  const revenueByStatus: Record<string, number> = {};
  invoices.forEach(inv => {
    const status = inv.status?.name || 'unknown';
    revenueByStatus[status] = (revenueByStatus[status] || 0) + (inv.total || 0);
  });

  const paymentsByMethod: Record<string, number> = {};
  payments.forEach(payment => {
    const method = (payment as any).paymentMethod || 'unknown';
    paymentsByMethod[method] = (paymentsByMethod[method] || 0) + (payment.amount || 0);
  });

  const feesByType: Record<string, number> = {};
  invoices.forEach(inv => {
    inv.fees?.edges?.forEach(edge => {
      const feeName = edge.node.description || 'unknown';
      feesByType[feeName] = (feesByType[feeName] || 0) + edge.node.amount;
    });
  });

  return {
    totalRevenue,
    totalPayments,
    outstandingBalance,
    totalFees,
    totalTax,
    averageInvoiceValue,
    invoiceCount: invoices.length,
    paidInvoiceCount,
    monthlyRevenue,
    revenueByStatus,
    paymentsByMethod,
    feesByType,
  };
}

export function calculateMonthlyRevenue(invoices: Invoice[]): MonthlyRevenue[] {
  const monthlyData: Record<string, { revenue: number; count: number }> = {};

  invoices.forEach(inv => {
    if (!inv.createdAt) return;

    try {
      const date = parseISO(inv.createdAt);
      const monthKey = format(date, 'yyyy-MM');

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, count: 0 };
      }

      monthlyData[monthKey].revenue += inv.total || 0;
      monthlyData[monthKey].count += 1;
    } catch (error) {
      console.error('Error parsing date:', inv.createdAt, error);
    }
  });

  return Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      revenue: data.revenue,
      invoiceCount: data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function calculateCustomerLifetimeValue(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
}

export function calculateCustomerOutstandingBalance(invoices: Invoice[]): number {
  return invoices.reduce((sum, inv) => sum + (inv.amountOutstanding || 0), 0);
}

export function filterInvoicesByDateRange(
  invoices: Invoice[],
  startDate: Date,
  endDate: Date
): Invoice[] {
  return invoices.filter(inv => {
    if (!inv.createdAt) return false;
    try {
      const date = parseISO(inv.createdAt);
      return isWithinInterval(date, { start: startDate, end: endDate });
    } catch {
      return false;
    }
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}
