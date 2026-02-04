import React, { useState } from 'react';
import { Code, Search, Copy, Eye } from 'lucide-react';
import { AVAILABLE_SHORT_CODES, type ShortCodeKey } from '../../types/shortcode';
import { ShortCodeEngine } from '../../services/shortcode-service';
import { useNotification } from '../../contexts/NotificationContext';

interface ShortCodePickerProps {
  onInsert: (shortCode: string) => void;
  currentTemplate?: string;
}

export default function ShortCodePicker({ onInsert, currentTemplate }: ShortCodePickerProps) {
  const { showNotification } = useNotification();
  const [search, setSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
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
    onInsert(shortCode);
    showNotification('success', 'Inserted', `${shortCode} inserted into template`);
  };

  const renderPreview = () => {
    if (!currentTemplate) {
      return (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No template to preview
        </div>
      );
    }

    const preview = ShortCodeEngine.generatePreview(currentTemplate);
    const usedCodes = ShortCodeEngine.extractShortCodes(currentTemplate);

    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Used Short Codes ({usedCodes.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {usedCodes.map(code => (
              <span
                key={code}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded"
              >
                <Code className="w-3 h-3" />
                {code}
              </span>
            ))}
            {usedCodes.length === 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                No short codes used yet
              </span>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Preview with Sample Data
          </h4>
          <div
            className="border border-gray-300 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-800 max-h-96 overflow-auto"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Short Codes
        </h3>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
            showPreview
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Eye className="w-4 h-4" />
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {showPreview ? (
        renderPreview()
      ) : (
        <>
          {/* Search and Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search short codes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(categories).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedCategory === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Short Codes List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredShortCodes.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No short codes found
              </div>
            ) : (
              filteredShortCodes.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
                        {`{{${key}}}`}
                      </code>
                      <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded">
                        {categorizeShortCode(key)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {label}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyShortCode(key)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleInsertShortCode(key)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                    >
                      Insert
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <strong>Tip:</strong> Short codes are replaced with actual data when the email is sent.
            Use the preview button to see how your template will look with sample data.
          </div>
        </>
      )}
    </div>
  );
}
