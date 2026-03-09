import { useState, useEffect } from 'react';
import { supabaseAnon } from '../../lib/supabase-anon-client';
import { CreditCard, Loader2, CheckCircle, XCircle, Clock, DollarSign, Receipt, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  payment_type: string | null;
  status: string | null;
  invoice_id: string | null;
  notes: string | null;
  receipt_url: string | null;
  invoice?: {
    visual_id: string;
    invoice_number: string;
  } | null;
}

interface PortalPaymentsTabProps {
  customerId: string;
  companyId: string;
}

export function PortalPaymentsTab({ customerId, companyId }: PortalPaymentsTabProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPayments();
  }, [customerId, companyId]);

  const loadPayments = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabaseAnon
        .from('payments')
        .select(`
          id,
          amount,
          payment_date,
          payment_method,
          payment_type,
          status,
          invoice_id,
          notes,
          receipt_url
        `)
        .eq('customer_id', customerId)
        .eq('company_id', companyId)
        .order('payment_date', { ascending: false });

      if (fetchError) throw fetchError;

      const paymentsWithInvoices = await Promise.all(
        (data || []).map(async (payment) => {
          if (payment.invoice_id) {
            const { data: invoiceData } = await supabaseAnon
              .from('printavo_invoices')
              .select('visual_id, invoice_number')
              .eq('id', payment.invoice_id)
              .maybeSingle();

            return { ...payment, invoice: invoiceData };
          }
          return { ...payment, invoice: null };
        })
      );

      setPayments(paymentsWithInvoices);
    } catch (err) {
      console.error('Error loading payments:', err);
      setError('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'succeeded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'reversed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
            Reversed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
    }
  };

  const formatPaymentMethod = (method: string | null, type: string | null) => {
    if (type) {
      switch (type.toLowerCase()) {
        case 'card':
        case 'credit_card':
          return 'Credit Card';
        case 'ach':
        case 'bank_transfer':
          return 'Bank Transfer';
        case 'check':
          return 'Check';
        case 'cash':
          return 'Cash';
        case 'stripe':
          return 'Stripe';
        default:
          return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
      }
    }
    if (method) {
      return method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' ');
    }
    return 'Payment';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
        <p className="text-sm text-gray-600 mt-1">View all payments made on your account</p>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No payments yet</h3>
          <p className="text-gray-600">Payment history will appear here once payments are made.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.invoice ? (
                      <span className="inline-flex items-center gap-1 text-sm text-gray-900">
                        <Receipt className="w-4 h-4 text-gray-400" />
                        {payment.invoice.visual_id || payment.invoice.invoice_number}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatPaymentMethod(payment.payment_method, payment.payment_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                    ${parseFloat(payment.amount?.toString() || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {payment.receipt_url && (
                      <a
                        href={payment.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        Receipt
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {payments.length} payment{payments.length !== 1 ? 's' : ''} total
          </span>
          <span className="text-sm font-medium text-gray-900">
            Total Paid: ${payments
              .filter(p => p.status?.toLowerCase() !== 'failed' && p.status?.toLowerCase() !== 'reversed')
              .reduce((sum, p) => sum + parseFloat(p.amount?.toString() || '0'), 0)
              .toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
