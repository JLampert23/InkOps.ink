import { useState, useEffect } from 'react';
import { Save, Loader2, Tag, Image } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { BoxLabelElement, DEFAULT_BOX_LABEL_LAYOUT } from '../production/BoxLabel';
import BoxLabelEditor from './BoxLabelEditor';

interface BoxLabelSettingsProps {
  companyId: string;
  primaryLogoUrl: string | null;
  secondaryLogoUrl: string | null;
}

function migrateOldLayout(oldLayout: BoxLabelElement[]): BoxLabelElement[] {
  const hasPositioning = oldLayout.some(el => el.x !== undefined && el.y !== undefined);
  if (hasPositioning) {
    return oldLayout;
  }

  let currentY = 0.15;
  return oldLayout.map((el, idx) => {
    const defaultEl = DEFAULT_BOX_LABEL_LAYOUT.find(d => d.id === el.id);
    let y = currentY;

    if (el.id === 'logo') {
      y = 0.15;
      currentY = y + (el.height ?? 0.8) + 0.15;
    } else {
      const estimatedHeight = ((el.fontSize ?? 14) / 72) * 1.5;
      currentY += estimatedHeight + 0.15;
    }

    return {
      ...el,
      x: el.x ?? defaultEl?.x ?? 0.15,
      y: el.y ?? y,
      textAlign: el.textAlign ?? defaultEl?.textAlign ?? 'center',
      fontWeight: el.fontWeight ?? defaultEl?.fontWeight,
    };
  });
}

export default function BoxLabelSettings({ companyId, primaryLogoUrl, secondaryLogoUrl }: BoxLabelSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoChoice, setLogoChoice] = useState<'primary' | 'secondary'>('primary');
  const [layout, setLayout] = useState<BoxLabelElement[]>([...DEFAULT_BOX_LABEL_LAYOUT]);
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
          box_label_layout
        `)
        .eq('id', companyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLogoChoice(data.box_label_logo_choice || 'primary');

        if (data.box_label_layout && Array.isArray(data.box_label_layout) && data.box_label_layout.length > 0) {
          const savedLayout = data.box_label_layout as BoxLabelElement[];
          const migratedLayout = migrateOldLayout(savedLayout);

          const knownIds = new Set(DEFAULT_BOX_LABEL_LAYOUT.map(d => d.id));
          const merged: BoxLabelElement[] = [];

          DEFAULT_BOX_LABEL_LAYOUT.forEach(def => {
            const saved = migratedLayout.find(el => el.id === def.id);
            merged.push(saved ? { ...def, ...saved } : { ...def });
          });

          migratedLayout.forEach(el => {
            if (!knownIds.has(el.id as string) && el.id.startsWith('custom_text')) {
              merged.push(el);
            }
          });

          merged.sort((a, b) => a.order - b.order);
          setLayout(merged);
        } else {
          setLayout([...DEFAULT_BOX_LABEL_LAYOUT]);
        }
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

      const layoutWithOrder = layout.map((el, idx) => ({ ...el, order: idx }));

      const { error } = await supabase
        .from('company_settings')
        .update({
          box_label_logo_choice: logoChoice,
          box_label_show_work_order_number: layoutWithOrder.find(el => el.id === 'work_order_number')?.visible ?? true,
          box_label_show_customer_name: layoutWithOrder.find(el => el.id === 'customer_name')?.visible ?? true,
          box_label_show_due_date: layoutWithOrder.find(el => el.id === 'due_date')?.visible ?? true,
          box_label_show_imprint_types: layoutWithOrder.find(el => el.id === 'imprint_types')?.visible ?? true,
          box_label_show_job_nickname: layoutWithOrder.find(el => el.id === 'job_nickname')?.visible ?? true,
          box_label_layout: layoutWithOrder,
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

  const selectedLogoUrl = logoChoice === 'primary' ? primaryLogoUrl : secondaryLogoUrl;

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
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Drag elements directly on the preview to position them. Click to select and adjust properties.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Image className="w-4 h-4" />
          Logo Selection
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Choose which company logo to display</p>

        <div className="flex gap-3">
          {(['primary', 'secondary'] as const).map(choice => {
            const url = choice === 'primary' ? primaryLogoUrl : secondaryLogoUrl;
            const selected = logoChoice === choice;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => setLogoChoice(choice)}
                className={`relative p-3 rounded-lg border-2 transition-all flex-1 max-w-[200px] ${
                  selected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  {url ? (
                    <img src={url} alt={`${choice} Logo`} className="h-10 w-auto object-contain" />
                  ) : (
                    <div className="h-10 w-20 bg-gray-100 dark:bg-slate-700 rounded flex items-center justify-center">
                      <span className="text-xs text-gray-400">No logo</span>
                    </div>
                  )}
                  <span className={`text-xs font-medium capitalize ${selected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {choice}
                  </span>
                </div>
                {selected && (
                  <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <BoxLabelEditor
        layout={layout}
        logoUrl={selectedLogoUrl}
        onLayoutChange={setLayout}
      />

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
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}
