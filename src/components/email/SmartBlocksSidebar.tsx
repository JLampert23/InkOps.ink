import React, { useState } from 'react';
import {
  User,
  Receipt,
  FileText,
  CreditCard,
  CheckCircle,
  Building,
  Minus,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { SMART_BLOCKS, BLOCK_CATEGORIES, type SmartBlock } from '../../types/smart-blocks';

interface SmartBlocksSidebarProps {
  onBlockSelect: (block: SmartBlock) => void;
}

const iconMap = {
  user: User,
  receipt: Receipt,
  'file-text': FileText,
  'credit-card': CreditCard,
  'check-circle': CheckCircle,
  building: Building,
  minus: Minus,
};

export default function SmartBlocksSidebar({ onBlockSelect }: SmartBlocksSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(Object.keys(BLOCK_CATEGORIES))
  );
  const [draggedBlock, setDraggedBlock] = useState<SmartBlock | null>(null);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, block: SmartBlock) => {
    setDraggedBlock(block);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify(block));
    e.dataTransfer.setData('text/html', block.htmlTemplate);
  };

  const handleDragEnd = () => {
    setDraggedBlock(null);
  };

  const groupedBlocks = SMART_BLOCKS.reduce((acc, block) => {
    if (!acc[block.category]) {
      acc[block.category] = [];
    }
    acc[block.category].push(block);
    return acc;
  }, {} as Record<string, SmartBlock[]>);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Smart Blocks</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          Drag blocks into your email
        </p>
      </div>

      {/* Blocks List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {Object.entries(groupedBlocks).map(([category, blocks]) => {
          const categoryMeta = BLOCK_CATEGORIES[category as keyof typeof BLOCK_CATEGORIES];
          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="space-y-1">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span>{categoryMeta.label}</span>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                  {blocks.length}
                </span>
              </button>

              {/* Category Blocks */}
              {isExpanded && (
                <div className="space-y-1 pl-2">
                  {blocks.map((block) => {
                    const IconComponent = iconMap[block.icon as keyof typeof iconMap] || FileText;
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
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Hint */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <GripVertical className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>Tip:</strong> Drag blocks into the editor or click to insert at cursor
          </p>
        </div>
      </div>
    </div>
  );
}
