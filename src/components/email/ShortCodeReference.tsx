import React, { useState } from 'react';
import { Copy, Check, Eye, EyeOff, Code, ChevronDown, ChevronRight } from 'lucide-react';
import { AVAILABLE_SHORT_CODES } from '../../types/shortcode';
import { ShortCodeEngine } from '../../services/shortcode-service';

interface ShortCodeReferenceProps {
  showPreview?: boolean;
  compact?: boolean;
}

export default function ShortCodeReference({ showPreview = true, compact = false }: ShortCodeReferenceProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['customer']));

  const categories = {
    customer: { title: 'Customer', color: 'text-blue-600 dark:text-blue-400' },
    quote: { title: 'Quote', color: 'text-emerald-600 dark:text-emerald-400' },
    invoice: { title: 'Invoice', color: 'text-amber-600 dark:text-amber-400' },
    company: { title: 'Company', color: 'text-slate-600 dark:text-slate-400' },
    user: { title: 'User', color: 'text-cyan-600 dark:text-cyan-400' },
    payment: { title: 'Payment', color: 'text-green-600 dark:text-green-400' },
    general: { title: 'General', color: 'text-gray-600 dark:text-gray-400' },
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
<p>Your quote {{quote_number}} for {{customer_company}} is ready!</p>
<p><strong>Total:</strong> {{quote_total}}</p>
<p><a href="{{quote_link}}">Review Quote</a></p>
<p>{{user_name}}<br/>{{company_name}}</p>`;

  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Available Short Codes
          </h4>
        </div>
        {showPreview && (
          <button
            onClick={() => setPreviewVisible(!previewVisible)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded transition-colors"
          >
            {previewVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {previewVisible ? 'Hide' : 'Preview'}
          </button>
        )}
      </div>

      {/* Compact Preview */}
      {previewVisible && (
        <div className="mb-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded p-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] font-medium text-blue-700 dark:text-blue-300 mb-1">Template:</div>
              <div className="bg-white dark:bg-slate-800 rounded border border-blue-200 dark:border-blue-700/50 p-2 text-[10px] font-mono text-slate-600 dark:text-slate-300 max-h-32 overflow-auto leading-relaxed">
                {sampleTemplate}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium text-blue-700 dark:text-blue-300 mb-1">Rendered:</div>
              <div
                className="bg-white dark:bg-slate-800 rounded border border-blue-200 dark:border-blue-700/50 p-2 text-[10px] max-h-32 overflow-auto text-slate-700 dark:text-slate-200 leading-relaxed [&_p]:mb-1 [&_a]:text-blue-600 [&_a]:dark:text-blue-400"
                dangerouslySetInnerHTML={{ __html: ShortCodeEngine.generatePreview(sampleTemplate) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Compact Categories Grid */}
      <div className="space-y-1">
        {Object.entries(categories).map(([categoryKey, categoryInfo]) => {
          const codes = groupedShortCodes[categoryKey] || [];
          if (codes.length === 0) return null;

          const isExpanded = expandedCategories.has(categoryKey);

          return (
            <div
              key={categoryKey}
              className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              {/* Compact Category Header */}
              <button
                onClick={() => toggleCategory(categoryKey)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                )}
                <span className={`text-xs font-semibold ${categoryInfo.color}`}>
                  {categoryInfo.title}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  ({codes.length})
                </span>
              </button>

              {/* Compact Codes List */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700 px-2 py-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {codes.map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-1 px-1.5 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <code className="text-[10px] font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1 py-0.5 rounded shrink-0">
                          {`{{${key}}}`}
                        </code>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {label}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(key)}
                        className={`p-1 rounded transition-all shrink-0 ${
                          copiedCode === key
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                        }`}
                        title="Copy"
                      >
                        {copiedCode === key ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
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

      {/* Compact Tip */}
      <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
        Copy short codes and paste into templates. They auto-replace with real data when sent.
      </div>
    </div>
  );
}
