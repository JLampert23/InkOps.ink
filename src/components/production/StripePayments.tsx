import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Payment } from '../../types/production';
import { stripeService } from '../../services/stripe-service';
import { useConfirmation } from '../../contexts/ConfirmationContext';

export function StripePayments() {
  const { confirm } = useConfirmation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balance, setBalance] = useState<{ available: number; pending: number }>({ available: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [invoiceId, setInvoiceId] = useState('');

  useEffect(() => {
    checkStripeConfig();
    loadData();
  }, []);

  const checkStripeConfig = () => {
    const configured = stripeService.validateStripeConfig();
    setIsConfigured(configured);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentsData, balanceData] = await Promise.all([
        stripeService.fetchPaymentHistory(),
        stripeService.fetchStripeBalance(),
      ]);
      setPayments(paymentsData);
      setBalance(balanceData);
    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const amount = Math.round(parseFloat(paymentAmount) * 100);
      await stripeService.createPaymentIntent(amount, 'usd', { invoiceId });
      await loadData();
      setShowPaymentModal(false);
      setPaymentAmount('');
      setInvoiceId('');
      alert('Payment link created successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to create payment');
    }
  };

  const handleRefund = async (paymentId: string) => {
    const confirmed = await confirm({
      title: 'Refund Payment?',
      message: 'This will process a refund for this payment through Stripe. This action cannot be undone.',
      confirmLabel: 'Refund',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await stripeService.initiateRefund({ paymentId });
      await loadData();
      alert('Refund initiated successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to initiate refund');
    }
  };

  const getStatusBadge = (status: Payment['status']) => {
    const statusConfig = {
      pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: RefreshCw },
      completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: XCircle },
      refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-800', icon: RefreshCw },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  if (!isConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stripe Payment Processing</h2>
          <p className="text-sm text-gray-600 mt-1">Accept and manage payments via Stripe</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Stripe Not Configured</h3>
              <p className="text-yellow-800 mb-4">
                To use Stripe payment processing, you need to configure your Stripe API credentials.
              </p>
              <div className="bg-yellow-100 rounded p-4 space-y-2">
                <p className="text-sm font-medium text-yellow-900">Setup Instructions:</p>
                <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside ml-2">
                  <li>Sign up for a Stripe account at stripe.com</li>
                  <li>Get your API keys from the Stripe Dashboard</li>
                  <li>Add Stripe credentials to your application settings</li>
                  <li>Return here to start processing payments</li>
                </ol>
              </div>
              <button className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors">
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stripe Payment Processing</h2>
          <p className="text-sm text-gray-600 mt-1">Accept and manage payments via Stripe</p>
        </div>
        <button
          onClick={() => setShowPaymentModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <CreditCard className="w-4 h-4" />
          Create Payment Link
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${balance.available.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-600">Available Balance</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <RefreshCw className="w-8 h-8 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${balance.pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-600">Pending Balance</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {payments.filter(p => p.status === 'completed').length}
          </p>
          <p className="text-sm text-gray-600">Completed Payments</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-600">Loading payment history...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No payments yet</h3>
          <p className="text-gray-600 mb-4">Start accepting payments to see them here</p>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Create Payment Link
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stripe ID</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(payment.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${payment.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {payment.method}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(payment.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {payment.stripePaymentId?.slice(0, 20)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {payment.status === 'completed' && (
                      <button
                        onClick={() => handleRefund(payment.id)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Create Payment Link</h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice ID (Optional)
                </label>
                <input
                  type="text"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="INV-12345"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                  setInvoiceId('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePayment}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
