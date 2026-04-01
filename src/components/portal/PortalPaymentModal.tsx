import { useState, useEffect } from 'react';
import { supabaseAnon } from '../../lib/supabase-anon-client';
import { X, CreditCard, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  visual_id: string;
  total: number;
  balance_remaining: number;
}

interface PaymentOptions {
  stripe: boolean;
  square: boolean;
}

interface PortalPaymentModalProps {
  invoice: Invoice;
  companyId: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

export function PortalPaymentModal({
  invoice,
  companyId,
  customerId,
  customerEmail,
  customerName,
  onClose,
  onPaymentSuccess,
}: PortalPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions | null>(null);
  const [checkingOptions, setCheckingOptions] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<'stripe' | 'square' | null>(null);

  useEffect(() => {
    checkPaymentOptions();
  }, [companyId]);

  const checkPaymentOptions = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'getPaymentOptions',
            companyId,
            invoiceId: invoice.id,
            customerId,
          }),
        }
      );

      if (response.ok) {
        const options = await response.json();
        setPaymentOptions(options);
        if (options.stripe && !options.square) {
          setSelectedProvider('stripe');
        } else if (options.square && !options.stripe) {
          setSelectedProvider('square');
        }
      } else {
        setPaymentOptions({ stripe: false, square: false });
      }
    } catch (err) {
      console.error('Error checking payment options:', err);
      setPaymentOptions({ stripe: false, square: false });
    } finally {
      setCheckingOptions(false);
    }
  };

  const handleCreatePaymentLink = async (provider: 'stripe' | 'square') => {
    setLoading(true);
    setError(null);

    try {
      const balance = parseFloat(invoice.balance_remaining?.toString() || '0');
      const amountInCents = Math.round(balance * 100);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: 'createPaymentLink',
            provider,
            companyId,
            invoiceId: invoice.id,
            customerId,
            amount: amountInCents,
            customerEmail,
            customerName,
            description: `Payment for Invoice ${invoice.visual_id || invoice.invoice_number}`,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment link');
      }

      const data = await response.json();

      if (data.url) {
        setPaymentUrl(data.url);
        window.open(data.url, '_blank');
      } else {
        throw new Error('No payment URL returned');
      }
    } catch (err) {
      console.error('Error creating payment link:', err);
      setError(err instanceof Error ? err.message : 'Failed to create payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const balance = parseFloat(invoice.balance_remaining?.toString() || '0');

  if (checkingOptions) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  const hasPaymentOptions = paymentOptions?.stripe || paymentOptions?.square;

  if (!hasPaymentOptions) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Online Payment</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Online Payments Not Available
            </h3>
            <p className="text-gray-600">
              Online payment processing is not currently configured.
              Please contact us directly to make a payment.
            </p>
          </div>

          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bothEnabled = paymentOptions?.stripe && paymentOptions?.square;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Pay Invoice</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {paymentUrl ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Payment Link Created
              </h3>
              <p className="text-gray-600 mb-4">
                A new window has been opened for you to complete your payment.
                If it didn't open, click the button below.
              </p>
              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <ExternalLink className="w-4 h-4" />
                Open Payment Page
              </a>
              <p className="text-sm text-gray-500 mt-4">
                After completing payment, this page will update automatically.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Invoice</span>
                  <span className="font-medium text-gray-900">
                    {invoice.visual_id || invoice.invoice_number}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Amount Due</span>
                  <span className="text-xl font-bold text-gray-900">
                    ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {bothEnabled && !selectedProvider && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Choose payment method:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedProvider('stripe')}
                      className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">Stripe</span>
                    </button>
                    <button
                      onClick={() => setSelectedProvider('square')}
                      className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">Square</span>
                    </button>
                  </div>
                </div>
              )}

              {(selectedProvider || !bothEnabled) && (
                <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 ${
                  (selectedProvider === 'square' || (!bothEnabled && paymentOptions?.square))
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  <CreditCard className={`w-5 h-5 ${
                    (selectedProvider === 'square' || (!bothEnabled && paymentOptions?.square))
                      ? 'text-green-600'
                      : 'text-blue-600'
                  }`} />
                  <p className={`text-sm ${
                    (selectedProvider === 'square' || (!bothEnabled && paymentOptions?.square))
                      ? 'text-green-800'
                      : 'text-blue-800'
                  }`}>
                    Secure payment powered by {
                      (selectedProvider === 'square' || (!bothEnabled && paymentOptions?.square))
                        ? 'Square'
                        : 'Stripe'
                    }
                  </p>
                  {bothEnabled && selectedProvider && (
                    <button
                      onClick={() => setSelectedProvider(null)}
                      className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Change
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {paymentUrl ? 'Close' : 'Cancel'}
          </button>
          {!paymentUrl && (selectedProvider || !bothEnabled) && (
            <button
              onClick={() => handleCreatePaymentLink(
                selectedProvider || (paymentOptions?.stripe ? 'stripe' : 'square')
              )}
              disabled={loading || balance <= 0}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                (selectedProvider === 'square' || (!bothEnabled && paymentOptions?.square))
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Pay ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
