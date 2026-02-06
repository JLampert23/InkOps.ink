import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';
import { Save, AlertCircle, CheckCircle2, Package, Clipboard, ScanBarcode, FileText, Truck, Bell } from 'lucide-react';

interface ReceivingSettings {
  id?: string;
  company_id?: string;
  allow_partial_receiving: boolean;
  allow_over_receiving: boolean;
  require_vendor_confirmation: boolean;
  auto_close_po_when_fully_received: boolean;
  auto_mark_jobs_ready: boolean;
  require_manual_review_for_job_ready: boolean;
  notify_production_when_job_ready: boolean;
  require_reason_for_shortages: boolean;
  require_reason_for_damaged_items: boolean;
  variance_threshold_percentage: number;
  auto_flag_vendor_on_variance: boolean;
  variance_approval_required: boolean;
  enable_barcode_scanning: boolean;
  scan_mode: 'increment' | 'replace' | 'prompt';
  allow_scanning_non_po_items: boolean;
  track_receiving_user: boolean;
  track_receiving_timestamp: boolean;
  require_notes_on_receiving: boolean;
  auto_generate_receiving_report_pdf: boolean;
  default_vendor_lead_times: Record<string, number>;
  default_backorder_rule: 'auto_split' | 'hold' | 'auto_cancel';
  enable_vendor_delay_alerts: boolean;
  notify_accounting_on_receive: boolean;
  notify_production_on_receive: boolean;
  notify_sales_on_job_ready: boolean;
  daily_receiving_summary_email: boolean;
}

const defaultSettings: Omit<ReceivingSettings, 'id' | 'company_id'> = {
  allow_partial_receiving: true,
  allow_over_receiving: false,
  require_vendor_confirmation: false,
  auto_close_po_when_fully_received: true,
  auto_mark_jobs_ready: true,
  require_manual_review_for_job_ready: false,
  notify_production_when_job_ready: true,
  require_reason_for_shortages: true,
  require_reason_for_damaged_items: true,
  variance_threshold_percentage: 5.00,
  auto_flag_vendor_on_variance: true,
  variance_approval_required: false,
  enable_barcode_scanning: false,
  scan_mode: 'increment',
  allow_scanning_non_po_items: false,
  track_receiving_user: true,
  track_receiving_timestamp: true,
  require_notes_on_receiving: false,
  auto_generate_receiving_report_pdf: false,
  default_vendor_lead_times: {},
  default_backorder_rule: 'hold',
  enable_vendor_delay_alerts: true,
  notify_accounting_on_receive: true,
  notify_production_on_receive: true,
  notify_sales_on_job_ready: false,
  daily_receiving_summary_email: false,
};

export default function ReceivingSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ReceivingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) {
        setMessage({ type: 'error', text: 'Company not found' });
        return;
      }

      setCompanyId(profile.company_id);

      const { data, error } = await supabase
        .from('receiving_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      } else {
        setSettings({ ...defaultSettings, company_id: profile.company_id });
      }
    } catch (error) {
      console.error('Error loading receiving settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!companyId) return;

    try {
      setSaving(true);
      setMessage(null);

      const settingsToSave = {
        ...settings,
        company_id: companyId,
      };

      const { error } = settings.id
        ? await supabase
            .from('receiving_settings')
            .update(settingsToSave)
            .eq('id', settings.id)
        : await supabase
            .from('receiving_settings')
            .insert([settingsToSave])
            .select()
            .single();

      if (error) throw error;

      setMessage({ type: 'success', text: 'Settings saved successfully' });
      await loadSettings();
    } catch (error) {
      console.error('Error saving receiving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ReceivingSettings>(key: K, value: ReceivingSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Section 1: Receiving Behavior */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Receiving Behavior</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <ToggleSetting
            label="Allow Partial Receiving"
            description="Users can receive partial quantities from a PO"
            checked={settings.allow_partial_receiving}
            onChange={(checked) => updateSetting('allow_partial_receiving', checked)}
          />
          <ToggleSetting
            label="Allow Over-Receiving"
            description="Users can receive more than the ordered quantity"
            checked={settings.allow_over_receiving}
            onChange={(checked) => updateSetting('allow_over_receiving', checked)}
          />
          <ToggleSetting
            label="Require Vendor Confirmation Before Receiving"
            description="PO must be in 'Vendor Confirmed' status before receiving can begin"
            checked={settings.require_vendor_confirmation}
            onChange={(checked) => updateSetting('require_vendor_confirmation', checked)}
          />
          <ToggleSetting
            label="Auto-Close PO When Fully Received"
            description="PO automatically moves to 'Closed' when all items are received"
            checked={settings.auto_close_po_when_fully_received}
            onChange={(checked) => updateSetting('auto_close_po_when_fully_received', checked)}
          />
        </div>
      </div>

      {/* Section 2: Job Readiness Rules */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Clipboard className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Job Readiness Rules</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <ToggleSetting
            label="Auto-Mark Jobs as Ready for Production"
            description="When all garments for a job are received, job status updates automatically"
            checked={settings.auto_mark_jobs_ready}
            onChange={(checked) => updateSetting('auto_mark_jobs_ready', checked)}
          />
          <ToggleSetting
            label="Require Manual Review Before Job Becomes Ready"
            description="Job readiness requires human approval"
            checked={settings.require_manual_review_for_job_ready}
            onChange={(checked) => updateSetting('require_manual_review_for_job_ready', checked)}
          />
          <ToggleSetting
            label="Notify Production Team When Job Becomes Ready"
            description="Sends internal notification to production team"
            checked={settings.notify_production_when_job_ready}
            onChange={(checked) => updateSetting('notify_production_when_job_ready', checked)}
          />
        </div>
      </div>

      {/* Section 3: Variance Handling */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">Variance Handling</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <ToggleSetting
            label="Require Reason for Shortages"
            description="Users must provide a reason when receiving less than ordered"
            checked={settings.require_reason_for_shortages}
            onChange={(checked) => updateSetting('require_reason_for_shortages', checked)}
          />
          <ToggleSetting
            label="Require Reason for Damaged Items"
            description="Users must provide a reason when marking items as damaged"
            checked={settings.require_reason_for_damaged_items}
            onChange={(checked) => updateSetting('require_reason_for_damaged_items', checked)}
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Variance Threshold Percentage
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={settings.variance_threshold_percentage}
                onChange={(e) => updateSetting('variance_threshold_percentage', parseFloat(e.target.value) || 0)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-sm text-gray-500">
              Vendor is flagged for review when variances exceed this percentage
            </p>
          </div>
          <ToggleSetting
            label="Auto-Flag Vendor When Variances Exceed Threshold"
            description="Vendor is automatically flagged for review"
            checked={settings.auto_flag_vendor_on_variance}
            onChange={(checked) => updateSetting('auto_flag_vendor_on_variance', checked)}
          />
          <ToggleSetting
            label="Variance Approval Required"
            description="Requires manager approval for discrepancies"
            checked={settings.variance_approval_required}
            onChange={(checked) => updateSetting('variance_approval_required', checked)}
          />
        </div>
      </div>

      {/* Section 4: Barcode/Scanning Settings */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <ScanBarcode className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Barcode / Scanning Settings</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <ToggleSetting
            label="Enable Barcode Scanning"
            description="Allow users to scan barcodes during receiving"
            checked={settings.enable_barcode_scanning}
            onChange={(checked) => updateSetting('enable_barcode_scanning', checked)}
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Scan Mode</label>
            <select
              value={settings.scan_mode}
              onChange={(e) => updateSetting('scan_mode', e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="increment">Increment Quantity</option>
              <option value="replace">Replace Quantity</option>
              <option value="prompt">Prompt for Quantity</option>
            </select>
            <p className="text-sm text-gray-500">How scanning affects received quantities</p>
          </div>
          <ToggleSetting
            label="Allow Scanning of Non-PO Items"
            description="Users can scan items not on the current PO"
            checked={settings.allow_scanning_non_po_items}
            onChange={(checked) => updateSetting('allow_scanning_non_po_items', checked)}
          />
        </div>
      </div>

      {/* Section 5: Receiving Log Settings */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-semibold text-gray-900">Receiving Log Settings</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <ToggleSetting
            label="Track User Who Received Items"
            description="Record which user performed each receiving session"
            checked={settings.track_receiving_user}
            onChange={(checked) => updateSetting('track_receiving_user', checked)}
          />
          <ToggleSetting
            label="Track Receiving Timestamp"
            description="Record exact date and time of receiving"
            checked={settings.track_receiving_timestamp}
            onChange={(checked) => updateSetting('track_receiving_timestamp', checked)}
          />
          <ToggleSetting
            label="Require Notes on Every Receiving Session"
            description="Users must add notes before completing receiving"
            checked={settings.require_notes_on_receiving}
            onChange={(checked) => updateSetting('require_notes_on_receiving', checked)}
          />
          <ToggleSetting
            label="Auto-Generate Receiving Report PDF"
            description="Automatically create PDF report after each receiving session"
            checked={settings.auto_generate_receiving_report_pdf}
            onChange={(checked) => updateSetting('auto_generate_receiving_report_pdf', checked)}
          />
        </div>
      </div>

      {/* Section 6: Vendor Settings */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Vendor Settings (Receiving-Specific)</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Default Backorder Rules</label>
            <select
              value={settings.default_backorder_rule}
              onChange={(e) => updateSetting('default_backorder_rule', e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="auto_split">Auto-split PO</option>
              <option value="hold">Hold PO until complete</option>
              <option value="auto_cancel">Auto-cancel backordered items</option>
            </select>
            <p className="text-sm text-gray-500">How to handle backordered items</p>
          </div>
          <ToggleSetting
            label="Vendor Delay Alerts"
            description="Notify when vendor delivery is delayed beyond expected date"
            checked={settings.enable_vendor_delay_alerts}
            onChange={(checked) => updateSetting('enable_vendor_delay_alerts', checked)}
          />
        </div>
      </div>

      {/* Section 7: Notifications */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <ToggleSetting
            label="Notify Accounting When Goods Are Received"
            description="Send notification to accounting team after receiving"
            checked={settings.notify_accounting_on_receive}
            onChange={(checked) => updateSetting('notify_accounting_on_receive', checked)}
          />
          <ToggleSetting
            label="Notify Production When Items Arrive"
            description="Send notification to production team after receiving"
            checked={settings.notify_production_on_receive}
            onChange={(checked) => updateSetting('notify_production_on_receive', checked)}
          />
          <ToggleSetting
            label="Notify Sales Rep When Job Becomes Ready"
            description="Send notification to sales rep when job is ready for production"
            checked={settings.notify_sales_on_job_ready}
            onChange={(checked) => updateSetting('notify_sales_on_job_ready', checked)}
          />
          <ToggleSetting
            label="Daily Receiving Summary Email"
            description="Send daily summary of all receiving activity"
            checked={settings.daily_receiving_summary_email}
            onChange={(checked) => updateSetting('daily_receiving_summary_email', checked)}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSetting({ label, description, checked, onChange }: ToggleSettingProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-900">{label}</label>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
