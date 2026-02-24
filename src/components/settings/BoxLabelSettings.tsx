import { useState, useEffect } from 'react';
import { Save, Loader2, Tag, Image, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface BoxLabelSettingsProps {
  companyId: string;
  primaryLogoUrl: string | null;
  secondaryLogoUrl: string | null;
}

interface BoxLabelConfig {
  box_label_logo_choice: 'primary' | 'secondary';
  box_label_show_work_order_number: boolean;
  box_label_show_customer_name: boolean;
  box_label_show_due_date: boolean;
  box_label_show_type_of_work: boolean;
  box_label_show_imprint_types: boolean;
  box_label_show_job_nickname: boolean;
}

export default function BoxLabelSettings({ companyId, primaryLogoUrl, secondaryLogoUrl }: BoxLabelSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<BoxLabelConfig>({
    box_label_logo_choice: 'primary',
    box_label_show_work_order_number: true,
    box_label_show_customer_name: true,
    box_label_show_due_date: true,
    box_label_show_type_of_work: true,
    box_label_show_imprint_types: true,
    box_label_show_job_nickname: true,
  });
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_settings')
        .select(`
          box_label_logo_choice,
          box_label_show_work_order_number,
          box_label_show_customer_name,
          box_label_show_due_date,
          box_label_show_type_of_work,
          box_label_show_imprint_types,
          box_label_show_job_nickname
        `)
        .eq('id', companyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          box_label_logo_choice: data.box_label_logo_choice || 'primary',
          box_label_show_work_order_number: data.box_label_show_work_order_number ?? true,
          box_label_show_customer_name: data.box_label_show_customer_name ?? true,
          box_label_show_due_date: data.box_label_show_due_date ?? true,
          box_label_show_type_of_work: data.box_label_show_type_of_work ?? true,
          box_label_show_imprint_types: data.box_label_show_imprint_types ?? true,
          box_label_show_job_nickname: data.box_label_show_job_nickname ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading box label settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);

      const { error } = await supabase
        .from('company_settings')
        .update({
          box_label_logo_choice: config.box_label_logo_choice,
          box_label_show_work_order_number: config.box_label_show_work_order_number,
          box_label_show_customer_name: config.box_label_show_customer_name,
          box_label_show_due_date: config.box_label_show_due_date,
          box_label_show_type_of_work: config.box_label_show_type_of_work,
          box_label_show_imprint_types: config.box_label_show_imprint_types,
          box_label_show_job_nickname: config.box_label_show_job_nickname,
        })
        .eq('id', companyId);

      if (error) throw error;

      setSaveMessage({ type: 'success', text: 'Box label settings saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving box label settings:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const selectedLogoUrl = config.box_label_logo_choice === 'primary' ? primaryLogoUrl : secondaryLogoUrl;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
          <Tag className="w-5 h-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Box Label Settings</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Configure how box labels appear when printed from Work Orders</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Image className="w-4 h-4" />
            Logo Selection
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Choose which company logo to display on box labels
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setConfig({ ...config, box_label_logo_choice: 'primary' })}
              className={`relative p-4 rounded-lg border-2 transition-all ${
                config.box_label_logo_choice === 'primary'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                {primaryLogoUrl ? (
                  <img
                    src={primaryLogoUrl}
                    alt="Primary Logo"
                    className="h-16 w-auto object-contain"
                  />
                ) : (
                  <div className="h-16 w-32 bg-gray-100 dark:bg-slate-700 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-400 dark:text-gray-500">No logo uploaded</span>
                  </div>
                )}
                <span className={`text-sm font-medium ${
                  config.box_label_logo_choice === 'primary'
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  Primary Logo
                </span>
              </div>
              {config.box_label_logo_choice === 'primary' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setConfig({ ...config, box_label_logo_choice: 'secondary' })}
              className={`relative p-4 rounded-lg border-2 transition-all ${
                config.box_label_logo_choice === 'secondary'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                {secondaryLogoUrl ? (
                  <img
                    src={secondaryLogoUrl}
                    alt="Secondary Logo"
                    className="h-16 w-auto object-contain"
                  />
                ) : (
                  <div className="h-16 w-32 bg-gray-100 dark:bg-slate-700 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-400 dark:text-gray-500">No logo uploaded</span>
                  </div>
                )}
                <span className={`text-sm font-medium ${
                  config.box_label_logo_choice === 'secondary'
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  Secondary Logo
                </span>
              </div>
              {config.box_label_logo_choice === 'secondary' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Field Visibility
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select which fields appear on the box label
          </p>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.box_label_show_work_order_number}
                onChange={(e) => setConfig({ ...config, box_label_show_work_order_number: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                Work Order Number
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.box_label_show_customer_name}
                onChange={(e) => setConfig({ ...config, box_label_show_customer_name: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                Customer Name
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.box_label_show_job_nickname}
                onChange={(e) => setConfig({ ...config, box_label_show_job_nickname: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                Job Nickname
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.box_label_show_due_date}
                onChange={(e) => setConfig({ ...config, box_label_show_due_date: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                Due Date
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.box_label_show_imprint_types}
                onChange={(e) => setConfig({ ...config, box_label_show_imprint_types: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                Imprint Types List (all decoration types from Work Order)
              </span>
            </label>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Label Preview</h3>
          <div className="flex justify-center">
            <div
              className="bg-white border-2 border-gray-300 rounded-lg shadow-lg"
              style={{ width: '3in', minHeight: '4in', padding: '0.25in' }}
            >
              <div className="flex flex-col items-center text-center gap-2">
                {selectedLogoUrl ? (
                  <img
                    src={selectedLogoUrl}
                    alt="Logo Preview"
                    className="h-12 w-auto object-contain mb-2"
                  />
                ) : (
                  <div className="h-12 w-24 bg-gray-100 rounded mb-2 flex items-center justify-center">
                    <span className="text-xs text-gray-400">Logo</span>
                  </div>
                )}

                {config.box_label_show_work_order_number && (
                  <div className="text-lg font-bold text-gray-900">WO-2024-0001</div>
                )}

                {config.box_label_show_customer_name && (
                  <div className="text-xl font-bold text-gray-900">Sample Customer</div>
                )}

                {config.box_label_show_job_nickname && (
                  <div className="text-base font-semibold text-gray-700">Spring Event Shirts</div>
                )}

                {config.box_label_show_due_date && (
                  <div className="text-sm text-gray-600">Due: Mar 15, 2024</div>
                )}

                {config.box_label_show_imprint_types && (
                  <div className="mt-2 text-sm text-gray-700">
                    <div className="font-semibold mb-1">Imprints:</div>
                    <div>Screen Printing</div>
                    <div>Embroidery</div>
                    <div>Heat Transfer</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
            Preview shows sample data. Actual labels will use Work Order data.
          </p>
        </div>

        {saveMessage && (
          <div className={`p-3 rounded-lg ${
            saveMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
          }`}>
            {saveMessage.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
