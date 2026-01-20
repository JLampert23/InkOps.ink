import { useState, useEffect } from 'react';
import { X, Save, Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { AR_COLUMNS, getDefaultARColumns, exportARToPDF, exportARToCSV, downloadCSV } from '../../utils/ar-export';

interface ARReportBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: ReportConfig) => void;
  invoices: any[];
}

export interface ReportConfig {
  name?: string;
  columns: string[];
  filters: {
    dateRange?: string;
    customer?: string;
    agingBucket?: string;
    status?: string;
  };
  format: 'pdf' | 'csv';
}

interface SavedPreset {
  id: string;
  name: string;
  columns: string[];
  filters: any;
  created_at: string;
}

export default function ARReportBuilderModal({ isOpen, onClose, onGenerate, invoices }: ARReportBuilderModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(getDefaultARColumns());
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);

  const allColumns = Object.keys(AR_COLUMNS);

  useEffect(() => {
    if (isOpen) {
      loadPresets();
    }
  }, [isOpen]);

  const loadPresets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from('ar_report_presets')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedPresets(data || []);
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      alert('Please enter a preset name');
      return;
    }

    setSavingPreset(true);
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('id')
        .maybeSingle();

      if (!settings) throw new Error('Company settings not found');

      const { error } = await supabase
        .from('ar_report_presets')
        .insert([{
          company_id: settings.id,
          name: presetName,
          columns: selectedColumns,
          filters: {},
        }]);

      if (error) throw error;

      setPresetName('');
      await loadPresets();
      alert('Preset saved successfully');
    } catch (error) {
      console.error('Error saving preset:', error);
      alert('Failed to save preset');
    } finally {
      setSavingPreset(false);
    }
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setSelectedColumns(preset.columns);
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return;

    try {
      const { error } = await supabase
        .from('ar_report_presets')
        .delete()
        .eq('id', presetId);

      if (error) throw error;
      await loadPresets();
    } catch (error) {
      console.error('Error deleting preset:', error);
      alert('Failed to delete preset');
    }
  };

  const handleGenerate = async () => {
    if (selectedColumns.length === 0) {
      alert('Please select at least one column');
      return;
    }

    setLoading(true);
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('company_name')
        .maybeSingle();

      if (format === 'pdf') {
        await exportARToPDF({
          invoices,
          columns: selectedColumns,
          companyName: settings?.company_name || 'Company Name',
        });
      } else {
        const csvContent = exportARToCSV({
          invoices,
          columns: selectedColumns,
        });
        downloadCSV(csvContent);
      }

      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">AR Report Builder</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Select Columns</h3>
              <div className="grid grid-cols-2 gap-3">
                {allColumns.map(column => (
                  <label
                    key={column}
                    className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(column)}
                      onChange={() => handleColumnToggle(column)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {AR_COLUMNS[column as keyof typeof AR_COLUMNS]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Output Format</h3>
              <div className="flex space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="pdf"
                    checked={format === 'pdf'}
                    onChange={() => setFormat('pdf')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700">PDF</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value="csv"
                    checked={format === 'csv'}
                    onChange={() => setFormat('csv')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <FileSpreadsheet className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700">CSV</span>
                </label>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Save as Preset</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleSavePreset}
                  disabled={savingPreset || !presetName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {savingPreset ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save</span>
                </button>
              </div>
            </div>

            {savedPresets.length > 0 && (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Saved Presets</h3>
                <div className="space-y-2">
                  {savedPresets.map(preset => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{preset.name}</p>
                        <p className="text-xs text-gray-500">
                          {preset.columns.length} columns
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleLoadPreset(preset)}
                          className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || selectedColumns.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Generate Report</span>
          </button>
        </div>
      </div>
    </div>
  );
}
