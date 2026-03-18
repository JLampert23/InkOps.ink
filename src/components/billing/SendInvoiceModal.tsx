import { useState, useEffect } from 'react';
import { X, Send, Copy, Loader2, CheckCircle, Mail, MessageSquare } from 'lucide-react';
import { BillingQueueItem, billingService } from '../../services/billing-service';
import { twilioService } from '../../services/twilio-service';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';

interface SendInvoiceModalProps {
  item: BillingQueueItem;
  onClose: () => void;
  onSuccess: () => void;
}

type SendMethod = 'email' | 'sms' | 'both';

export function SendInvoiceModal({ item, onClose, onSuccess }: SendInvoiceModalProps) {
  const { showNotification } = useNotification();
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sendMethod, setSendMethod] = useState<SendMethod>('email');
  const [customerPhone, setCustomerPhone] = useState('');
  const [twilioEnabled, setTwilioEnabled] = useState(false);

  useEffect(() => {
    loadSettings();
    loadCustomerPhone();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('twilio_enabled, default_send_method')
        .maybeSingle();

      if (data) {
        setTwilioEnabled(data.twilio_enabled || false);
        setSendMethod((data.default_send_method as SendMethod) || 'email');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadCustomerPhone = async () => {
    if (!item.customerId) return;

    try {
      const { data } = await supabase
        .from('customers')
        .select('phone')
        .eq('id', item.customerId)
        .maybeSingle();

      if (data?.phone) {
        setCustomerPhone(data.phone);
      }
    } catch (error) {
      console.error('Error loading customer phone:', error);
    }
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const link = await billingService.generatePaymentLink(item.id);
      setPaymentLink(link);
    } catch (error: any) {
      showNotification('error', 'Failed to generate payment link', error.message);
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
      showNotification('error', 'Failed to copy link', error.message);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      let link = paymentLink;
      if (!link && !item.stripePaymentLinkId) {
        link = await billingService.generatePaymentLink(item.id);
        setPaymentLink(link);
      } else if (!link) {
        link = await billingService.generatePaymentLink(item.id);
      }

      const results: string[] = [];

      if (sendMethod === 'email' || sendMethod === 'both') {
        await billingService.sendInvoiceEmail(item.id, customMessage);
        results.push('Email sent');
      }

      if ((sendMethod === 'sms' || sendMethod === 'both') && customerPhone) {
        const smsResult = await twilioService.sendInvoiceSMS({
          invoiceId: item.id,
          customerId: item.customerId || '',
          phoneNumber: twilioService.formatPhoneNumber(customerPhone),
          customerName: item.customerName,
          invoiceNumber: item.printavoVisualId,
          amount: item.invoiceTotal,
          paymentLink: link,
        });

        if (smsResult.success) {
          results.push('Text message sent');
        } else {
          throw new Error(`SMS failed: ${smsResult.error}`);
        }
      }

      await billingService.moveToAccountsReceivable(item.id);

      showNotification('success', 'Invoice sent successfully!', results.length > 0 ? results.join(' and ') : undefined);
      onSuccess();
      onClose();
    } catch (error: any) {
      showNotification('error', 'Failed to send invoice', error.message);
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
                <p className="text-sm font-medium text-gray-900">{item.customerEmail || 'N/A'}</p>
              </div>
              {twilioEnabled && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                  <p className="text-sm font-medium text-gray-900">{customerPhone || 'Not available'}</p>
                </div>
              )}
            </div>
          </div>

          {twilioEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setSendMethod('email')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                    sendMethod === 'email'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  disabled={!item.customerEmail}
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-sm font-medium">Email</span>
                </button>
                <button
                  onClick={() => setSendMethod('sms')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                    sendMethod === 'sms'
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  disabled={!customerPhone}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm font-medium">Text</span>
                </button>
                <button
                  onClick={() => setSendMethod('both')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                    sendMethod === 'both'
                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  disabled={!item.customerEmail || !customerPhone}
                >
                  <div className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-medium">Both</span>
                </button>
              </div>
              {(!item.customerEmail || !customerPhone) && (
                <p className="text-xs text-amber-600 mt-2">
                  {!item.customerEmail && !customerPhone && 'Email and phone number are required for sending'}
                  {!item.customerEmail && customerPhone && 'Email is required for email sending'}
                  {item.customerEmail && !customerPhone && 'Phone number is required for SMS sending'}
                </p>
              )}
            </div>
          )}

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
            onClick={handleSend}
            disabled={
              sending ||
              (sendMethod === 'email' && !item.customerEmail) ||
              (sendMethod === 'sms' && !customerPhone) ||
              (sendMethod === 'both' && (!item.customerEmail || !customerPhone))
            }
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
              sendMethod === 'email'
                ? 'bg-blue-600 hover:bg-blue-700'
                : sendMethod === 'sms'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                {sendMethod === 'email' && (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Email
                  </>
                )}
                {sendMethod === 'sms' && (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    Send Text
                  </>
                )}
                {sendMethod === 'both' && (
                  <>
                    <Send className="w-4 h-4" />
                    Send Both
                  </>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
