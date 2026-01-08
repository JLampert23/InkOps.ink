import { useState } from 'react';
import { X, Send, Copy, Loader2, CheckCircle, Mail } from 'lucide-react';
import { BillingQueueItem, billingService } from '../../services/billing-service';

interface SendInvoiceModalProps {
  item: BillingQueueItem;
  onClose: () => void;
  onSuccess: () => void;
}

export function SendInvoiceModal({ item, onClose, onSuccess }: SendInvoiceModalProps) {
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const link = await billingService.generatePaymentLink(item.id);
      setPaymentLink(link);
    } catch (error: any) {
      alert(error.message || 'Failed to generate payment link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!paymentLink && !item.stripePaymentLinkId) {
      await handleGenerateLink();
      return;
    }

    try {
      const link = paymentLink || await billingService.generatePaymentLink(item.id);
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error: any) {
      alert(error.message || 'Failed to copy link');
    }
  };

  const handleSendEmail = async () => {
    setSending(true);
    try {
      await billingService.sendInvoiceEmail(item.id, customMessage);
      alert('Invoice sent successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-xl font-bold text-gray-900">Send Invoice</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Invoice Number</p>
                <p className="text-sm font-medium text-gray-900">{item.printavoVisualId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Amount</p>
                <p className="text-sm font-medium text-gray-900">
                  ${item.invoiceTotal.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
                <p className="text-sm font-medium text-gray-900">{item.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                <p className="text-sm font-medium text-gray-900">{item.customerEmail}</p>
              </div>
            </div>
          </div>

          {item.stripePaymentLinkId || paymentLink ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Payment Link Ready</p>
                  <p className="text-xs text-green-700 mt-1">
                    A Stripe payment link has been generated for this invoice
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Generate Payment Link</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Create a secure Stripe payment link before sending
                  </p>
                </div>
                <button
                  onClick={handleGenerateLink}
                  disabled={generatingLink}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                >
                  {generatingLink ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Link'
                  )}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Message (Optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Add a personal message to include in the email..."
            />
            <p className="text-xs text-gray-500 mt-1">
              This message will appear in the email along with the payment link
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Email Preview</p>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-2">
              <p><strong>To:</strong> {item.customerEmail}</p>
              <p><strong>Subject:</strong> Invoice {item.printavoVisualId} - Payment Required</p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p>Dear {item.customerName},</p>
                {customMessage && (
                  <p className="mt-2 italic text-gray-700">{customMessage}</p>
                )}
                <p className="mt-2">Your invoice is ready for payment.</p>
                <div className="mt-4 bg-white rounded p-3 border border-gray-200">
                  <p><strong>Invoice Number:</strong> {item.printavoVisualId}</p>
                  <p><strong>Amount Due:</strong> ${item.invoiceTotal.toFixed(2)}</p>
                </div>
                <div className="mt-4">
                  <span className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-center">
                    Pay Invoice Now
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3 bg-gray-50">
          <button
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors"
          >
            {linkCopied ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Link
              </>
            )}
          </button>
          <button
            onClick={handleSendEmail}
            disabled={sending || !item.customerEmail}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
