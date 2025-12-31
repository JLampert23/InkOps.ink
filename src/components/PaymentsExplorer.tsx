import { useState, useMemo, useEffect } from 'react';
import { Search, Calendar, FileDown, ExternalLink } from 'lucide-react';
import { PaymentWithInvoice, Invoice } from '../types/printavo';
import { formatCurrency } from '../utils/financial-aggregations';
import { format, parseISO, isWithinInterval, subMonths, startOfDay, endOfDay } from 'date-fns';
import { exportToCSV } from '../utils/csv-export';
import { exportToPDF } from '../utils/pdf-export';
import { DateRangePreset, getDateRangeForPreset, dateRangePresetLabels } from '../utils/date-ranges';
import { getPrintavoInvoiceUrl } from '../utils/printavo-links';

interface PaymentsExplorerProps {
  payments: PaymentWithInvoice[];
  invoices: Invoice[];
  loading?: boolean;
}

function getCustomerName(payment: PaymentWithInvoice, invoiceMap: Map<string, Invoice>): string {
  // First try to get customer from payment's nested contact (if available)
  const contact = payment.transactedFor?.contact;
  if (contact) {
    if (contact.customer?.companyName) {
      return contact.customer.companyName;
    }
    if (contact.fullName) {
      return contact.fullName;
    }
    if (contact.firstName || contact.lastName) {
      return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
    }
  }

  // Fall back to looking up the invoice by ID
  const invoiceId = payment.transactedFor?.id;
  if (invoiceId) {
    const invoice = invoiceMap.get(invoiceId);
    if (invoice?.contact) {
      if (invoice.contact.customer?.companyName) {
        return invoice.contact.customer.companyName;
      }
      if (invoice.contact.fullName) {
        return invoice.contact.fullName;
      }
    }
  }

  return 'Unknown';
}

export function PaymentsExplorer({ payments, invoices, loading }: PaymentsExplorerProps) {
  // Create invoice lookup map for matching payments to invoices
  const invoiceMap = useMemo(() => {
    const map = new Map<string, Invoice>();
    invoices.forEach(inv => {
      map.set(inv.id, inv);
    });
    return map;
  }, [invoices]);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const dateRange = useMemo(() => {
    if (dateRangePreset === 'custom' && customStartDate && customEndDate) {
      return {
        startDate: new Date(customStartDate),
        endDate: new Date(customEndDate)
      };
    }
    return getDateRangeForPreset(dateRangePreset);
  }, [dateRangePreset, customStartDate, customEndDate]);

  const filteredAndSortedPayments = useMemo(() => {
    let filtered = payments.filter(payment => {
      const orderNumber = payment.transactedFor?.visualId || '';
      const customerName = getCustomerName(payment, invoiceMap);

      const matchesSearch =
        orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesDate = true;
      const paymentDate = new Date(payment.transactionDate || payment.timestamps?.createdAt || '');
      if (paymentDate) {
        matchesDate = isWithinInterval(paymentDate, {
          start: dateRange.startDate,
          end: dateRange.endDate
        });
      }

      return matchesSearch && matchesDate;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        const aDate = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
        const bDate = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
        comparison = aDate - bDate;
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [payments, searchTerm, dateRange, sortBy, sortOrder, invoiceMap]);

  const totalAmount = useMemo(() => {
    return filteredAndSortedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [filteredAndSortedPayments]);

  const handleExportCSV = () => {
    const data = filteredAndSortedPayments.map(payment => ({
      paymentDate: payment.transactionDate || payment.timestamps?.createdAt || '',
      invoiceNumber: payment.transactedFor?.visualId || 'N/A',
      customer: getCustomerName(payment, invoiceMap),
      paymentMethod: payment.paymentMethod || 'N/A',
      processedBy: payment.isPrintavoPayment ? 'Printavo Payments' : (payment.processorName || payment.processor || 'Outside Printavo'),
      amount: payment.amount || 0
    }));

    exportToCSV(
      data,
      [
        { header: 'Date', key: 'paymentDate', formatter: (val) => val ? format(new Date(val), 'MMM d, yyyy') : '' },
        { header: 'Invoice #', key: 'invoiceNumber' },
        { header: 'Customer', key: 'customer' },
        { header: 'Payment Method', key: 'paymentMethod' },
        { header: 'Processed By', key: 'processedBy' },
        { header: 'Amount', key: 'amount', formatter: (val) => `$${val.toFixed(2)}` }
      ],
      `payments-report-${format(new Date(), 'yyyy-MM-dd')}`
    );
  };

  const handleExportPDF = () => {
    const data = filteredAndSortedPayments.map(payment => ({
      paymentDate: payment.transactionDate || payment.timestamps?.createdAt || '',
      invoiceNumber: payment.transactedFor?.visualId || 'N/A',
      customer: getCustomerName(payment, invoiceMap),
      paymentMethod: payment.paymentMethod || 'N/A',
      processedBy: payment.isPrintavoPayment ? 'Printavo Payments' : (payment.processorName || payment.processor || 'Outside Printavo'),
      amount: payment.amount || 0
    }));

    exportToPDF({
      title: 'Payments Report',
      subtitle: `${format(dateRange.startDate, 'MMM d, yyyy')} - ${format(dateRange.endDate, 'MMM d, yyyy')}`,
      filename: `payments-report-${format(new Date(), 'yyyy-MM-dd')}`,
      columns: [
        { header: 'Date', dataKey: 'paymentDate', formatter: (val) => val ? format(new Date(val), 'MMM d, yyyy') : 'N/A' },
        { header: 'Invoice #', dataKey: 'invoiceNumber' },
        { header: 'Customer', dataKey: 'customer' },
        { header: 'Method', dataKey: 'paymentMethod' },
        { header: 'Processed By', dataKey: 'processedBy' },
        { header: 'Amount', dataKey: 'amount', formatter: (val) => `$${val.toFixed(2)}` }
      ],
      data,
      orientation: 'landscape'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading payments...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Payments Report</h2>
            <p className="text-gray-600 mt-1">
              {filteredAndSortedPayments.length} payments · {formatCurrency(totalAmount)} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={filteredAndSortedPayments.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              <span className="font-medium">Export CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={filteredAndSortedPayments.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              <span className="font-medium">Export PDF</span>
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by invoice or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
              </select>
              <button
                onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white font-medium text-gray-700"
                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-gray-700" />
              <h3 className="text-base font-semibold text-gray-900">Date Range</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {(Object.keys(dateRangePresetLabels).filter(key => key !== 'custom') as DateRangePreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDateRangePreset(preset)}
                  className={`px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    dateRangePreset === preset
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 shadow-sm'
                  }`}
                >
                  {dateRangePresetLabels[preset]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={dateRangePreset === 'custom'}
                  onChange={() => setDateRangePreset('custom')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Custom Range:</span>
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setDateRangePreset('custom');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-gray-500 font-medium">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setDateRangePreset('custom');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="mt-4 px-3 py-2 bg-white rounded border border-gray-200">
              <p className="text-sm font-medium text-gray-700">
                Showing: <span className="text-blue-600">{format(dateRange.startDate, 'MMM d, yyyy')}</span> - <span className="text-blue-600">{format(dateRange.endDate, 'MMM d, yyyy')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Processed By
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No payments found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredAndSortedPayments.map(payment => {
                  const processedBy = payment.isPrintavoPayment
                    ? 'Printavo Payments'
                    : (payment.processorName || payment.processor || 'Outside Printavo');

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {payment.transactionDate
                            ? format(parseISO(payment.transactionDate), 'MMM d, yyyy')
                            : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payment.transactedFor?.visualId ? (
                          <a
                            href={getPrintavoInvoiceUrl(payment.transactedFor.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                          >
                            {payment.transactedFor.visualId}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <div className="text-sm font-medium text-gray-900">N/A</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getCustomerName(payment, invoiceMap)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {payment.paymentMethod || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          payment.isPrintavoPayment
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {processedBy}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(payment.amount)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
