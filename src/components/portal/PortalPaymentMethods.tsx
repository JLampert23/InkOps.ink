import { useState, useEffect } from 'react';
import { CreditCard, Trash2, Plus, Star, Loader2, AlertTriangle } from 'lucide-react';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { customerPaymentMethodsService, SavedPaymentMethod } from '../../services/customer-payment-methods-service';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';

export function PortalPaymentMethods() {
  const { user } = useCustomerPortal();
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [addingMethod, setAddingMethod] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.customer_id) {
      loadPaymentMethods();
    }
  }, [user]);

  const loadPaymentMethods = async () => {
    if (!user?.customer_id) return;

    try {
      setLoading(true);
      const methods = await customerPaymentMethodsService.getPaymentMethods(user.customer_id);
      setPaymentMethods(methods);
    } catch (err) {
      console.error('Error loading payment methods:', err);
      setError('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    if (!user?.customer_id) return;
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    try {
      await customerPaymentMethodsService.deletePaymentMethod(methodId, user.customer_id);
      setMessage('Payment method deleted successfully');
      await loadPaymentMethods();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error deleting payment method:', err);
      setError('Failed to delete payment method');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    if (!user?.customer_id) return;

    try {
      await customerPaymentMethodsService.setDefaultPaymentMethod(methodId, user.customer_id);
      setMessage('Default payment method updated');
      await loadPaymentMethods();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error setting default payment method:', err);
      setError('Failed to set default payment method');
      setTimeout(() => setError(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Payment Methods</h2>
          <button
            onClick={() => setShowAddMethod(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Payment Method
          </button>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {paymentMethods.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No saved payment methods</p>
            <p className="text-sm text-gray-500">
              Add a payment method to make checkout faster and easier
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {customerPaymentMethodsService.formatPaymentMethodDisplay(method)}
                        </p>
                        {method.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                            <Star className="w-3 h-3 fill-current" />
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 capitalize">
                        {method.payment_method_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.is_default && (
                      <button
                        onClick={() => handleSetDefault(method.id)}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMethod(method.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 mb-1">Secure Payment Processing</p>
              <p>
                Your payment information is securely stored by Stripe. We never see or store your
                full card details. All transactions are encrypted and PCI compliant.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showAddMethod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Payment Method</h3>
            <p className="text-sm text-gray-600 mb-4">
              This feature requires Stripe integration. Payment methods can be added during checkout.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddMethod(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
