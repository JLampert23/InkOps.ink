import React, { useState } from 'react';
import { Copy, Check, Eye, EyeOff, Code, ChevronDown, ChevronUp } from 'lucide-react';
import { AVAILABLE_SHORT_CODES, type ShortCodeKey } from '../../types/shortcode';
import { ShortCodeEngine } from '../../services/shortcode-service';

interface ShortCodeReferenceProps {
  showPreview?: boolean;
  compact?: boolean;
}

export default function ShortCodeReference({ showPreview = true, compact = false }: ShortCodeReferenceProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['customer', 'quote']));

  const categories = {
    customer: { title: 'Customer Fields', icon: '👤' },
    quote: { title: 'Quote Fields', icon: '📄' },
    invoice: { title: 'Invoice Fields', icon: '🧾' },
    company: { title: 'Company Fields', icon: '🏢' },
    user: { title: 'User (Sender) Fields', icon: '👨‍💼' },
    payment: { title: 'Payment Fields', icon: '💳' },
    general: { title: 'General Fields', icon: '📅' },
  };

  const categorizeShortCode = (key: string): keyof typeof categories => {
    if (key.startsWith('customer_')) return 'customer';
    if (key.startsWith('quote_')) return 'quote';
    if (key.startsWith('invoice_')) return 'invoice';
    if (key.startsWith('company_')) return 'company';
    if (key.startsWith('user_')) return 'user';
    if (key.startsWith('payment_')) return 'payment';
    return 'general';
  };

  const groupedShortCodes = Object.entries(AVAILABLE_SHORT_CODES).reduce((acc, [key, label]) => {
    const category = categorizeShortCode(key);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ key, label });
    return acc;
  }, {} as Record<string, Array<{ key: string; label: string }>>);

  const handleCopy = (key: string) => {
    const shortCode = `{{${key}}}`;
    navigator.clipboard.writeText(shortCode);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const sampleTemplate = `<p>Hi {{customer_first_name}},</p>

<p>Your quote {{quote_number}} for {{customer_company}} is ready for review!</p>

<p><strong>Total Amount:</strong> {{quote_total}}<br/>
<strong>Quote Date:</strong> {{quote_date}}<br/>
<strong>Expires:</strong> {{quote_expiry_date}}</p>

<p>Click below to review and approve your quote:</p>
<p><a href="{{quote_link}}">Review Quote</a></p>

<p>If you have any questions, please contact us.</p>

<p>Best regards,<br/>
{{user_name}}<br/>
{{company_name}}<br/>
{{company_phone}}</p>`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Code className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Available Short Codes
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Use these placeholders in your email templates. They'll be replaced with actual data when emails are sent.
          </p>
        </div>
        {showPreview && (
          <button
            onClick={() => setPreviewVisible(!previewVisible)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            {previewVisible ? (
              <>
                <EyeOff className="w-4 h-4" />
                Hide Preview
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                Show Preview
              </>
            )}
          </button>
        )}
      </div>

      {/* Preview Section */}
      {previewVisible && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200">Live Preview</h4>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                See how short codes are replaced with sample data
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">Template with Short Codes:</div>
              <div className="bg-white dark:bg-slate-800 rounded border border-blue-200 dark:border-blue-700 p-3 text-xs font-mono text-gray-700 dark:text-gray-300 max-h-64 overflow-auto">
                {sampleTemplate}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-2">Rendered with Sample Data:</div>
              <div
                className="bg-white dark:bg-slate-800 rounded border border-blue-200 dark:border-blue-700 p-3 text-xs max-h-64 overflow-auto"
                dangerouslySetInnerHTML={{ __html: ShortCodeEngine.generatePreview(sampleTemplate) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Short Codes by Category */}
      <div className="space-y-3">
        {Object.entries(categories).map(([categoryKey, categoryInfo]) => {
          const codes = groupedShortCodes[categoryKey] || [];
          if (codes.length === 0) return null;

          const isExpanded = expandedCategories.has(categoryKey);

          return (
            <div
              key={categoryKey}
              className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(categoryKey)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-750 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{categoryInfo.icon}</span>
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {categoryInfo.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {codes.length} short code{codes.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Category Content */}
              {isExpanded && (
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                  {codes.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-sm font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                            {`{{${key}}}`}
                          </code>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {label}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCopy(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
                          copiedCode === key
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                        }`}
                        title="Copy to clipboard"
                      >
                        {copiedCode === key ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Usage Tip */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="text-amber-600 dark:text-amber-400 text-xl">💡</div>
          <div className="flex-1 min-w-0">
            <h5 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
              How to Use Short Codes
            </h5>
            <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1 list-disc list-inside">
              <li>Copy any short code and paste it into your email template (subject or body)</li>
              <li>When the email is sent, the short code will be replaced with actual data</li>
              <li>You can use the same short code multiple times in one template</li>
              <li>Missing data will be replaced with an empty string</li>
              <li>All currency values are automatically formatted (e.g., $1,250.00)</li>
              <li>All dates are automatically formatted (e.g., January 15, 2024)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
