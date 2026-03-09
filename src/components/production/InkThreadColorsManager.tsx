import { useState, useEffect } from 'react';
import { Palette, Plus, Edit as EditIcon, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';

interface ProductionColor {
  id: string;
  company_id: string;
  name: string;
  color_code: string;
  type_of_work: 'screen_printing' | 'embroidery';
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface InkThreadColorsManagerProps {
  colorType: 'ink' | 'thread';
}

export function InkThreadColorsManager({ colorType }: InkThreadColorsManagerProps) {
  const { showNotification, confirm } = useNotification();
  const [colors, setColors] = useState<ProductionColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [showAddColorModal, setShowAddColorModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkColorText, setBulkColorText] = useState('');
  const [savingBulk, setSavingBulk] = useState(false);
  const [colorFormData, setColorFormData] = useState({
    name: '',
    color_code: '#000000',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadColors();
  }, []);

  const loadColors = async () => {
    try {
      setLoading(true);
      const typeOfWork = colorType === 'ink' ? 'screen_printing' : 'embroidery';
      const { data, error } = await supabase
        .from('production_colors')
        .select('*')
        .eq('is_active', true)
        .eq('type_of_work', typeOfWork)
        .order('sort_order');

      if (error) throw error;
      setColors(data || []);
    } catch (err) {
      console.error('Error loading colors:', err);
      showNotification('error', 'Load Failed', `Failed to load ${colorType} colors.`);
    } finally {
      setLoading(false);
    }
  };

  const resetColorForm = () => {
    setColorFormData({
      name: '',
      color_code: '#000000',
    });
    setEditingColorId(null);
  };

  const openAddColorModal = () => {
    resetColorForm();
    setShowAddColorModal(true);
  };

  const openEditColorModal = (color: ProductionColor) => {
    setColorFormData({
      name: color.name,
      color_code: color.color_code,
    });
    setEditingColorId(color.id);
    setShowAddColorModal(true);
  };

  const saveColor = async () => {
    if (!colorFormData.name || !colorFormData.color_code) {
      showNotification('error', 'Missing Information', 'Please fill in all required fields.');
      return;
    }

    try {
      setSaving(true);
      const typeOfWork = colorType === 'ink' ? 'screen_printing' : 'embroidery';

      if (editingColorId) {
        const { error } = await supabase
          .from('production_colors')
          .update({
            name: colorFormData.name,
            color_code: colorFormData.color_code,
          })
          .eq('id', editingColorId);

        if (error) throw error;
        showNotification('success', 'Color Updated', 'Color updated successfully!');
      } else {
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('id')
          .single();

        if (!companyData?.id) {
          showNotification('error', 'Error', 'Company settings not found. Please refresh the page.');
          setSaving(false);
          return;
        }

        const maxSortOrder = colors.reduce((max, color) => Math.max(max, color.sort_order), 0);

        const { error } = await supabase
          .from('production_colors')
          .insert([{
            company_id: companyData.id,
            name: colorFormData.name,
            color_code: colorFormData.color_code,
            type_of_work: typeOfWork,
            sort_order: maxSortOrder + 1,
          }]);

        if (error) throw error;
        showNotification('success', 'Color Created', 'Color created successfully!');
      }

      setShowAddColorModal(false);
      resetColorForm();
      loadColors();
    } catch (err: any) {
      console.error('Error saving color:', err);
      const errorMessage = err?.message || 'Failed to save color. Please try again.';
      showNotification('error', 'Save Failed', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const deleteColor = async (colorId: string) => {
    const confirmed = await confirm(
      'Delete Color?',
      'Are you sure you want to delete this color? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('production_colors')
        .update({ is_active: false })
        .eq('id', colorId);

      if (error) throw error;

      showNotification('success', 'Color Deleted', 'Color deleted successfully!');
      loadColors();
    } catch (err) {
      console.error('Error deleting color:', err);
      showNotification('error', 'Delete Failed', 'Failed to delete color. Please try again.');
    }
  };

  const bulkAddColors = async () => {
    if (!bulkColorText.trim()) {
      showNotification('error', 'No Input', 'Please enter at least one color name.');
      return;
    }

    try {
      setSavingBulk(true);

      const lines = bulkColorText.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) {
        showNotification('error', 'No Valid Entries', 'Please enter valid color names.');
        setSavingBulk(false);
        return;
      }

      const { data: companyData } = await supabase
        .from('company_settings')
        .select('id')
        .single();

      if (!companyData?.id) {
        showNotification('error', 'Error', 'Company settings not found. Please refresh the page.');
        setSavingBulk(false);
        return;
      }

      const maxSortOrder = colors.reduce((max, color) => Math.max(max, color.sort_order), 0);
      const typeOfWork = colorType === 'ink' ? 'screen_printing' : 'embroidery';

      const newColors = lines.map((colorName, index) => ({
        company_id: companyData.id,
        name: colorName,
        color_code: '#000000',
        type_of_work: typeOfWork,
        sort_order: maxSortOrder + index + 1,
      }));

      const { error } = await supabase
        .from('production_colors')
        .insert(newColors);

      if (error) throw error;

      showNotification('success', 'Bulk Add Complete', `Added ${lines.length} ${colorType} color(s) successfully!`);
      setShowBulkAddModal(false);
      setBulkColorText('');
      loadColors();
    } catch (err: any) {
      console.error('Error bulk adding colors:', err);
      showNotification('error', 'Bulk Add Failed', err?.message || 'Failed to add colors. Please try again.');
    } finally {
      setSavingBulk(false);
    }
  };

  const title = colorType === 'ink' ? 'Ink Colors' : 'Thread Colors';
  const description = colorType === 'ink' ? 'For screen printing, DTG, and other ink-based methods' : 'For embroidery';
  const badgeColor = colorType === 'ink' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowBulkAddModal(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Bulk
            </button>
            <button
              onClick={openAddColorModal}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>
        ) : colors.length === 0 ? (
          <div className="text-center py-3 text-gray-500 dark:text-gray-400">
            <p className="text-xs">No {colorType} colors yet. Click "Add" to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {colors.map((color) => (
              <div
                key={color.id}
                className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-slate-700 rounded hover:bg-gray-100 dark:hover:bg-slate-650 transition-colors"
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div
                    className="w-5 h-5 rounded border border-gray-300 dark:border-slate-600 flex-shrink-0"
                    style={{ backgroundColor: color.color_code }}
                    title={color.color_code}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate">{color.name}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => openEditColorModal(color)}
                    className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                  >
                    <EditIcon className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteColor(color.id)}
                    className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddColorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingColorId ? `Edit ${colorType === 'ink' ? 'Ink' : 'Thread'} Color` : `Add ${colorType === 'ink' ? 'Ink' : 'Thread'} Color`}
                </h2>
                <button
                  onClick={() => setShowAddColorModal(false)}
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
                    Color Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={colorFormData.name}
                    onChange={(e) => setColorFormData({ ...colorFormData, name: e.target.value })}
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
                      value={colorFormData.color_code}
                      onChange={(e) => setColorFormData({ ...colorFormData, color_code: e.target.value })}
                      className="w-16 h-10 rounded border border-gray-300 dark:border-slate-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={colorFormData.color_code}
                      onChange={(e) => setColorFormData({ ...colorFormData, color_code: e.target.value })}
                      placeholder="#000000"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => setShowAddColorModal(false)}
                  disabled={saving}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveColor}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Palette className="w-4 h-4" />
                      {editingColorId ? 'Update Color' : 'Create Color'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Bulk Add {colorType === 'ink' ? 'Ink' : 'Thread'} Colors
                </h2>
                <button
                  onClick={() => setShowBulkAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Enter one color name per line. All colors will be added with a default black color (#000000) that you can edit later.
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                    Example:<br />
                    Red<br />
                    Blue<br />
                    Green<br />
                    White
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Color Names (one per line)
                  </label>
                  <textarea
                    value={bulkColorText}
                    onChange={(e) => setBulkColorText(e.target.value)}
                    placeholder="Red&#10;Blue&#10;Green&#10;White"
                    rows={10}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => setShowBulkAddModal(false)}
                  disabled={savingBulk}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={bulkAddColors}
                  disabled={savingBulk}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingBulk ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add All Colors
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
