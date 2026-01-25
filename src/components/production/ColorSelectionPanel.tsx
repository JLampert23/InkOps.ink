import React, { useState, useEffect } from 'react';
import { X, Check, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface Color {
  id: string;
  name: string;
  color_code: string;
  type_of_work: string;
}

interface SelectedColor {
  color_type: 'ink' | 'thread';
  color_name: string;
  color_code: string;
}

interface ColorSelectionPanelProps {
  onClose: () => void;
  onSave: (colors: SelectedColor[]) => void;
  selectedColors: SelectedColor[];
}

export default function ColorSelectionPanel({ onClose, onSave, selectedColors }: ColorSelectionPanelProps) {
  const [inkColors, setInkColors] = useState<Color[]>([]);
  const [threadColors, setThreadColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ink' | 'thread'>('ink');
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelected, setTempSelected] = useState<SelectedColor[]>(selectedColors);

  useEffect(() => {
    loadColors();
  }, []);

  const loadColors = async () => {
    try {
      const { data: colors, error } = await supabase
        .from('production_colors')
        .select('*')
        .order('name');

      if (error) throw error;

      if (colors) {
        setInkColors(colors.filter(c => c.type_of_work === 'screen_printing'));
        setThreadColors(colors.filter(c => c.type_of_work === 'embroidery'));
      }
    } catch (error) {
      console.error('Error loading colors:', error);
    } finally {
      setLoading(false);
    }
  };

  const isColorSelected = (colorName: string, colorType: 'ink' | 'thread') => {
    return tempSelected.some(c => c.color_name === colorName && c.color_type === colorType);
  };

  const toggleColor = (color: Color, colorType: 'ink' | 'thread') => {
    const isSelected = isColorSelected(color.name, colorType);

    if (isSelected) {
      setTempSelected(tempSelected.filter(
        c => !(c.color_name === color.name && c.color_type === colorType)
      ));
    } else {
      setTempSelected([...tempSelected, {
        color_type: colorType,
        color_name: color.name,
        color_code: color.color_code,
      }]);
    }
  };

  const handleSave = () => {
    onSave(tempSelected);
    onClose();
  };

  const filteredColors = activeTab === 'ink'
    ? inkColors.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : threadColors.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Colors</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose ink colors for screen printing or thread colors for embroidery
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 px-6">
          <button
            onClick={() => setActiveTab('ink')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'ink'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Ink Colors ({inkColors.length})
          </button>
          <button
            onClick={() => setActiveTab('thread')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'thread'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Thread Colors ({threadColors.length})
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search colors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Selected Count */}
        {tempSelected.length > 0 && (
          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-slate-700">
            <p className="text-sm text-blue-800 dark:text-blue-400 font-medium">
              {tempSelected.length} color{tempSelected.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}

        {/* Color Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredColors.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No colors found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredColors.map((color) => {
                const isSelected = isColorSelected(color.name, activeTab);
                return (
                  <button
                    key={color.id}
                    onClick={() => toggleColor(color, activeTab)}
                    className={`relative p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div
                      className="w-full h-16 rounded-md mb-3 border border-gray-300 dark:border-slate-600"
                      style={{ backgroundColor: color.color_code }}
                    />
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                      {color.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {color.color_code}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <button
            onClick={() => setTempSelected([])}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Clear All
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Save Colors
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
