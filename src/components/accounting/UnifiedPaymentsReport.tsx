import { useState, useEffect } from 'react';
import { CreditCard, Download, Filter, Calendar, DollarSign, Loader2, TrendingUp, RotateCcw, Eye, Undo2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { InvoiceDetail } from '../billing/InvoiceDetail';
import { useNotification } from '../../contexts/NotificationContext';

interface Payment {
  id: string;
  company_id: string;
  payment_date: string;
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  refund_amount: number;
  payment_method: string;
  source: string;
  stripe_transaction_id: string | null;
  check_number: string | null;
  status: string;
  notes: string | null;
  metadata: any;
  has_been_reversed?: boolean;
}

interface UnifiedPaymentsReportProps {
  onNavigateToCustomer?: (customerEmail: string, customerName: string) => void;
}

export default function UnifiedPaymentsReport({ onNavigateToCustomer }: UnifiedPaymentsReportProps = {}) {
  const { showNotification, confirm } = useNotification();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedMethod, setSelectedMethod] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [customers, setCustomers] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);

  const getOriginalPaymentId = (payment: Payment): string | null => {
    if (payment.status !== 'reversed') return null;
    if (payment.metadata?.original_payment_id) return payment.metadata.original_payment_id;
    return null;
  };

  useEffect(() => {
    loadPayments();
  }, [startDate, endDate, selectedCustomer, selectedMethod, selectedStatus]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          printavo_invoices!invoice_id (
            invoice_number,
            customer_name
          )
        `)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const processedPayments: Payment[] = (data || []).map((payment: any) => {
        const hasBeenReversed = (data || []).some((p: any) =>
          p.status === 'reversed' &&
          p.metadata?.original_payment_id === payment.id
        );

        return {
          id: payment.id,
          company_id: payment.company_id,
          payment_date: payment.payment_date,
          invoice_id: payment.invoice_id,
          invoice_number: payment.printavo_invoices?.invoice_number || 'N/A',
          customer_name: payment.printavo_invoices?.customer_name || 'Unknown',
          amount: parseFloat(payment.amount || 0),
          refund_amount: parseFloat(payment.refund_amount || 0),
          payment_method: payment.payment_method || payment.source || 'Unknown',
          source: payment.source || 'manual',
          stripe_transaction_id: payment.stripe_transaction_id || payment.stripe_charge_id || null,
          check_number: payment.check_number || null,
          status: payment.status || 'successful',
          notes: payment.notes || null,
          metadata: payment.metadata || null,
          has_been_reversed: hasBeenReversed,
        };
      });

      let filtered = processedPayments;

      if (selectedCustomer !== 'all') {
        filtered = filtered.filter(p => p.customer_name === selectedCustomer);
      }

      if (selectedMethod !== 'all') {
        filtered = filtered.filter(p => p.source === selectedMethod);
      }

      if (selectedStatus !== 'all') {
        filtered = filtered.filter(p => p.status === selectedStatus);
      }

      setPayments(filtered);

      const uniqueCustomers = Array.from(new Set(processedPayments.map(p => p.customer_name))).sort();
      setCustomers(uniqueCustomers);

      const uniqueMethods = Array.from(new Set(processedPayments.map(p => p.source))).sort();
      setPaymentMethods(uniqueMethods);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    const confirmRefund = await confirm({
      title: 'Refund Payment',
      message: `Are you sure you want to refund $${payment.amount.toFixed(2)} to ${payment.customer_name}? This action cannot be undone.`,
      confirmText: 'Refund',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmRefund) return;

    const refundReason = 'requested_by_customer';

    setRefunding(paymentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No session found');
        throw new Error('Not authenticated');
      }

      console.log('Calling stripe-refund function for payment:', paymentId);

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-refund`;
      console.log('Function URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId,
          reason: refundReason,
        }),
      });

      console.log('Response status:', response.status);

      let result;
      try {
        result = await response.json();
        console.log('Response data:', result);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        const errorMessage = result.error || result.details || 'Failed to process refund';
        console.error('Refund failed:', errorMessage, result);
        throw new Error(errorMessage);
      }

      console.log('Refund successful:', result);
      await loadPayments();
      showNotification('success', 'Refund Processed', result.message || 'Refund processed successfully!');
    } catch (err) {
      console.error('Error processing refund:', err);
      showNotification('error', 'Refund Failed', err instanceof Error ? err.message : 'Failed to process refund');
    } finally {
      setRefunding(null);
    }
  };

  const handleReversePayment = async (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    if (payment.has_been_reversed) {
      showNotification('error', 'Already Reversed', 'This payment has already been reversed.');
      return;
    }

    const confirmed = await confirm({
      title: 'Reverse Manual Payment',
      message: 'Are you sure you want to reverse this manual payment? This will restore the invoice balance and move it back to Accounts Receivable.',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      type: 'warning'
    });

    if (!confirmed) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          company_id: payment.company_id,
          invoice_id: payment.invoice_id,
          amount: -Math.abs(payment.amount),
          payment_method: 'manual',
          source: 'manual',
          status: 'reversed',
          payment_date: new Date().toISOString(),
          created_by: user.id,
          notes: 'Manual payment reversal',
          metadata: { original_payment_id: paymentId }
        });

      if (paymentError) throw paymentError;

      // Recalculate invoice balances and status_stage to reflect the reversed payment
      const { error: recalcError } = await supabase.rpc('recalculate_invoice_balances');
      if (recalcError) throw recalcError;

      // Unlock the invoice (status_stage is handled by recalculation function)
      const { error: invoiceError } = await supabase
        .from('printavo_invoices')
        .update({
          is_financially_locked: false,
          locked_at: null,
          locked_by: null
        })
        .eq('id', payment.invoice_id);

      if (invoiceError) throw invoiceError;

      showNotification('success', 'Payment Reversed', 'Manual payment has been reversed and invoice balance updated.');
      await loadPayments();
    } catch (err) {
      console.error('Error reversing payment:', err);
      showNotification('error', 'Reversal Failed', err instanceof Error ? err.message : 'Failed to reverse payment');
    }
  };

  const handleViewInvoice = (invoiceId: string) => {
    setViewingInvoiceId(invoiceId);
  };

  const handleBackToPayments = () => {
    setViewingInvoiceId(null);
  };

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const successfulPayments = payments.filter(p => p.status === 'successful');
  const refundedPayments = payments.filter(p => p.status === 'refunded' || p.status === 'partial_refund');

  const setQuickDateRange = (months: number) => {
    const end = new Date();
    const start = subMonths(end, months);
    setStartDate(format(startOfMonth(start), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(end), 'yyyy-MM-dd'));
  };

  const exportToCSV = () => {
    const headers = ['Payment Date', 'Invoice #', 'Customer', 'Amount', 'Method', 'Transaction ID', 'Status', 'Notes'];
    const rows = payments.map(p => {
      const originalPaymentId = getOriginalPaymentId(p);
      return [
        format(new Date(p.payment_date), 'yyyy-MM-dd'),
        p.invoice_number,
        p.customer_name,
        p.amount.toFixed(2),
        p.source,
        p.status === 'reversed' && originalPaymentId
          ? `Reversal of ${originalPaymentId}`
          : p.stripe_transaction_id || p.check_number || 'N/A',
        p.status,
        p.notes || '',
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unified-payments-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      successful: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
      refunded: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400',
      partial_refund: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
      pending: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
      reversed: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400',
    };

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-500 animate-spin" />
      </div>
    );
  }

  if (viewingInvoiceId) {
    return (
      <InvoiceDetail
        invoiceId={viewingInvoiceId}
        onBack={handleBackToPayments}
        onNavigateToCustomer={onNavigateToCustomer}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Payments</span>
            <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{payments.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {format(new Date(startDate), 'MMM dd')} - {format(new Date(endDate), 'MMM dd, yyyy')}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Amount</span>
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Avg: ${payments.length > 0 ? (totalAmount / payments.length).toFixed(2) : '0.00'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Successful</span>
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{successfulPayments.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ${successfulPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Refunded</span>
            <RotateCcw className="w-5 h-5 text-red-600 dark:text-red-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{refundedPayments.length}</div>
          <div className="text-xs text-red-600 dark:text-red-500 font-semibold mt-1">
            ${refundedPayments.reduce((sum, p) => sum + p.refund_amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              >
                <option value="all">All Customers</option>
                {customers.map(customer => (
                  <option key={customer} value={customer}>{customer}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Method</label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              >
                <option value="all">All Methods</option>
                {paymentMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
              >
                <option value="all">All Statuses</option>
                <option value="successful">Successful</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
                <option value="reversed">Reversed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Quick ranges:</span>
            <button
              onClick={() => setQuickDateRange(1)}
              className="px-3 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white transition-colors"
            >
              Last Month
            </button>
            <button
              onClick={() => setQuickDateRange(3)}
              className="px-3 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white transition-colors"
            >
              Last 3 Months
            </button>
            <button
              onClick={() => setQuickDateRange(6)}
              className="px-3 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white transition-colors"
            >
              Last 6 Months
            </button>
            <button
              onClick={() => setQuickDateRange(12)}
              className="px-3 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white transition-colors"
            >
              Last Year
            </button>

            <button
              onClick={exportToCSV}
              className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-blue-600 dark:bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice Number</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Transaction ID</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {payment.invoice_id ? (
                      <button
                        onClick={() => handleViewInvoice(payment.invoice_id)}
                        className="font-medium text-blue-600 dark:text-blue-500 hover:text-blue-800 dark:hover:text-blue-400 flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        {payment.invoice_number}
                      </button>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">{payment.invoice_number}</span>
                    )}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                    payment.amount < 0 ? 'text-red-600 dark:text-red-500' : 'text-gray-900 dark:text-white'
                  }`}>
                    {payment.amount < 0 ? '-' : ''}${Math.abs(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      payment.source === 'stripe' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                    }`}>
                      {payment.source === 'stripe' ? 'Stripe' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono max-w-xs truncate">
                    {payment.status === 'reversed' && getOriginalPaymentId(payment)
                      ? `Reversal of ${getOriginalPaymentId(payment)}`
                      : payment.stripe_transaction_id || payment.check_number || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {payment.source === 'stripe' && payment.status === 'successful' ? (
                      <button
                        onClick={() => handleRefund(payment.id)}
                        disabled={refunding === payment.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 dark:bg-red-700 text-white text-xs font-medium rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {refunding === payment.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            Refund
                          </>
                        )}
                      </button>
                    ) : payment.source === 'manual' && payment.status === 'successful' ? (
                      payment.has_been_reversed ? (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">Already Reversed</span>
                      ) : (
                        <button
                          onClick={() => handleReversePayment(payment.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 dark:bg-orange-700 text-white text-xs font-medium rounded-lg hover:bg-orange-700 dark:hover:bg-orange-600 transition-colors"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Reverse
                        </button>
                      )
                    ) : payment.status === 'reversed' ? (
                      <span className="text-xs text-gray-400 dark:text-gray-500"></span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {payment.status === 'refunded' ? 'Refunded' : 'N/A'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {payments.length === 0 && (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Payments Found</h3>
              <p className="text-gray-600 dark:text-gray-400">No payments recorded in the selected date range.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
