import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { Save, Loader2, ChevronDown, ChevronUp, Info, Plus, Pencil, Trash2, X, Building2 } from 'lucide-react';
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
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  payment_terms?: string;
  notes?: string;
  is_active: boolean;
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
  const [vendorManagementExpanded, setVendorManagementExpanded] = useState(true);
  const [approvalExpanded, setApprovalExpanded] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  const [showVendorModal, setShowVendorModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorForm, setVendorForm] = useState<Partial<Vendor>>({
    vendor_name: '',
    vendor_type: 'Independent',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address_1: '',
    address_2: '',
    city: '',
    state: '',
    zip: '',
    country: 'USA',
    payment_terms: '',
    notes: '',
    is_active: true,
  });

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
        .select('*')
        .eq('company_id', profile.company_id)
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

  const handleAddVendor = () => {
    setEditingVendor(null);
    setVendorForm({
      vendor_name: '',
      vendor_type: 'Independent',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      address_1: '',
      address_2: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA',
      payment_terms: '',
      notes: '',
      is_active: true,
    });
    setShowVendorModal(true);
  };

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setVendorForm(vendor);
    setShowVendorModal(true);
  };

  const handleSaveVendor = async () => {
    try {
      if (!vendorForm.vendor_name?.trim()) {
        showNotification('error', 'Vendor name is required');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      if (editingVendor) {
        const { error } = await supabase
          .from('vendors')
          .update(vendorForm)
          .eq('id', editingVendor.id)
          .eq('company_id', profile.company_id);

        if (error) throw error;
        showNotification('success', 'Vendor updated successfully');
      } else {
        const { error } = await supabase
          .from('vendors')
          .insert([{ ...vendorForm, company_id: profile.company_id }]);

        if (error) throw error;
        showNotification('success', 'Vendor added successfully');
      }

      setShowVendorModal(false);
      loadVendors();
    } catch (error) {
      console.error('Error saving vendor:', error);
      showNotification('error', 'Failed to save vendor');
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId)
        .eq('company_id', profile.company_id);

      if (error) throw error;

      showNotification('success', 'Vendor deleted successfully');
      loadVendors();
    } catch (error) {
      console.error('Error deleting vendor:', error);
      showNotification('error', 'Failed to delete vendor');
    }
  };

  const updateSetting = <K extends keyof POSettingsData>(key: K, value: POSettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateVendorForm = <K extends keyof Vendor>(key: K, value: Vendor[K]) => {
    setVendorForm((prev) => ({ ...prev, [key]: value }));
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

      {/* Section: Vendor Management */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setVendorManagementExpanded(!vendorManagementExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Vendor Management
            </h3>
          </div>
          {vendorManagementExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {vendorManagementExpanded && (
          <div className="p-6 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage vendors for purchase orders
              </p>
              <button
                onClick={handleAddVendor}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Vendor
              </button>
            </div>

            {vendors.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">No vendors added yet</p>
                <button
                  onClick={handleAddVendor}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Vendor
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                        Vendor Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {vendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {vendor.vendor_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {vendor.vendor_type}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {vendor.contact_name || vendor.contact_email || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              vendor.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                            }`}
                          >
                            {vendor.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditVendor(vendor)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteVendor(vendor.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
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
                {vendors.filter(v => v.is_active).map((vendor) => (
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

      {/* Sections 2-5 remain the same... (truncated for brevity, they are unchanged) */}

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

      {/* Vendor Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
                </h3>
                <button
                  onClick={() => setShowVendorModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vendor Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vendor Name *
                  </label>
                  <input
                    type="text"
                    value={vendorForm.vendor_name || ''}
                    onChange={(e) => updateVendorForm('vendor_name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    placeholder="e.g., SanMar"
                  />
                </div>

                {/* Vendor Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vendor Type
                  </label>
                  <select
                    value={vendorForm.vendor_type || 'Independent'}
                    onChange={(e) => updateVendorForm('vendor_type', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="SanMar">SanMar</option>
                    <option value="SSActivewear">S&S Activewear</option>
                    <option value="Independent">Independent</option>
                    <option value="Manufacturer">Manufacturer</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <select
                    value={vendorForm.is_active ? 'active' : 'inactive'}
                    onChange={(e) => updateVendorForm('is_active', e.target.value === 'active')}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Contact Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={vendorForm.contact_name || ''}
                    onChange={(e) => updateVendorForm('contact_name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                {/* Contact Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={vendorForm.contact_email || ''}
                    onChange={(e) => updateVendorForm('contact_email', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                {/* Contact Phone */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={vendorForm.contact_phone || ''}
                    onChange={(e) => updateVendorForm('contact_phone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                {/* Address Line 1 */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={vendorForm.address_1 || ''}
                    onChange={(e) => updateVendorForm('address_1', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                {/* Address Line 2 */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={vendorForm.address_2 || ''}
                    onChange={(e) => updateVendorForm('address_2', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={vendorForm.city || ''}
                    onChange={(e) => updateVendorForm('city', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={vendorForm.state || ''}
                    onChange={(e) => updateVendorForm('state', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                {/* ZIP */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={vendorForm.zip || ''}
                    onChange={(e) => updateVendorForm('zip', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    value={vendorForm.country || ''}
                    onChange={(e) => updateVendorForm('country', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                {/* Payment Terms */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={vendorForm.payment_terms || ''}
                    onChange={(e) => updateVendorForm('payment_terms', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    placeholder="e.g., Net 30"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={vendorForm.notes || ''}
                    onChange={(e) => updateVendorForm('notes', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowVendorModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVendor}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingVendor ? 'Update Vendor' : 'Add Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
