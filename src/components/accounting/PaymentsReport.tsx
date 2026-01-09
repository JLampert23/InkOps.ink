import { useState, useEffect } from 'react';
import { CreditCard, Download, Filter, Calendar, DollarSign, Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

interface Payment {
  id: string;
  payment_date: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  payment_method: string;
  stripe_transaction_id: string;
  status: string;
}

export default function PaymentsReport() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [customers, setCustomers] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);

  useEffect(() => {
    loadPayments();
  }, [startDate, endDate, selectedCustomer, selectedMethod]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          printavo_invoices:invoice_id (
            invoice_number,
            customer_name
          ),
          customers:customer_id (
            company_name
          )
        `)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const processedPayments: Payment[] = (data || []).map((payment: any) => ({
        id: payment.id,
        payment_date: payment.payment_date,
        invoice_number: payment.printavo_invoices?.invoice_number || 'N/A',
        customer_name: payment.printavo_invoices?.customer_name || payment.customers?.company_name || 'Unknown',
        amount: parseFloat(payment.amount || 0),
        payment_method: payment.payment_method || 'Card',
        stripe_transaction_id: payment.stripe_transaction_id || payment.stripe_payment_intent_id || 'N/A',
        status: 'succeeded',
      }));

      let filtered = processedPayments;

      if (selectedCustomer !== 'all') {
        filtered = filtered.filter(p => p.customer_name === selectedCustomer);
      }

      if (selectedMethod !== 'all') {
        filtered = filtered.filter(p => p.payment_method === selectedMethod);
      }

      setPayments(filtered);

      const uniqueCustomers = Array.from(new Set(processedPayments.map(p => p.customer_name))).sort();
      setCustomers(uniqueCustomers);

      const uniqueMethods = Array.from(new Set(processedPayments.map(p => p.payment_method))).sort();
      setPaymentMethods(uniqueMethods);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const setQuickDateRange = (months: number) => {
    const end = new Date();
    const start = subMonths(end, months);
    setStartDate(format(startOfMonth(start), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(end), 'yyyy-MM-dd'));
  };

  const exportToCSV = () => {
    const headers = ['Payment Date', 'Invoice #', 'Customer', 'Amount', 'Payment Method', 'Stripe Transaction ID', 'Status'];
    const rows = payments.map(p => [
      p.payment_date,
      p.invoice_number,
      p.customer_name,
      p.amount.toFixed(2),
      p.payment_method,
      p.stripe_transaction_id,
      p.status,
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Payments</span>
            <CreditCard className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{payments.length}</div>
          <div className="text-xs text-gray-500 mt-1">
            {format(new Date(startDate), 'MMM dd')} - {format(new Date(endDate), 'MMM dd, yyyy')}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Amount</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Avg: ${payments.length > 0 ? (totalAmount / payments.length).toFixed(2) : '0.00'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Unique Customers</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {new Set(payments.map(p => p.customer_name)).size}
          </div>
          <div className="text-xs text-gray-500 mt-1">Paid in this period</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Customers</option>
                {customers.map(customer => (
                  <option key={customer} value={customer}>{customer}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Methods</option>
                {paymentMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm text-gray-600">Quick ranges:</span>
            <button
              onClick={() => setQuickDateRange(1)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Last Month
            </button>
            <button
              onClick={() => setQuickDateRange(3)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Last 3 Months
            </button>
            <button
              onClick={() => setQuickDateRange(6)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Last 6 Months
            </button>
            <button
              onClick={() => setQuickDateRange(12)}
              className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Last Year
            </button>

            <button
              onClick={exportToCSV}
              className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {payment.invoice_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                    ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {payment.payment_method}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                    {payment.stripe_transaction_id.substring(0, 20)}
                    {payment.stripe_transaction_id.length > 20 ? '...' : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      payment.status === 'succeeded' ? 'bg-green-100 text-green-800' :
                      payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {payments.length === 0 && (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payments Found</h3>
              <p className="text-gray-600">No payments recorded in the selected date range.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
