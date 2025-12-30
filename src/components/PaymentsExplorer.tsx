import { useState, useMemo } from 'react';
import { Search, Calendar, FileDown, ExternalLink } from 'lucide-react';
import { PaymentWithInvoice } from '../types/printavo';
import { formatCurrency } from '../utils/financial-aggregations';
import { format, parseISO, isWithinInterval, subMonths, startOfDay, endOfDay } from 'date-fns';
import { exportToCSV } from '../utils/csv-export';
import { exportToPDF } from '../utils/pdf-export';
import { DateRangePreset, getDateRangeForPreset, dateRangePresetLabels } from '../utils/date-ranges';
import { getPrintavoInvoiceUrl } from '../utils/printavo-links';

interface PaymentsExplorerProps {
  payments: PaymentWithInvoice[];
  loading?: boolean;
}

export function PaymentsExplorer({ payments, loading }: PaymentsExplorerProps) {
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
      const customerName = payment.transactedFor?.contact?.customer?.companyName || payment.transactedFor?.contact?.fullName || '';

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
  }, [payments, searchTerm, dateRange, sortBy, sortOrder]);

  const totalAmount = useMemo(() => {
    return filteredAndSortedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [filteredAndSortedPayments]);

  const handleExportCSV = () => {
    const data = filteredAndSortedPayments.map(payment => ({
      customer: payment.transactedFor?.contact?.customer?.companyName || payment.transactedFor?.contact?.fullName || 'Unknown',
      paymentDate: payment.transactionDate || payment.timestamps?.createdAt || '',
      paymentMethod: payment.paymentMethod || 'N/A',
      amount: payment.amount || 0,
      invoiceNumber: payment.transactedFor?.visualId || 'N/A'
    }));

    exportToCSV(
      data,
      [
        { header: 'Customer', key: 'customer' },
        { header: 'Payment Date', key: 'paymentDate', formatter: (val) => val ? format(new Date(val), 'MMM d, yyyy') : '' },
        { header: 'Payment Method', key: 'paymentMethod' },
        { header: 'Amount', key: 'amount', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Invoice #', key: 'invoiceNumber' }
      ],
      `payments-report-${format(new Date(), 'yyyy-MM-dd')}`
    );
  };

  const handleExportPDF = () => {
    const data = filteredAndSortedPayments.map(payment => ({
      customer: payment.transactedFor?.contact?.customer?.companyName || payment.transactedFor?.contact?.fullName || 'Unknown',
      paymentDate: payment.transactionDate || payment.timestamps?.createdAt || '',
      paymentMethod: payment.paymentMethod || 'N/A',
      amount: payment.amount || 0,
      invoiceNumber: payment.transactedFor?.visualId || 'N/A'
    }));

    exportToPDF({
      title: 'Payments Report',
      subtitle: `${format(dateRange.startDate, 'MMM d, yyyy')} - ${format(dateRange.endDate, 'MMM d, yyyy')}`,
      filename: `payments-report-${format(new Date(), 'yyyy-MM-dd')}`,
      columns: [
        { header: 'Customer', dataKey: 'customer' },
        { header: 'Payment Date', dataKey: 'paymentDate', formatter: (val) => val ? format(new Date(val), 'MMM d, yyyy') : 'N/A' },
        { header: 'Method', dataKey: 'paymentMethod' },
        { header: 'Amount', dataKey: 'amount', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Invoice #', dataKey: 'invoiceNumber' }
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
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filter & Export</h3>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <FileDown className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              <FileDown className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
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
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
              </select>
              <button
                onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-gray-600" />
              <h4 className="text-sm font-semibold text-gray-700">Date Range</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {(Object.keys(dateRangePresetLabels).filter(key => key !== 'custom') as DateRangePreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDateRangePreset(preset)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    dateRangePreset === preset
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {dateRangePresetLabels[preset]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={dateRangePreset === 'custom'}
                  onChange={() => setDateRangePreset('custom')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">Custom:</span>
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setDateRangePreset('custom');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setDateRangePreset('custom');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="mt-3 text-sm text-gray-600">
              Showing: {format(dateRange.startDate, 'MMM d, yyyy')} - {format(dateRange.endDate, 'MMM d, yyyy')}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            Payments ({filteredAndSortedPayments.length})
          </h3>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Amount</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(totalAmount)}</div>
          </div>
        </div>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No payments found matching your criteria
                  </td>
                </tr>
              ) : (
                filteredAndSortedPayments.map(payment => (
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
                        {payment.transactedFor?.contact?.customer?.companyName || payment.transactedFor?.contact?.fullName || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-green-600">
                        {formatCurrency(payment.amount)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
