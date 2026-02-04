import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  CheckCircle,
  GripVertical,
  Search,
  Copy,
} from 'lucide-react';
import { SMART_BLOCKS, type SmartBlock } from '../../types/smart-blocks';
import { AVAILABLE_SHORT_CODES } from '../../types/shortcode';
import { useNotification } from '../../contexts/NotificationContext';

interface SmartBlocksSidebarProps {
  onBlockSelect: (block: SmartBlock) => void;
  onShortCodeClick?: (key: string) => void;
}

const iconMap = {
  'credit-card': CreditCard,
  'check-circle': CheckCircle,
};

export default function SmartBlocksSidebar({ onBlockSelect, onShortCodeClick }: SmartBlocksSidebarProps) {
  const { showNotification } = useNotification();
  const [draggedBlock, setDraggedBlock] = useState<SmartBlock | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Get only action (Call to Action) blocks
  const ctaBlocks = SMART_BLOCKS.filter((block) => block.category === 'action');

  // Sort and filter short codes
  const sortedShortCodes = useMemo(() => {
    const entries = Object.entries(AVAILABLE_SHORT_CODES);

    if (!searchTerm) {
      return entries.sort((a, b) => a[1].localeCompare(b[1]));
    }

    return entries
      .filter(([key, label]) =>
        key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        label.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [searchTerm]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Call to Action Buttons
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Drag buttons into your email
        </p>
      </div>

      {/* Call to Action Buttons */}
      <div className="p-3 space-y-2 border-b border-gray-200 dark:border-slate-700">
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
              className={`group flex items-start gap-2 p-3 rounded-lg border transition-all cursor-move ${
                isDragging
                  ? 'opacity-50 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              {/* Drag Handle */}
              <div className="flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 mt-0.5">
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Block Icon */}
              <div className="flex-shrink-0 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 mt-0.5">
                <IconComponent className="w-5 h-5" />
              </div>

              {/* Block Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {block.name}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {block.description}
                </div>
                {block.requiredShortCodes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {block.requiredShortCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-block px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-mono"
                      >
                        {`{{${code}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Short Codes Section */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Short Codes Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Short Codes
          </h3>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search short codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Short Codes List */}
        <div className="flex-1 overflow-y-auto p-3">
          {sortedShortCodes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No short codes found
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedShortCodes.map(([key, label]) => (
                <div
                  key={key}
                  onClick={() => handleShortCodeClick(key)}
                  className="group flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {label}
                    </div>
                    <div className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-1">
                      {`{{${key}}}`}
                    </div>
                  </div>

                  {/* Copy Button */}
                  <button
                    onClick={(e) => handleCopyToClipboard(key, e)}
                    className="flex-shrink-0 ml-2 p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-slate-700">
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p>
              <strong>Buttons:</strong> {ctaBlocks.length} • <strong>Short Codes:</strong> {sortedShortCodes.length}
            </p>
            <p className="text-gray-500 dark:text-gray-500">
              Drag buttons • Click codes to insert
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
