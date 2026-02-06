import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { Save, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';

interface POSettingsData {
  po_number_format: string;
  po_starting_sequence: number;
  po_default_vendor_id: string | null;
  po_default_notes: string | null;
  po_require_approval_before_sending: boolean;
  po_allow_editing_after_sending: boolean;
  po_require_reason_for_edits: boolean;
  po_default_email_template_id: string | null;
  po_auto_attach_pdf: boolean;
  po_cc_accounting: boolean;
  po_cc_sales_rep: boolean;
  po_vendor_confirmation_required: boolean;
  po_require_pdf_before_sending: boolean;
  po_allow_additional_attachments: boolean;
  po_default_footer: string | null;
  po_auto_group_by_vendor: boolean;
  po_auto_split_by_vendor: boolean;
  po_allow_without_linked_jobs: boolean;
  po_allow_deleting_drafts: boolean;
}

interface Vendor {
  id: string;
  vendor_name: string;
  vendor_type: string;
}

interface EmailTemplate {
  id: string;
  template_name: string;
  template_type: string;
}

export default function POSettings() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<POSettingsData>({
    po_number_format: 'PO-{YYYY}-{SEQ}',
    po_starting_sequence: 1000,
    po_default_vendor_id: null,
    po_default_notes: null,
    po_require_approval_before_sending: false,
    po_allow_editing_after_sending: true,
    po_require_reason_for_edits: false,
    po_default_email_template_id: null,
    po_auto_attach_pdf: true,
    po_cc_accounting: false,
    po_cc_sales_rep: false,
    po_vendor_confirmation_required: false,
    po_require_pdf_before_sending: false,
    po_allow_additional_attachments: true,
    po_default_footer: null,
    po_auto_group_by_vendor: false,
    po_auto_split_by_vendor: false,
    po_allow_without_linked_jobs: true,
    po_allow_deleting_drafts: true,
  });

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);

  const [numberingExpanded, setNumberingExpanded] = useState(true);
  const [approvalExpanded, setApprovalExpanded] = useState(true);
  const [emailExpanded, setEmailExpanded] = useState(true);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(true);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  useEffect(() => {
    loadSettings();
    loadVendors();
    loadEmailTemplates();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          po_number_format: data.po_number_format || 'PO-{YYYY}-{SEQ}',
          po_starting_sequence: data.po_starting_sequence || 1000,
          po_default_vendor_id: data.po_default_vendor_id,
          po_default_notes: data.po_default_notes,
          po_require_approval_before_sending: data.po_require_approval_before_sending || false,
          po_allow_editing_after_sending: data.po_allow_editing_after_sending !== false,
          po_require_reason_for_edits: data.po_require_reason_for_edits || false,
          po_default_email_template_id: data.po_default_email_template_id,
          po_auto_attach_pdf: data.po_auto_attach_pdf !== false,
          po_cc_accounting: data.po_cc_accounting || false,
          po_cc_sales_rep: data.po_cc_sales_rep || false,
          po_vendor_confirmation_required: data.po_vendor_confirmation_required || false,
          po_require_pdf_before_sending: data.po_require_pdf_before_sending || false,
          po_allow_additional_attachments: data.po_allow_additional_attachments !== false,
          po_default_footer: data.po_default_footer,
          po_auto_group_by_vendor: data.po_auto_group_by_vendor || false,
          po_auto_split_by_vendor: data.po_auto_split_by_vendor || false,
          po_allow_without_linked_jobs: data.po_allow_without_linked_jobs !== false,
          po_allow_deleting_drafts: data.po_allow_deleting_drafts !== false,
        });
      }
    } catch (error) {
      console.error('Error loading PO settings:', error);
      showNotification('error', 'Failed to load PO settings');
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from('vendors')
        .select('id, vendor_name, vendor_type')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('vendor_name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadEmailTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from('communication_templates')
        .select('id, template_name, template_type')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('template_name');

      if (error) throw error;
      setEmailTemplates(data || []);
    } catch (error) {
      console.error('Error loading email templates:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      const { error } = await supabase
        .from('company_settings')
        .update(settings)
        .eq('id', profile.company_id);

      if (error) throw error;

      showNotification('success', 'PO settings saved successfully');
    } catch (error) {
      console.error('Error saving PO settings:', error);
      showNotification('error', 'Failed to save PO settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof POSettingsData>(key: K, value: POSettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Order Settings</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure global PO behavior, numbering, and approval rules
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>

      {/* Section 1: PO Numbering & Defaults */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setNumberingExpanded(!numberingExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            PO Numbering & Defaults
          </h3>
          {numberingExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {numberingExpanded && (
          <div className="p-6 border-t border-gray-200 dark:border-slate-700 space-y-6">
            {/* PO Number Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                PO Number Format
              </label>
              <input
                type="text"
                value={settings.po_number_format}
                onChange={(e) => updateSetting('po_number_format', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                placeholder="PO-{YYYY}-{SEQ}"
              />
              <div className="mt-2 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Available tokens:</p>
                  <p><span className="font-mono bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{'{PO}'}</span> - PO prefix</p>
                  <p><span className="font-mono bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{'{YYYY}'}</span> - 4-digit year</p>
                  <p><span className="font-mono bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{'{MM}'}</span> - 2-digit month</p>
                  <p><span className="font-mono bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{'{DD}'}</span> - 2-digit day</p>
                  <p><span className="font-mono bg-gray-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{'{SEQ}'}</span> - Sequential number</p>
                </div>
              </div>
            </div>

            {/* Starting Sequence Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Starting Sequence Number
              </label>
              <input
                type="number"
                value={settings.po_starting_sequence}
                onChange={(e) => updateSetting('po_starting_sequence', parseInt(e.target.value) || 1000)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                min="1"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Used for the {'{SEQ}'} token in PO numbers
              </p>
            </div>

            {/* Default Vendor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Vendor
              </label>
              <select
                value={settings.po_default_vendor_id || ''}
                onChange={(e) => updateSetting('po_default_vendor_id', e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              >
                <option value="">No default vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.vendor_name} ({vendor.vendor_type})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Pre-selected when creating new POs
              </p>
            </div>

            {/* Default PO Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default PO Notes
              </label>
              <textarea
                value={settings.po_default_notes || ''}
                onChange={(e) => updateSetting('po_default_notes', e.target.value || null)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                placeholder="These notes will appear on all new POs..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Appears on all new POs unless overridden
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: PO Approval Rules */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setApprovalExpanded(!approvalExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            PO Approval Rules
          </h3>
          {approvalExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {approvalExpanded && (
          <div className="p-6 border-t border-gray-200 dark:border-slate-700 space-y-6">
            {/* Require Approval */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Require PO Approval Before Sending
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  PO must be approved by a manager before "Send PO" is enabled
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('po_require_approval_before_sending', !settings.po_require_approval_before_sending)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_require_approval_before_sending
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_require_approval_before_sending ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Allow Editing After Sending */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Allow Editing PO After Sending
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  If disabled, PO becomes locked after sending
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('po_allow_editing_after_sending', !settings.po_allow_editing_after_sending)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_allow_editing_after_sending
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_allow_editing_after_sending ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Require Reason for Edits */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Require Reason for PO Edits After Approval
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Editing triggers a modal requiring justification
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('po_require_reason_for_edits', !settings.po_require_reason_for_edits)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_require_reason_for_edits
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_require_reason_for_edits ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: PO Email & Communication */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setEmailExpanded(!emailExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            PO Email & Communication
          </h3>
          {emailExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {emailExpanded && (
          <div className="p-6 border-t border-gray-200 dark:border-slate-700 space-y-6">
            {/* Default Email Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default PO Email Template
              </label>
              <select
                value={settings.po_default_email_template_id || ''}
                onChange={(e) => updateSetting('po_default_email_template_id', e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              >
                <option value="">No default template</option>
                {emailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.template_name} ({template.template_type})
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-Attach PDF */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-Attach PO PDF When Sending
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Automatically includes PO PDF in vendor emails
                </p>
              </div>
              <button
                onClick={() => updateSetting('po_auto_attach_pdf', !settings.po_auto_attach_pdf)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_auto_attach_pdf ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_auto_attach_pdf ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* CC Accounting */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  CC Accounting on All POs
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Automatically CC accounting team when sending POs
                </p>
              </div>
              <button
                onClick={() => updateSetting('po_cc_accounting', !settings.po_cc_accounting)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_cc_accounting ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_cc_accounting ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* CC Sales Rep */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  CC Sales Rep on All POs
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Automatically CC sales rep when sending POs
                </p>
              </div>
              <button
                onClick={() => updateSetting('po_cc_sales_rep', !settings.po_cc_sales_rep)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_cc_sales_rep ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_cc_sales_rep ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Vendor Confirmation Required */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Vendor Confirmation Required
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  PO must be marked "Vendor Confirmed" before receiving can begin
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('po_vendor_confirmation_required', !settings.po_vendor_confirmation_required)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_vendor_confirmation_required
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_vendor_confirmation_required ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Attachments & Documents */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Attachments & Documents
          </h3>
          {attachmentsExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {attachmentsExpanded && (
          <div className="p-6 border-t border-gray-200 dark:border-slate-700 space-y-6">
            {/* Require PDF Before Sending */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Require PO PDF Before Sending
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  PO cannot be sent without an attached PDF
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('po_require_pdf_before_sending', !settings.po_require_pdf_before_sending)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_require_pdf_before_sending
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_require_pdf_before_sending ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Allow Additional Attachments */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Allow Additional Attachments
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enable uploading artwork, spec sheets, and other files
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('po_allow_additional_attachments', !settings.po_allow_additional_attachments)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_allow_additional_attachments
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_allow_additional_attachments ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Default PO Footer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default PO Footer
              </label>
              <textarea
                value={settings.po_default_footer || ''}
                onChange={(e) => updateSetting('po_default_footer', e.target.value || null)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                placeholder="Thank you for your business..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Appears at the bottom of all PO PDFs
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section 5: Advanced Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setAdvancedExpanded(!advancedExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Advanced Settings
          </h3>
          {advancedExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {advancedExpanded && (
          <div className="p-6 border-t border-gray-200 dark:border-slate-700 space-y-6">
            {/* Auto-Group by Vendor */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-Group Garments by Vendor When Creating POs
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Automatically organize items by vendor in PO creation
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('po_auto_group_by_vendor', !settings.po_auto_group_by_vendor)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_auto_group_by_vendor ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_auto_group_by_vendor ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Auto-Split by Vendor */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-Split POs by Vendor
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Create separate POs for each vendor automatically
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('po_auto_split_by_vendor', !settings.po_auto_split_by_vendor)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_auto_split_by_vendor ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_auto_split_by_vendor ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Allow Without Linked Jobs */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Allow Creating POs Without Linked Jobs
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enable creating standalone POs not tied to specific orders
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('po_allow_without_linked_jobs', !settings.po_allow_without_linked_jobs)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_allow_without_linked_jobs
                    ? 'bg-blue-600'
                    : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_allow_without_linked_jobs ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Allow Deleting Drafts */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Allow Deleting Draft POs
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Users can delete POs that are still in draft status
                </p>
              </div>
              <button
                onClick={() =>
                  updateSetting('po_allow_deleting_drafts', !settings.po_allow_deleting_drafts)
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.po_allow_deleting_drafts ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.po_allow_deleting_drafts ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}
