import { useState, useEffect, useRef } from 'react';
import { Save, Loader2, Tag, Image, GripVertical, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { BoxLabelElement, BoxLabelElementId, DEFAULT_BOX_LABEL_LAYOUT } from '../production/BoxLabel';

interface BoxLabelSettingsProps {
  companyId: string;
  primaryLogoUrl: string | null;
  secondaryLogoUrl: string | null;
}

interface LegacyConfig {
  box_label_logo_choice: 'primary' | 'secondary';
  box_label_show_work_order_number: boolean;
  box_label_show_customer_name: boolean;
  box_label_show_due_date: boolean;
  box_label_show_imprint_types: boolean;
  box_label_show_job_nickname: boolean;
}

const ELEMENT_LABELS: Record<BoxLabelElementId, string> = {
  logo: 'Company Logo',
  work_order_number: 'Work Order Number',
  customer_name: 'Customer Name',
  job_nickname: 'Job Nickname',
  due_date: 'Due Date',
  imprint_types: 'Imprint Types',
};

export default function BoxLabelSettings({ companyId, primaryLogoUrl, secondaryLogoUrl }: BoxLabelSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoChoice, setLogoChoice] = useState<'primary' | 'secondary'>('primary');
  const [layout, setLayout] = useState<BoxLabelElement[]>([...DEFAULT_BOX_LABEL_LAYOUT]);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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
          box_label_show_imprint_types,
          box_label_show_job_nickname,
          box_label_layout
        `)
        .eq('id', companyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLogoChoice(data.box_label_logo_choice || 'primary');

        if (data.box_label_layout && Array.isArray(data.box_label_layout) && data.box_label_layout.length > 0) {
          const savedLayout = (data.box_label_layout as BoxLabelElement[]).filter(
            el => el.id !== 'qr_code'
          );
          const merged = DEFAULT_BOX_LABEL_LAYOUT.map(def => {
            const saved = savedLayout.find(el => el.id === def.id);
            return saved ? { ...def, ...saved } : def;
          });
          merged.sort((a, b) => a.order - b.order);
          setLayout(merged);
        } else {
          const legacyLayout: BoxLabelElement[] = DEFAULT_BOX_LABEL_LAYOUT.map(el => {
            const legacy = data as unknown as LegacyConfig;
            let visible = true;
            if (el.id === 'work_order_number') visible = legacy.box_label_show_work_order_number ?? true;
            else if (el.id === 'customer_name') visible = legacy.box_label_show_customer_name ?? true;
            else if (el.id === 'job_nickname') visible = legacy.box_label_show_job_nickname ?? true;
            else if (el.id === 'due_date') visible = legacy.box_label_show_due_date ?? true;
            else if (el.id === 'imprint_types') visible = legacy.box_label_show_imprint_types ?? true;
            return { ...el, visible };
          });
          setLayout(legacyLayout);
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

  const handleResetDefaults = () => {
    setLayout([...DEFAULT_BOX_LABEL_LAYOUT]);
  };

  const updateElement = (id: BoxLabelElementId, changes: Partial<BoxLabelElement>) => {
    setLayout(prev => prev.map(el => el.id === id ? { ...el, ...changes } : el));
  };

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;

    const newLayout = [...layout];
    const [dragged] = newLayout.splice(dragItem.current, 1);
    newLayout.splice(dragOverItem.current, 0, dragged);
    setLayout(newLayout.map((el, idx) => ({ ...el, order: idx })));

    dragItem.current = null;
    dragOverItem.current = null;
  };

  const selectedLogoUrl = logoChoice === 'primary' ? primaryLogoUrl : secondaryLogoUrl;

  const previewScale = 0.62;

  const renderPreviewElement = (el: BoxLabelElement) => {
    if (!el.visible) return null;

    switch (el.id) {
      case 'logo': {
        const logoEl = layout.find(e => e.id === 'logo')!;
        return selectedLogoUrl ? (
          <div key="logo" style={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            marginBottom: `${0.1 * previewScale}in`,
          }}>
            <img
              src={selectedLogoUrl}
              alt="Logo"
              style={{
                width: `${(logoEl.width ?? 3.5) * previewScale}in`,
                height: `${(logoEl.height ?? 1.5) * previewScale}in`,
                objectFit: 'contain',
              }}
            />
          </div>
        ) : (
          <div
            key="logo"
            style={{
              width: `${(logoEl.width ?? 3.5) * previewScale}in`,
              height: `${(logoEl.height ?? 1.5) * previewScale}in`,
              background: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 4,
              margin: '0 auto',
              marginBottom: `${0.1 * previewScale}in`,
            }}
          >
            <span style={{ fontSize: '8pt', color: '#9ca3af' }}>Logo</span>
          </div>
        );
      }
      case 'work_order_number':
        return (
          <div key="work_order_number" style={{ fontSize: `${(el.fontSize ?? 22) * previewScale}pt`, fontWeight: 'bold', letterSpacing: '1px', textAlign: 'center', lineHeight: 1.2 }}>
            WO #2024-001
          </div>
        );
      case 'customer_name':
        return (
          <div key="customer_name" style={{ fontSize: `${(el.fontSize ?? 26) * previewScale}pt`, fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2 }}>
            Sample Customer
          </div>
        );
      case 'job_nickname':
        return (
          <div key="job_nickname" style={{ fontSize: `${(el.fontSize ?? 18) * previewScale}pt`, fontWeight: '600', textAlign: 'center', lineHeight: 1.2 }}>
            Spring Event Shirts
          </div>
        );
      case 'due_date':
        return (
          <div key="due_date" style={{ fontSize: `${(el.fontSize ?? 14) * previewScale}pt`, fontWeight: '500', color: '#374151', textAlign: 'center' }}>
            Due: Mar 15, 2025
          </div>
        );
      case 'imprint_types':
        return (
          <div key="imprint_types" style={{ fontSize: `${(el.fontSize ?? 12) * previewScale}pt`, textAlign: 'center', lineHeight: 1.4 }}>
            <div style={{ fontWeight: 'bold' }}>Imprints:</div>
            <div>Screen Printing</div>
            <div>Embroidery</div>
          </div>
        );
      default:
        return null;
    }
  };

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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <Image className="w-4 h-4" />
              Logo Selection
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Choose which company logo to display on box labels</p>

            <div className="grid grid-cols-2 gap-3">
              {(['primary', 'secondary'] as const).map(choice => {
                const url = choice === 'primary' ? primaryLogoUrl : secondaryLogoUrl;
                const selected = logoChoice === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setLogoChoice(choice)}
                    className={`relative p-3 rounded-lg border-2 transition-all ${
                      selected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {url ? (
                        <img src={url} alt={`${choice} Logo`} className="h-12 w-auto object-contain" />
                      ) : (
                        <div className="h-12 w-24 bg-gray-100 dark:bg-slate-700 rounded flex items-center justify-center">
                          <span className="text-xs text-gray-400">No logo</span>
                        </div>
                      )}
                      <span className={`text-xs font-medium capitalize ${selected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {choice} Logo
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

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Label Elements</h3>
              <button
                onClick={handleResetDefaults}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset defaults
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Drag to reorder. Toggle visibility and adjust size for each element.</p>

            <div className="space-y-2">
              {layout.map((el, index) => (
                <div
                  key={el.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className={`group flex flex-col gap-2 p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none ${
                    el.visible
                      ? 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 hover:border-gray-300 dark:hover:border-slate-500'
                      : 'border-dashed border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${el.visible ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                          {ELEMENT_LABELS[el.id]}
                        </span>
                        {!el.visible && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">hidden</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => updateElement(el.id, { visible: !el.visible })}
                      className={`p-1.5 rounded transition-colors ${
                        el.visible
                          ? 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                          : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400'
                      }`}
                      title={el.visible ? 'Hide element' : 'Show element'}
                    >
                      {el.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>

                  {el.visible && (
                    <div className="pl-7">
                      {el.id === 'logo' ? (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">W (in)</label>
                            <input
                              type="number"
                              min={0.5}
                              max={3.7}
                              step={0.1}
                              value={el.width ?? 3.5}
                              onChange={e => updateElement(el.id, { width: parseFloat(e.target.value) || 3.5 })}
                              className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">H (in)</label>
                            <input
                              type="number"
                              min={0.25}
                              max={3}
                              step={0.1}
                              value={el.height ?? 1.5}
                              onChange={e => updateElement(el.id, { height: parseFloat(e.target.value) || 1.5 })}
                              className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">Logo scales to fit within this area</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Size (pt)</label>
                            <input
                              type="number"
                              min={6}
                              max={72}
                              step={1}
                              value={el.fontSize ?? 14}
                              onChange={e => updateElement(el.id, { fontSize: parseInt(e.target.value) || 14 })}
                              className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            {[8, 12, 16, 20, 24, 32].map(size => (
                              <button
                                key={size}
                                onClick={() => updateElement(el.id, { fontSize: size })}
                                className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                                  el.fontSize === size
                                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-semibold'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-600'
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Live Preview</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Updates in real-time as you make changes above</p>

          <div className="flex justify-center">
            <div
              style={{
                width: `${4 * previewScale}in`,
                height: `${6 * previewScale}in`,
                border: '1px solid #374151',
                fontFamily: 'system-ui, sans-serif',
                display: 'flex',
                flexDirection: 'column',
                padding: `${0.15 * previewScale}in`,
                backgroundColor: 'white',
                color: 'black',
                boxSizing: 'border-box',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderRadius: 2,
              }}
            >
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: `${0.1 * previewScale}in`,
                flex: 1,
                justifyContent: 'center',
              }}>
                {layout.map(el => renderPreviewElement(el))}
              </div>
            </div>
          </div>

          <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-3">
            Preview shows sample data at ~62% scale. Actual labels will use Work Order data.
          </p>
        </div>
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
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}
