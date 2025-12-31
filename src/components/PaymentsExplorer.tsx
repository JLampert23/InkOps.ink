import { useState, useMemo, useEffect } from 'react';
import { Search, Calendar, FileDown, ExternalLink, CreditCard, DollarSign, ChevronDown, ArrowUpDown } from 'lucide-react';
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
  const [showExportMenu, setShowExportMenu] = useState(false);

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
      orientation: 'landscape',
      summary: [
        { label: 'Total Payments', value: filteredAndSortedPayments.length.toString() },
        { label: 'Total Amount', value: formatCurrency(totalAmount) }
      ]
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700 mb-1">Total Payments</p>
              <p className="text-3xl font-bold text-blue-900">{filteredAndSortedPayments.length}</p>
            </div>
            <div className="bg-blue-200 rounded-full p-3">
              <CreditCard className="w-8 h-8 text-blue-700" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700 mb-1">Total Amount</p>
              <p className="text-3xl font-bold text-green-900">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="bg-green-200 rounded-full p-3">
              <DollarSign className="w-8 h-8 text-green-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Unified Search & Sort Bar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm font-medium text-gray-700 min-w-[140px]"
            >
              <option value="date">Sort by Date</option>
              <option value="amount">Sort by Amount</option>
            </select>
            <button
              onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white"
              title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
              <ArrowUpDown className={`w-5 h-5 text-gray-600 ${sortOrder === 'desc' ? 'rotate-180' : ''} transition-transform`} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={filteredAndSortedPayments.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
              >
                <FileDown className="w-4 h-4" />
                Export
                <ChevronDown className="w-4 h-4" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={() => {
                      handleExportCSV();
                      setShowExportMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Export as CSV
                  </button>
                  <button
                    onClick={() => {
                      handleExportPDF();
                      setShowExportMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date Range Selector with Pills */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">Date Range</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(dateRangePresetLabels).filter(key => key !== 'custom') as DateRangePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setDateRangePreset(preset)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                  dateRangePreset === preset
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {dateRangePresetLabels[preset]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={dateRangePreset === 'custom'}
                onChange={() => setDateRangePreset('custom')}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Custom Range</span>
            </label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                setDateRangePreset('custom');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <span className="text-gray-400 font-medium text-sm">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                setDateRangePreset('custom');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Showing:</span> <span className="font-semibold text-blue-700">{format(dateRange.startDate, 'MMM d, yyyy')}</span> - <span className="font-semibold text-blue-700">{format(dateRange.endDate, 'MMM d, yyyy')}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Payment Method
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Processed By
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAndSortedPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <CreditCard className="w-12 h-12 text-gray-300" />
                      <p className="text-sm font-medium">No payments found matching your criteria</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedPayments.map((payment, index) => {
                  const processedBy = payment.isPrintavoPayment
                    ? 'Printavo Payments'
                    : (payment.processorName || payment.processor || 'Outside Printavo');

                  return (
                    <tr
                      key={payment.id}
                      className={`transition-colors hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900 font-medium">
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
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                          >
                            {payment.transactedFor.visualId}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <div className="text-sm font-medium text-gray-400">N/A</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium">
                          {getCustomerName(payment, invoiceMap)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {payment.paymentMethod || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          payment.isPrintavoPayment
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {processedBy}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-bold text-green-600">
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
