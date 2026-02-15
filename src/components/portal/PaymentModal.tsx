import { useState, useEffect } from 'react';
import { X, CreditCard, Plus, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { customerPaymentMethodsService, SavedPaymentMethod } from '../../services/customer-payment-methods-service';

interface PaymentModalProps {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentModal({ invoiceId, invoiceNumber, amount, companyId, onClose, onSuccess }: PaymentModalProps) {
  const { user } = useCustomerPortal();
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [saveCard, setSaveCard] = useState(false);

  useEffect(() => {
    if (user?.customer_id) {
      loadSavedMethods();
    }
  }, [user]);

  const loadSavedMethods = async () => {
    if (!user?.customer_id) return;

    try {
      setLoadingMethods(true);
      const methods = await customerPaymentMethodsService.getPaymentMethods(user.customer_id);
      setSavedMethods(methods);

      const defaultMethod = methods.find(m => m.is_default);
      if (defaultMethod) {
        setSelectedMethodId(defaultMethod.id);
      }
    } catch (err) {
      console.error('Error loading payment methods:', err);
    } finally {
      setLoadingMethods(false);
    }
  };

  const handlePayment = async () => {
    setProcessing(true);
    setError(null);

    try {
      if (!useNewCard && !selectedMethodId) {
        setError('Please select a payment method');
        return;
      }

      const paymentData: any = {
        invoice_id: invoiceId,
        amount: amount,
        company_id: companyId,
      };

      if (useNewCard) {
        setError('Stripe integration required for new card payments. Please add a payment method from your dashboard first.');
        return;
      } else {
        const selectedMethod = savedMethods.find(m => m.id === selectedMethodId);
        if (!selectedMethod) {
          setError('Selected payment method not found');
          return;
        }
        paymentData.payment_method_id = selectedMethod.stripe_payment_method_id;
      }

      console.log('Payment data:', paymentData);
      setError('Payment processing is not yet implemented. This is a demo interface.');

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Pay Invoice</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-blue-900 font-medium">Invoice Number</p>
              <p className="text-sm font-mono text-blue-900">{invoiceNumber}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-900 font-medium">Amount Due</p>
              <p className="text-2xl font-bold text-blue-900">
                ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Select Payment Method</h3>

            {loadingMethods ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {savedMethods.length > 0 && (
                  <div className="space-y-2">
                    {savedMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedMethodId === method.id && !useNewCard
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="payment-method"
                            checked={selectedMethodId === method.id && !useNewCard}
                            onChange={() => {
                              setSelectedMethodId(method.id);
                              setUseNewCard(false);
                            }}
                            className="w-4 h-4 text-blue-600"
                          />
                          <CreditCard className="w-5 h-5 text-gray-400" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {customerPaymentMethodsService.formatPaymentMethodDisplay(method)}
                            </p>
                            {method.is_default && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <label
                  className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    useNewCard
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment-method"
                      checked={useNewCard}
                      onChange={() => {
                        setUseNewCard(true);
                        setSelectedMethodId(null);
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Plus className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Use a new card</p>
                      <p className="text-xs text-gray-500">Add and use a new payment method</p>
                    </div>
                  </div>
                </label>

                {useNewCard && (
                  <div className="ml-7 mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={saveCard}
                        onChange={(e) => setSaveCard(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      Save this card for future payments
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 mb-1">Secure Payment</p>
                <p>
                  Your payment is processed securely through Stripe. Your card information is
                  encrypted and never stored on our servers.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={processing || (!useNewCard && !selectedMethodId)}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Pay ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
