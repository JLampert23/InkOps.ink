import { useMemo, useState } from 'react';
import { FileDown, Users, DollarSign, TrendingUp, Calendar, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Invoice } from '../types/printavo';
import { format } from 'date-fns';
import { exportToCSV } from '../utils/csv-export';
import { exportToPDF } from '../utils/pdf-export';
import { DateRangePreset, getDateRangeForPreset, dateRangePresetLabels } from '../utils/date-ranges';

interface CustomerSummaryReportProps {
  invoices: Invoice[];
}

interface CustomerMetrics {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
  lastInvoiceDate: Date | null;
}

type SortField = 'customerName' | 'totalRevenue' | 'totalOutstanding' | 'lastInvoiceDate' | 'invoiceCount';
type SortDirection = 'asc' | 'desc';

export function CustomerSummaryReport({ invoices }: CustomerSummaryReportProps) {
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-year');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalRevenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const dateRange = useMemo(() => {
    if (dateRangePreset === 'custom' && customStartDate && customEndDate) {
      return {
        startDate: new Date(customStartDate),
        endDate: new Date(customEndDate)
      };
    }
    return getDateRangeForPreset(dateRangePreset);
  }, [dateRangePreset, customStartDate, customEndDate]);

  const customerMetrics = useMemo(() => {
    const filteredInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.createdAt);
      return invoiceDate >= dateRange.startDate && invoiceDate <= dateRange.endDate;
    });

    const customerMap = new Map<string, CustomerMetrics>();

    filteredInvoices.forEach(invoice => {
      const customerId = invoice.contact?.customer?.id || invoice.contact?.id || 'unknown';
      const customerName = invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown';

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customerName,
          totalRevenue: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          invoiceCount: 0,
          lastInvoiceDate: null,
        });
      }

      const metrics = customerMap.get(customerId)!;
      metrics.totalRevenue += invoice.total || 0;
      metrics.totalPaid += invoice.amountPaid || 0;
      metrics.totalOutstanding += invoice.amountOutstanding || 0;
      metrics.invoiceCount += 1;

      const invoiceDate = new Date(invoice.createdAt);
      if (!metrics.lastInvoiceDate || invoiceDate > metrics.lastInvoiceDate) {
        metrics.lastInvoiceDate = invoiceDate;
      }
    });

    return Array.from(customerMap.values());
  }, [invoices, dateRange]);

  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = customerMetrics;

    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'customerName':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
        case 'totalRevenue':
          comparison = a.totalRevenue - b.totalRevenue;
          break;
        case 'totalOutstanding':
          comparison = a.totalOutstanding - b.totalOutstanding;
          break;
        case 'invoiceCount':
          comparison = a.invoiceCount - b.invoiceCount;
          break;
        case 'lastInvoiceDate':
          const aDate = a.lastInvoiceDate?.getTime() || 0;
          const bDate = b.lastInvoiceDate?.getTime() || 0;
          comparison = aDate - bDate;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [customerMetrics, searchTerm, sortField, sortDirection]);

  const summaryMetrics = useMemo(() => {
    const totalRevenue = customerMetrics.reduce((sum, c) => sum + c.totalRevenue, 0);
    const totalPaid = customerMetrics.reduce((sum, c) => sum + c.totalPaid, 0);
    const totalOutstanding = customerMetrics.reduce((sum, c) => sum + c.totalOutstanding, 0);
    const totalCustomers = customerMetrics.length;

    return { totalRevenue, totalPaid, totalOutstanding, totalCustomers };
  }, [customerMetrics]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const handleExportCSV = () => {
    exportToCSV(
      filteredAndSortedCustomers.map(customer => ({
        customerName: customer.customerName,
        invoiceCount: customer.invoiceCount,
        totalRevenue: `$${customer.totalRevenue.toFixed(2)}`,
        totalPaid: `$${customer.totalPaid.toFixed(2)}`,
        totalOutstanding: `$${customer.totalOutstanding.toFixed(2)}`,
        lastInvoiceDate: customer.lastInvoiceDate ? format(customer.lastInvoiceDate, 'MMM d, yyyy') : 'N/A',
      })),
      [
        { header: 'Customer', key: 'customerName' },
        { header: 'Invoice Count', key: 'invoiceCount' },
        { header: 'Total Revenue', key: 'totalRevenue' },
        { header: 'Total Paid', key: 'totalPaid' },
        { header: 'Total Outstanding', key: 'totalOutstanding' },
        { header: 'Last Invoice Date', key: 'lastInvoiceDate' },
      ],
      `customer-summary-${format(new Date(), 'yyyy-MM-dd')}`
    );
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Customer Summary Report',
      subtitle: `${format(dateRange.startDate, 'MMM d, yyyy')} - ${format(dateRange.endDate, 'MMM d, yyyy')} • ${filteredAndSortedCustomers.length} customers`,
      filename: `customer-summary-${format(new Date(), 'yyyy-MM-dd')}`,
      columns: [
        { header: 'Customer', dataKey: 'customerName' },
        { header: 'Invoices', dataKey: 'invoiceCount' },
        { header: 'Total Revenue', dataKey: 'totalRevenue', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Total Paid', dataKey: 'totalPaid', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Outstanding', dataKey: 'totalOutstanding', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Last Invoice', dataKey: 'lastInvoiceDate', formatter: (val) => val ? format(val, 'MMM d, yyyy') : 'N/A' },
      ],
      data: filteredAndSortedCustomers,
      orientation: 'landscape',
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Customer Summary Report</h2>
            <p className="text-gray-600 mt-1">
              {filteredAndSortedCustomers.length} customers · {format(dateRange.startDate, 'MMM d, yyyy')} - {format(dateRange.endDate, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={filteredAndSortedCustomers.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              <span className="font-medium">Export CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={filteredAndSortedCustomers.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              <span className="font-medium">Export PDF</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Users className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summaryMetrics.totalCustomers}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-blue-900">
                  ${summaryMetrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-600 font-medium">Total Paid</p>
                <p className="text-2xl font-bold text-green-900">
                  ${summaryMetrics.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-red-600 font-medium">Outstanding</p>
                <p className="text-2xl font-bold text-red-900">
                  ${summaryMetrics.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-gray-700" />
              <h3 className="text-base font-semibold text-gray-900">Filters</h3>
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
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('customerName')}
                    >
                      <div className="flex items-center gap-1">
                        Customer
                        <SortIcon field="customerName" />
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('invoiceCount')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Invoices
                        <SortIcon field="invoiceCount" />
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('totalRevenue')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Total Revenue
                        <SortIcon field="totalRevenue" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Paid
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('totalOutstanding')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Outstanding
                        <SortIcon field="totalOutstanding" />
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('lastInvoiceDate')}
                    >
                      <div className="flex items-center gap-1">
                        Last Invoice
                        <SortIcon field="lastInvoiceDate" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No customers found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedCustomers.map((customer) => (
                      <tr key={customer.customerId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {customer.customerName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-center">
                          {customer.invoiceCount}
                        </td>
                        <td className="px-6 py-4 text-sm text-blue-600 font-semibold text-right">
                          ${customer.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-sm text-green-600 font-semibold text-right">
                          ${customer.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-sm text-red-600 font-semibold text-right">
                          ${customer.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {customer.lastInvoiceDate ? format(customer.lastInvoiceDate, 'MMM d, yyyy') : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
