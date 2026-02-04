import React, { useState, useMemo } from 'react';
import { Search, Code, ChevronDown, ChevronRight } from 'lucide-react';
import { AVAILABLE_SHORT_CODES } from '../../types/shortcode';

interface ShortCodeSidebarProps {
  onShortCodeClick: (key: string) => void;
}

export default function ShortCodeSidebar({ onShortCodeClick }: ShortCodeSidebarProps) {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['customer', 'invoice', 'quote', 'company'])
  );

  // Group shortcodes by category
  const groupedShortCodes = useMemo(() => {
    const groups: Record<string, Array<[string, string]>> = {
      customer: [],
      quote: [],
      invoice: [],
      payment: [],
      company: [],
      user: [],
      general: [],
    };

    Object.entries(AVAILABLE_SHORT_CODES).forEach(([key, label]) => {
      // Filter by search
      if (search && !key.toLowerCase().includes(search.toLowerCase()) &&
          !label.toLowerCase().includes(search.toLowerCase())) {
        return;
      }

      // Categorize
      if (key.startsWith('customer_')) groups.customer.push([key, label]);
      else if (key.startsWith('quote_')) groups.quote.push([key, label]);
      else if (key.startsWith('invoice_')) groups.invoice.push([key, label]);
      else if (key.startsWith('payment_')) groups.payment.push([key, label]);
      else if (key.startsWith('company_')) groups.company.push([key, label]);
      else if (key.startsWith('user_')) groups.user.push([key, label]);
      else groups.general.push([key, label]);
    });

    // Sort within each category
    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => a[0].localeCompare(b[0]));
    });

    return groups;
  }, [search]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      customer: 'Customer Info',
      quote: 'Quote Data',
      invoice: 'Invoice Data',
      payment: 'Payment Info',
      company: 'Company Info',
      user: 'User Info',
      general: 'General',
    };
    return labels[category] || category;
  };

  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      customer: '👤',
      quote: '📋',
      invoice: '🧾',
      payment: '💳',
      company: '🏢',
      user: '👨‍💼',
      general: '⚙️',
    };
    return icons[category] || '📄';
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <Code className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Shortcodes
          </h3>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Click any shortcode to insert at cursor position
        </p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search shortcodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Categories List */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(groupedShortCodes).map(([category, items]) => {
          if (items.length === 0) return null;

          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="mb-2">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-3 py-2 text-left bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-750 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getCategoryIcon(category)}</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {getCategoryLabel(category)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({items.length})
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                )}
              </button>

              {/* Category Items */}
              {isExpanded && (
                <div className="mt-1 space-y-1 pl-2">
                  {items.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => onShortCodeClick(key)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-all group"
                    >
                      <div className="flex items-start gap-2">
                        <Code className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all">
                            {`{{${key}}}`}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            {label}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Help */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <strong>Tip:</strong> Shortcodes are automatically replaced with real data when emails are sent.
        </p>
      </div>
    </div>
  );
}
