import { useState } from 'react';
import { Code, Search, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { AVAILABLE_SHORT_CODES, type ShortCodeKey } from '../../types/shortcode';
import { useNotification } from '../../contexts/NotificationContext';

interface ShortCodeReferenceProps {
  onInsert?: (shortCode: string) => void;
}

export function ShortCodeReference({ onInsert }: ShortCodeReferenceProps) {
  const { showNotification } = useNotification();
  const [search, setSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'customer' | 'quote' | 'invoice' | 'company' | 'user' | 'payment' | 'general'>('all');

  const categories = {
    all: 'All',
    customer: 'Customer',
    quote: 'Quote',
    invoice: 'Invoice',
    company: 'Company',
    user: 'User',
    payment: 'Payment',
    general: 'General',
  };

  const categorizeShortCode = (key: string): string => {
    if (key.startsWith('customer_')) return 'customer';
    if (key.startsWith('quote_')) return 'quote';
    if (key.startsWith('invoice_')) return 'invoice';
    if (key.startsWith('company_')) return 'company';
    if (key.startsWith('user_')) return 'user';
    if (key.startsWith('payment_')) return 'payment';
    return 'general';
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      customer: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      quote: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      invoice: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      company: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      user: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
      payment: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
      general: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
    };
    return colors[category] || colors.general;
  };

  const filteredShortCodes = Object.entries(AVAILABLE_SHORT_CODES).filter(([key, label]) => {
    const matchesSearch = search === '' ||
      key.toLowerCase().includes(search.toLowerCase()) ||
      label.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = selectedCategory === 'all' ||
      categorizeShortCode(key) === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleCopyShortCode = (key: string) => {
    const shortCode = `{{${key}}}`;
    navigator.clipboard.writeText(shortCode);
    showNotification('success', 'Copied', `${shortCode} copied to clipboard`);
  };

  const handleInsertShortCode = (key: string) => {
    const shortCode = `{{${key}}}`;
    if (onInsert) {
      onInsert(shortCode);
      showNotification('success', 'Inserted', `${shortCode} ready to paste`);
    } else {
      navigator.clipboard.writeText(shortCode);
      showNotification('success', 'Copied', `${shortCode} copied to clipboard`);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-900/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Available Short Codes
          </span>
          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
            {Object.keys(AVAILABLE_SHORT_CODES).length} codes
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="p-3 border-t border-gray-200 dark:border-slate-700 space-y-3">
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
            <strong>Tip:</strong> Use short codes like <code className="text-blue-600 dark:text-blue-400">{'{{customer_name}}'}</code> in your messages. They'll be replaced with actual data when sent.
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search short codes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {Object.entries(categories).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as any)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  selectedCategory === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {filteredShortCodes.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
                No short codes found
              </div>
            ) : (
              filteredShortCodes.map(([key, label]) => {
                const category = categorizeShortCode(key);
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-blue-600 dark:text-blue-400">
                          {`{{${key}}}`}
                        </code>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getCategoryColor(category)}`}>
                          {category}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                        {label}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleCopyShortCode(key)}
                        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
