import React, { useState, useMemo } from 'react';
import { CreditCard, CheckCircle, GripVertical, Search, Copy, ChevronDown, ChevronRight, User, FileText, Receipt, Building2, CircleUser as UserCircle, Wallet, Calendar } from 'lucide-react';
import { SMART_BLOCKS, type SmartBlock } from '../../types/smart-blocks';
import { AVAILABLE_SHORT_CODES, type ShortCodeKey } from '../../types/shortcode';
import { useNotification } from '../../contexts/NotificationContext';

interface SmartBlocksSidebarProps {
  onBlockSelect: (block: SmartBlock) => void;
  onShortCodeClick?: (key: string) => void;
}

const iconMap = {
  'credit-card': CreditCard,
  'check-circle': CheckCircle,
};

interface ShortCodeCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  codes: [string, string][];
}

export default function SmartBlocksSidebar({ onBlockSelect, onShortCodeClick }: SmartBlocksSidebarProps) {
  const { showNotification } = useNotification();
  const [draggedBlock, setDraggedBlock] = useState<SmartBlock | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['customer', 'quote', 'invoice'])
  );

  const handleDragStart = (e: React.DragEvent, block: SmartBlock) => {
    setDraggedBlock(block);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(block));
    e.dataTransfer.setData('text/html', block.htmlTemplate);
  };

  const handleDragEnd = () => {
    setDraggedBlock(null);
  };

  const handleCopyToClipboard = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const shortCode = `{{${key}}}`;
    navigator.clipboard.writeText(shortCode);
    showNotification('success', 'Copied', `${shortCode} copied to clipboard`);
  };

  const handleShortCodeClick = (key: string) => {
    onShortCodeClick?.(key);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Get only action (Call to Action) blocks
  const ctaBlocks = SMART_BLOCKS.filter((block) => block.category === 'action');

  // Organize short codes by category
  const categorizedShortCodes = useMemo(() => {
    const entries = Object.entries(AVAILABLE_SHORT_CODES);

    const categories: ShortCodeCategory[] = [
      {
        id: 'customer',
        label: 'Customer Information',
        icon: User,
        color: 'blue',
        codes: [],
      },
      {
        id: 'quote',
        label: 'Quote Details',
        icon: FileText,
        color: 'purple',
        codes: [],
      },
      {
        id: 'invoice',
        label: 'Invoice Details',
        icon: Receipt,
        color: 'green',
        codes: [],
      },
      {
        id: 'company',
        label: 'Company Information',
        icon: Building2,
        color: 'orange',
        codes: [],
      },
      {
        id: 'user',
        label: 'User Information',
        icon: UserCircle,
        color: 'cyan',
        codes: [],
      },
      {
        id: 'payment',
        label: 'Payment Details',
        icon: Wallet,
        color: 'emerald',
        codes: [],
      },
      {
        id: 'general',
        label: 'General',
        icon: Calendar,
        color: 'slate',
        codes: [],
      },
    ];

    entries.forEach(([key, label]) => {
      if (key.startsWith('customer_')) {
        categories[0].codes.push([key, label]);
      } else if (key.startsWith('quote_') || key === 'art_approval_link') {
        categories[1].codes.push([key, label]);
      } else if (key.startsWith('invoice_')) {
        categories[2].codes.push([key, label]);
      } else if (key.startsWith('company_')) {
        categories[3].codes.push([key, label]);
      } else if (key.startsWith('user_')) {
        categories[4].codes.push([key, label]);
      } else if (key.startsWith('payment_')) {
        categories[5].codes.push([key, label]);
      } else {
        categories[6].codes.push([key, label]);
      }
    });

    // Filter by search term if present
    if (searchTerm) {
      const filteredCategories = categories
        .map((category) => ({
          ...category,
          codes: category.codes.filter(([key, label]) =>
            key.toLowerCase().includes(searchTerm.toLowerCase()) ||
            label.toLowerCase().includes(searchTerm.toLowerCase())
          ),
        }))
        .filter((category) => category.codes.length > 0);
      return filteredCategories;
    }

    return categories.filter((category) => category.codes.length > 0);
  }, [searchTerm]);

  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    purple: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
    green: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    orange: 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300',
    cyan: 'bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    slate: 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300',
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* CTA Buttons Section */}
      <div className="flex-shrink-0">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 border-b-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-base font-bold text-blue-900 dark:text-blue-100">
            Call to Action Buttons
          </h3>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Drag or click to insert buttons
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="p-3 space-y-2 bg-blue-50/30 dark:bg-blue-950/20 border-b-4 border-slate-200 dark:border-slate-700">
          {ctaBlocks.map((block) => {
            const IconComponent = iconMap[block.icon as keyof typeof iconMap] || CheckCircle;
            const isDragging = draggedBlock?.id === block.id;

            return (
              <div
                key={block.id}
                draggable
                onDragStart={(e) => handleDragStart(e, block)}
                onDragEnd={handleDragEnd}
                onClick={() => onBlockSelect(block)}
                className={`group flex items-start gap-2 p-3 rounded-lg border-2 transition-all cursor-move shadow-sm hover:shadow-md ${
                  isDragging
                    ? 'opacity-50 border-blue-500 dark:border-blue-500 bg-blue-100 dark:bg-blue-900/30'
                    : 'border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                {/* Drag Handle */}
                <div className="flex-shrink-0 text-blue-400 dark:text-blue-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 mt-0.5">
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Block Icon */}
                <div className="flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5">
                  <IconComponent className="w-5 h-5" />
                </div>

                {/* Block Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {block.name}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {block.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Short Codes Section */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Short Codes Header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">
            Short Codes
          </h3>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search variables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Categorized Short Codes List */}
        <div className="flex-1 overflow-y-auto">
          {categorizedShortCodes.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                No short codes found
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {categorizedShortCodes.map((category) => {
                const isExpanded = expandedCategories.has(category.id);
                const IconComponent = category.icon;
                const colorClass = colorClasses[category.color as keyof typeof colorClasses];

                return (
                  <div key={category.id} className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className={`w-full flex items-center justify-between p-3 transition-colors ${
                        isExpanded
                          ? colorClass
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-4 h-4" />
                        <span className="text-sm font-semibold">{category.label}</span>
                        <span className="text-xs opacity-70">({category.codes.length})</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {/* Category Items */}
                    {isExpanded && (
                      <div className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                        {category.codes.map(([key, label]) => (
                          <div
                            key={key}
                            onClick={() => handleShortCodeClick(key)}
                            className="group flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="text-xs font-medium text-slate-900 dark:text-white truncate">
                                {label}
                              </div>
                              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                {`{{${key}}}`}
                              </div>
                            </div>

                            {/* Copy Button */}
                            <button
                              onClick={(e) => handleCopyToClipboard(key, e)}
                              className="flex-shrink-0 p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                              title="Copy to clipboard"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <p className="font-medium">
              {ctaBlocks.length} Buttons • {categorizedShortCodes.reduce((acc, cat) => acc + cat.codes.length, 0)} Variables
            </p>
            <p className="text-slate-500 dark:text-slate-500">
              Click categories to expand • Click items to insert
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
