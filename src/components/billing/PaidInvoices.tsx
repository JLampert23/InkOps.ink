import { useState, useEffect } from 'react';
import { CheckCircle, DollarSign, Calendar, CreditCard, Search, Download, AlertCircle, Loader2, Filter, FileText, FileSpreadsheet, TrendingUp, Wallet } from 'lucide-react';
import { billingService, PaidInvoice } from '../../services/billing-service';

interface PaidInvoicesProps {
  onViewInvoice?: (printavoInvoiceId: string) => void;
}

export function PaidInvoices({ onViewInvoice }: PaidInvoicesProps) {
  const [paidInvoices, setPaidInvoices] = useState<PaidInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');

  const formatPaymentMethod = (method: string | null): string => {
    if (!method) return 'N/A';
    const normalized = method.toLowerCase();
    if (normalized === 'manual') return 'Manual';
    if (normalized === 'card') return 'Card';
    if (normalized === 'ach' || normalized === 'check') return 'Check/ACH';
    return method;
  };

  useEffect(() => {
    loadPaidInvoices();
  }, []);

  const loadPaidInvoices = async () => {
    setLoading(true);
    try {
      const invoices = await billingService.getPaidInvoices();
      setPaidInvoices(invoices);
    } catch (error) {
      console.error('Error loading paid invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = paidInvoices.filter(invoice => {
    const matchesSearch =
      invoice.printavoVisualId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerEmail.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (paymentMethodFilter !== 'all') {
      const method = formatPaymentMethod(invoice.paymentMethod).toLowerCase();
      if (paymentMethodFilter === 'card' && method !== 'card') return false;
      if (paymentMethodFilter === 'manual' && method !== 'manual') return false;
      if (paymentMethodFilter === 'check' && method !== 'check/ach') return false;
    }

    if (dateFilter === 'all') return true;

    const paymentDate = new Date(invoice.paymentDate);
    const now = new Date();

    switch (dateFilter) {
      case 'today':
        return paymentDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return paymentDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return paymentDate >= monthAgo;
      default:
        return true;
    }
  });

  const totalPaid = filteredInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
  const last7Days = filteredInvoices.filter(inv => {
    const date = new Date(inv.paymentDate);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo;
  }).length;
  const last30Days = filteredInvoices.filter(inv => {
    const date = new Date(inv.paymentDate);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return date >= monthAgo;
  }).length;

  const averageInvoiceAmount = filteredInvoices.length > 0 ? totalPaid / filteredInvoices.length : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-green-600 dark:text-green-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
        <Wallet className="w-5 h-5 text-green-600 dark:text-green-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-green-900 dark:text-green-200">
            <span className="font-medium">Payment History:</span> View all successfully completed payments and analyze payment trends. Use filters to search by date range, payment method, or customer information for detailed financial reporting.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Collected</span>
            <Wallet className="w-5 h-5 text-green-600 dark:text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{filteredInvoices.length} payments</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Last 7 Days</span>
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {last7Days}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Recent payments</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-teal-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Last 30 Days</span>
            <Calendar className="w-5 h-5 text-teal-600 dark:text-teal-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {last30Days}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">This month</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-lime-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Payment</span>
            <DollarSign className="w-5 h-5 text-lime-600 dark:text-lime-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            ${averageInvoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Per invoice</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 lg:p-6">
        <div className="space-y-4">
          {/* Filter Row */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
              </div>

              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by invoice, customer, or email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-600"
                />
              </div>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-600"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>

              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-600"
              >
                <option value="all">All Methods</option>
                <option value="card">Card</option>
                <option value="manual">Manual</option>
                <option value="check">Check/ACH</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-12 text-center">
          <CheckCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No paid invoices found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || dateFilter !== 'all' || paymentMethodFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Paid invoices will appear here once payments are received'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Invoice Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Payment Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Transaction ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => onViewInvoice?.(invoice.printavoInvoiceId)}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                      >
                        {invoice.printavoVisualId}
                      </button>
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1 mt-1">
                        <CheckCircle className="w-3 h-3" />
                        Paid
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {invoice.customerName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {invoice.customerEmail}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {new Date(invoice.invoiceDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm font-medium text-gray-900 dark:text-white">
                        <DollarSign className="w-4 h-4 mr-1 text-gray-400 dark:text-gray-500" />
                        {invoice.invoiceTotal.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900 dark:text-white">
                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                        {new Date(invoice.paymentDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <CreditCard className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {formatPaymentMethod(invoice.paymentMethod)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {invoice.stripePaymentIntentId ? invoice.stripePaymentIntentId.slice(0, 20) + '...' : 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
