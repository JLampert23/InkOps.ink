import { useState, useEffect } from 'react';
import { CheckCircle, Download, Filter, Search, Calendar, ChevronDown, ChevronUp, ExternalLink, Loader2, FileText, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ReportBuilderModal } from './ReportBuilderModal';

interface PaidInvoice {
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  invoice_date: string;
  payment_date: string | null;
  total: number;
  amount_paid: number;
  payment_method: string;
  stripe_transaction_id: string;
  notes: string;
  status_stage: string;
  payments: Payment[];
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  stripe_charge_id: string;
  stripe_payment_intent_id: string;
}

export default function PaidInvoices() {
  const [invoices, setInvoices] = useState<PaidInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showReportBuilder, setShowReportBuilder] = useState(false);

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [customers, setCustomers] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);

  useEffect(() => {
    loadPaidInvoices();
  }, [startDate, endDate, selectedCustomer, selectedMethod, minAmount, maxAmount]);

  const loadPaidInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('printavo_invoices')
        .select('*')
        .eq('status_stage', 'paid')
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date', { ascending: false });

      if (selectedCustomer !== 'all') {
        query = query.eq('customer_name', selectedCustomer);
      }

      const { data, error } = await query;

      if (error) throw error;

      const invoiceIds = (data || []).map(inv => inv.id);

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('payment_date', { ascending: true });

      const paymentsByInvoice = new Map<string, Payment[]>();
      (paymentsData || []).forEach((payment: any) => {
        if (!paymentsByInvoice.has(payment.invoice_id)) {
          paymentsByInvoice.set(payment.invoice_id, []);
        }
        paymentsByInvoice.get(payment.invoice_id)!.push({
          id: payment.id,
          payment_date: payment.payment_date,
          amount: parseFloat(payment.amount || 0),
          payment_method: payment.payment_method || 'N/A',
          stripe_charge_id: payment.stripe_charge_id || '',
          stripe_payment_intent_id: payment.stripe_payment_intent_id || '',
        });
      });

      let processedInvoices: PaidInvoice[] = (data || []).map((inv: any) => {
        const payments = paymentsByInvoice.get(inv.id) || [];
        const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;

        return {
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          customer_name: inv.customer_name,
          customer_email: inv.customer_email || '',
          invoice_date: inv.invoice_date,
          payment_date: lastPayment?.payment_date || inv.invoice_date,
          total: parseFloat(inv.total || 0),
          amount_paid: parseFloat(inv.amount_paid || 0),
          payment_method: lastPayment?.payment_method || 'N/A',
          stripe_transaction_id: lastPayment?.stripe_charge_id || lastPayment?.stripe_payment_intent_id || 'N/A',
          notes: '',
          status_stage: inv.status_stage,
          payments: payments,
        };
      });

      if (selectedMethod !== 'all') {
        processedInvoices = processedInvoices.filter(inv => inv.payment_method === selectedMethod);
      }

      if (minAmount) {
        processedInvoices = processedInvoices.filter(inv => inv.total >= parseFloat(minAmount));
      }

      if (maxAmount) {
        processedInvoices = processedInvoices.filter(inv => inv.total <= parseFloat(maxAmount));
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        processedInvoices = processedInvoices.filter(inv =>
          inv.invoice_number.toLowerCase().includes(term) ||
          inv.customer_name.toLowerCase().includes(term)
        );
      }

      setInvoices(processedInvoices);

      const uniqueCustomers = Array.from(new Set(processedInvoices.map(inv => inv.customer_name))).sort();
      setCustomers(uniqueCustomers);

      const uniqueMethods = Array.from(new Set(processedInvoices.map(inv => inv.payment_method))).sort();
      setPaymentMethods(uniqueMethods);
    } catch (error) {
      console.error('Error loading paid invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (invoiceId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId);
    } else {
      newExpanded.add(invoiceId);
    }
    setExpandedRows(newExpanded);
  };

  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Paid Invoices</span>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{invoices.length}</div>
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
            ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Avg: ${invoices.length > 0 ? (totalPaid / invoices.length).toFixed(2) : '0.00'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Unique Customers</span>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {new Set(invoices.map(inv => inv.customer_name)).size}
          </div>
          <div className="text-xs text-gray-500 mt-1">Paid in period</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <button
            onClick={() => setShowReportBuilder(true)}
            className="w-full h-full flex flex-col items-center justify-center gap-2 text-green-600 hover:text-green-700 transition-colors"
          >
            <FileText className="w-8 h-8" />
            <span className="text-sm font-semibold">Create Custom Report</span>
          </button>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount</label>
              <input
                type="number"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="$0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
              <input
                type="number"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="$999,999.99"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by invoice # or customer name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <>
                  <tr key={invoice.invoice_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleRow(invoice.invoice_id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {expandedRows.has(invoice.invoice_id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {invoice.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {format(new Date(invoice.invoice_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {invoice.payment_date ? format(new Date(invoice.payment_date), 'MMM dd, yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      ${invoice.amount_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {invoice.payment_method}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => window.open(`/invoice/${invoice.invoice_id}`, '_blank')}
                        className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 text-sm font-medium"
                      >
                        View
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>

                  {expandedRows.has(invoice.invoice_id) && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-900">Payment History</h4>
                          {invoice.payments.length > 0 ? (
                            <div className="space-y-2">
                              {invoice.payments.map((payment) => (
                                <div key={payment.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                                  <div className="flex items-center gap-4">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">
                                        {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {payment.payment_method} • {payment.stripe_charge_id || payment.stripe_payment_intent_id}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-sm font-semibold text-gray-900">
                                    ${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No payment history available</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {invoices.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Paid Invoices</h3>
              <p className="text-gray-600">No paid invoices found matching your filters.</p>
            </div>
          )}
        </div>
      </div>

      {showReportBuilder && (
        <ReportBuilderModal
          invoices={invoices}
          onClose={() => setShowReportBuilder(false)}
        />
      )}
    </div>
  );
}
