import { useState, useEffect } from 'react';
import { X, Send, Mail, Loader2, Eye, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';
import { ShortCodeEngine } from '../../services/shortcode-service';
import DOMPurify from 'dompurify';
import { getQuoteApprovalUrl } from '../../utils/portal-url';

interface SendQuoteModalProps {
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface EmailTemplate {
  id: string;
  template_name: string;
  subject_template: string;
  body_template: string;
  template_type: string;
  auto_attach_quote_link: boolean;
}

export function SendQuoteModal({
  quoteId,
  quoteNumber,
  customerName,
  customerEmail,
  totalAmount,
  onClose,
  onSuccess,
}: SendQuoteModalProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [inkopsSubdomain, setInkopsSubdomain] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
    loadCompanySettings();
  }, []);

  const loadCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('inkops_subdomain, company_name')
      .maybeSingle();
    if (data?.inkops_subdomain) {
      setInkopsSubdomain(data.inkops_subdomain);
    }
    if (data?.company_name) {
      setCompanyName(data.company_name);
    }
  };

  useEffect(() => {
    if (selectedTemplateId) {
      generatePreview();
    }
  }, [selectedTemplateId, customMessage]);

  const loadTemplates = async () => {
    try {
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from('communication_templates')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('template_type', 'quote_email_default')
        .eq('is_active', true)
        .order('template_name');

      if (error) throw error;

      setTemplates(data || []);

      if (data && data.length > 0) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = async () => {
    try {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (!template) return;

      const { data: quote } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .maybeSingle();

      if (!quote) return;

      const approvalUrl = getQuoteApprovalUrl('PREVIEW_TOKEN', inkopsSubdomain, companyName);
      const expiryDate = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      const shortcodeData = {
        customer_full_name: quote.customer_name || '',
        customer_company: quote.customer_name || '',
        customer_email: quote.customer_email || '',
        quote_number: quote.quote_number || '',
        quote_total: quote.total ? `$${quote.total.toFixed(2)}` : '$0.00',
        quote_subtotal: quote.subtotal ? `$${quote.subtotal.toFixed(2)}` : '$0.00',
        quote_tax: quote.sales_tax ? `$${quote.sales_tax.toFixed(2)}` : '$0.00',
        quote_date: quote.created_date ? new Date(quote.created_date).toLocaleDateString() : '',
        quote_expiry_date: expiryDate.toLocaleDateString(),
        quote_link: approvalUrl,
        quote_status: quote.status || 'draft',
        custom_message: customMessage,
      };

      const processedSubject = ShortCodeEngine.renderTemplate(template.subject_template, shortcodeData);
      const processedBody = ShortCodeEngine.renderTemplate(template.body_template, shortcodeData);

      setPreviewSubject(processedSubject);
      setPreviewHtml(processedBody);
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  };

  const handleSend = async () => {
    if (!selectedTemplateId) {
      alert('Please select an email template');
      return;
    }

    setSending(true);
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Session check:', { hasSession: !!session, hasToken: !!session?.access_token, error: sessionError });

      if (sessionError || !session) {
        throw new Error('You must be logged in to send quotes. Please refresh and try again.');
      }

      console.log('Calling edge function (auth will be handled automatically by Supabase client)');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-actions/${quoteId}/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: selectedTemplateId,
            custom_message: customMessage,
            expires_in_days: expiresInDays,
            single_use: false,
            auto_approve_after_days: null,
            auto_convert_on_approval: false,
          }),
        }
      );

      console.log('Edge function response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Edge function error:', errorData);
        throw new Error(errorData.error || `Failed to send quote (${response.status})`);
      }

      const data = await response.json();

      alert(`Quote sent successfully to ${customerEmail}`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error sending quote:', error);
      alert(error instanceof Error ? error.message : 'Failed to send quote');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-center mt-4 text-slate-600 dark:text-slate-400">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">No Templates Available</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-900 dark:text-amber-200">
                No email templates found for sending quotes. Please create a template in Settings with type "Quote Email Default" first.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Send Quote</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-900/20 rounded-lg p-4 space-y-2 border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide font-medium">Quote Number</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{quoteNumber}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide font-medium">Amount</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  ${totalAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide font-medium">Customer</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{customerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide font-medium">Email</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{customerEmail || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.template_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select which email template to use for sending this quote
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Link Expiration
            </label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Message (Optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Add a personal message (available as {{custom_message}} in your template)..."
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              This message will be available in your template using the shortcode: <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded">{'{{custom_message}}'}</code>
            </p>
          </div>

          {showPreview && previewHtml && (
            <div className="border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="bg-slate-100 dark:bg-slate-900 px-4 py-3 border-b border-slate-300 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Preview</p>
              </div>
              <div className="p-4 space-y-3 bg-white dark:bg-slate-800">
                <div>
                  <p className="text-xs text-slate-600 dark:text-slate-400"><strong>To:</strong> {customerEmail}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400"><strong>Subject:</strong> {previewSubject}</p>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex gap-3 bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !customerEmail || !selectedTemplateId}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                Send Quote Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
