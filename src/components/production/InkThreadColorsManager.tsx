import { useState, useEffect } from 'react';
import { Palette, Plus, Edit as EditIcon, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';

interface ColorStitchOption {
  id: string;
  company_id: string;
  option_label: string;
  option_value: string;
  option_type: 'color' | 'stitch' | 'other';
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function InkThreadColorsManager() {
  const { showNotification, confirm } = useNotification();
  const [colorStitchOptions, setColorStitchOptions] = useState<ColorStitchOption[]>([]);
  const [loadingColorStitch, setLoadingColorStitch] = useState(false);
  const [editingColorStitchId, setEditingColorStitchId] = useState<string | null>(null);
  const [showAddColorStitchModal, setShowAddColorStitchModal] = useState(false);
  const [colorStitchFormData, setColorStitchFormData] = useState({
    option_label: '',
    option_value: '',
    option_type: 'color' as 'color' | 'stitch' | 'other',
  });
  const [savingColorStitch, setSavingColorStitch] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'color' | 'stitch'>('all');

  useEffect(() => {
    loadColorStitchOptions();
  }, []);

  const loadColorStitchOptions = async () => {
    try {
      setLoadingColorStitch(true);
      const { data, error } = await supabase
        .from('color_stitch_options')
        .select('*')
        .eq('is_active', true)
        .order('option_type')
        .order('sort_order');

      if (error) throw error;
      setColorStitchOptions(data || []);
    } catch (err) {
      console.error('Error loading color/stitch options:', err);
      showNotification('error', 'Load Failed', 'Failed to load color/stitch options.');
    } finally {
      setLoadingColorStitch(false);
    }
  };

  const resetColorStitchForm = () => {
    setColorStitchFormData({
      option_label: '',
      option_value: '',
      option_type: 'color',
    });
    setEditingColorStitchId(null);
  };

  const openAddColorStitchModal = () => {
    resetColorStitchForm();
    setShowAddColorStitchModal(true);
  };

  const openEditColorStitchModal = (option: ColorStitchOption) => {
    setColorStitchFormData({
      option_label: option.option_label,
      option_value: option.option_value,
      option_type: option.option_type,
    });
    setEditingColorStitchId(option.id);
    setShowAddColorStitchModal(true);
  };

  const saveColorStitchOption = async () => {
    if (!colorStitchFormData.option_label || !colorStitchFormData.option_value) {
      showNotification('error', 'Missing Information', 'Please fill in all required fields.');
      return;
    }

    try {
      setSavingColorStitch(true);

      if (editingColorStitchId) {
        const { error } = await supabase
          .from('color_stitch_options')
          .update({
            option_label: colorStitchFormData.option_label,
            option_value: colorStitchFormData.option_value,
            option_type: colorStitchFormData.option_type,
          })
          .eq('id', editingColorStitchId);

        if (error) throw error;
        showNotification('success', 'Option Updated', 'Color/stitch option updated successfully!');
      } else {
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('id')
          .single();

        if (!companyData?.id) {
          showNotification('error', 'Error', 'Company settings not found. Please refresh the page.');
          setSavingColorStitch(false);
          return;
        }

        const maxSortOrder = colorStitchOptions
          .filter(opt => opt.option_type === colorStitchFormData.option_type)
          .reduce((max, opt) => Math.max(max, opt.sort_order), 0);

        const { error } = await supabase
          .from('color_stitch_options')
          .insert([{
            company_id: companyData.id,
            option_label: colorStitchFormData.option_label,
            option_value: colorStitchFormData.option_value,
            option_type: colorStitchFormData.option_type,
            sort_order: maxSortOrder + 1,
          }]);

        if (error) throw error;
        showNotification('success', 'Option Created', 'Color/stitch option created successfully!');
      }

      setShowAddColorStitchModal(false);
      resetColorStitchForm();
      loadColorStitchOptions();
    } catch (err: any) {
      console.error('Error saving color/stitch option:', err);
      const errorMessage = err?.message || 'Failed to save option. Please try again.';
      showNotification('error', 'Save Failed', errorMessage);
    } finally {
      setSavingColorStitch(false);
    }
  };

  const deleteColorStitchOption = async (optionId: string) => {
    const confirmed = await confirm(
      'Delete Option?',
      'Are you sure you want to delete this color/stitch option? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('color_stitch_options')
        .update({ is_active: false })
        .eq('id', optionId);

      if (error) throw error;

      showNotification('success', 'Option Deleted', 'Color/stitch option deleted successfully!');
      loadColorStitchOptions();
    } catch (err) {
      console.error('Error deleting option:', err);
      showNotification('error', 'Delete Failed', 'Failed to delete option. Please try again.');
    }
  };

  const filteredOptions = colorStitchOptions.filter(opt => {
    if (filterType === 'all') return true;
    return opt.option_type === filterType;
  });

  const inkColors = colorStitchOptions.filter(opt => opt.option_type === 'color');
  const threadColors = colorStitchOptions.filter(opt => opt.option_type === 'stitch');

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Ink & Thread Colors</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Ink colors (screen print, DTG) and thread colors (embroidery)
            </p>
          </div>
          <button
            onClick={openAddColorStitchModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === 'all'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All ({colorStitchOptions.length})
          </button>
          <button
            onClick={() => setFilterType('color')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === 'color'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Ink ({inkColors.length})
          </button>
          <button
            onClick={() => setFilterType('stitch')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === 'stitch'
                ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Thread ({threadColors.length})
          </button>
        </div>

        {loadingColorStitch ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
        ) : filteredOptions.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            <p className="text-xs">No {filterType === 'color' ? 'ink' : filterType === 'stitch' ? 'thread' : ''} colors yet. Click "Add" to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredOptions.map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-650 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-6 h-6 rounded border border-gray-300 dark:border-slate-600 flex-shrink-0"
                    style={{ backgroundColor: option.option_value }}
                    title={option.option_value}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{option.option_label}</h3>
                    <span className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${
                      option.option_type === 'color'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                    }`}>
                      {option.option_type === 'color' ? 'Ink' : 'Thread'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => openEditColorStitchModal(option)}
                    className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                  >
                    <EditIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteColorStitchOption(option.id)}
                    className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddColorStitchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingColorStitchId ? 'Edit Color' : 'Add Color'}
                </h2>
                <button
                  onClick={() => setShowAddColorStitchModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={colorStitchFormData.option_type === 'color'}
                        onChange={() => setColorStitchFormData({ ...colorStitchFormData, option_type: 'color' })}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Ink Color</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={colorStitchFormData.option_type === 'stitch'}
                        onChange={() => setColorStitchFormData({ ...colorStitchFormData, option_type: 'stitch' })}
                        className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Thread Color</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={colorStitchFormData.option_label}
                    onChange={(e) => setColorStitchFormData({ ...colorStitchFormData, option_label: e.target.value })}
                    placeholder="e.g., Black, White, Red"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color Code (Hex) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={colorStitchFormData.option_value}
                      onChange={(e) => setColorStitchFormData({ ...colorStitchFormData, option_value: e.target.value })}
                      className="w-16 h-10 rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={colorStitchFormData.option_value}
                      onChange={(e) => setColorStitchFormData({ ...colorStitchFormData, option_value: e.target.value })}
                      placeholder="#000000"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => setShowAddColorStitchModal(false)}
                  disabled={savingColorStitch}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveColorStitchOption}
                  disabled={savingColorStitch}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingColorStitch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Palette className="w-4 h-4" />
                      {editingColorStitchId ? 'Update Color' : 'Create Color'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
