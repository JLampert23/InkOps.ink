import { useState, useEffect } from 'react';
import { CheckCircle, DollarSign, Calendar, CreditCard, Search, Download } from 'lucide-react';
import { billingService, PaidInvoice } from '../../services/billing-service';

export function PaidInvoices() {
  const [paidInvoices, setPaidInvoices] = useState<PaidInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-600">Loading paid invoices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Paid Invoices</h2>
          <p className="text-sm text-gray-600 mt-1">
            Successfully completed payments ({filteredInvoices.length} invoices)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {filteredInvoices.length}
          </p>
          <p className="text-sm text-gray-600">Paid Invoices</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-600">Total Received</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {filteredInvoices.filter(inv => {
              const date = new Date(inv.paymentDate);
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              return date >= weekAgo;
            }).length}
          </p>
          <p className="text-sm text-gray-600">Last 7 Days</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by invoice, customer, or email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No paid invoices found</h3>
          <p className="text-gray-600">
            {searchTerm || dateFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Paid invoices will appear here once payments are received'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {invoice.printavoVisualId}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {invoice.customerName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {invoice.customerEmail}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm font-medium text-green-600">
                      <DollarSign className="w-4 h-4 mr-1" />
                      {invoice.amountPaid.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      {new Date(invoice.paymentDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900 capitalize">
                        {invoice.paymentMethod}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-gray-500 font-mono">
                      {invoice.stripePaymentIntentId.slice(0, 20)}...
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
