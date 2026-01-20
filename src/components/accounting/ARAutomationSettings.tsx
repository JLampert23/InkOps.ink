import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Loader2, Mail, Clock, Users, FileText, FileSpreadsheet, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format } from 'date-fns';
import { AR_COLUMNS, getDefaultARColumns } from '../../utils/ar-export';

interface ARAutomationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Automation {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time_of_day: string;
  day_of_week?: number;
  day_of_month?: number;
  recipients: string[];
  format: 'pdf' | 'csv';
  filters: any;
  columns: string[];
  enabled: boolean;
  created_at: string;
}

interface AutomationLog {
  id: string;
  executed_at: string;
  success: boolean;
  error_message?: string;
  invoice_count: number;
  total_outstanding: number;
  recipients: string[];
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ARAutomationSettings({ isOpen, onClose }: ARAutomationSettingsProps) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'automations' | 'logs'>('automations');

  const [editingAutomation, setEditingAutomation] = useState<Partial<Automation> | null>(null);
  const [newRecipient, setNewRecipient] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAutomations();
      loadLogs();
    }
  }, [isOpen]);

  const loadAutomations = async () => {
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('id')
        .maybeSingle();

      if (!settings) return;

      const { data, error } = await supabase
        .from('ar_report_automations')
        .select('*')
        .eq('company_id', settings.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAutomations(data || []);
    } catch (error) {
      console.error('Error loading automations:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('id')
        .maybeSingle();

      if (!settings) return;

      const { data, error } = await supabase
        .from('ar_report_logs')
        .select('*')
        .eq('company_id', settings.id)
        .order('executed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const handleCreateNew = () => {
    setEditingAutomation({
      name: '',
      frequency: 'weekly',
      time_of_day: '09:00:00',
      day_of_week: 1,
      recipients: [],
      format: 'pdf',
      filters: {},
      columns: getDefaultARColumns(),
      enabled: true,
    });
  };

  const handleSaveAutomation = async () => {
    if (!editingAutomation || !editingAutomation.name?.trim()) {
      alert('Please enter an automation name');
      return;
    }

    if (!editingAutomation.recipients || editingAutomation.recipients.length === 0) {
      alert('Please add at least one recipient');
      return;
    }

    setSaving(true);
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('id')
        .maybeSingle();

      if (!settings) throw new Error('Company settings not found');

      const automationData = {
        company_id: settings.id,
        name: editingAutomation.name,
        frequency: editingAutomation.frequency,
        time_of_day: editingAutomation.time_of_day,
        day_of_week: editingAutomation.day_of_week,
        day_of_month: editingAutomation.day_of_month,
        recipients: editingAutomation.recipients,
        format: editingAutomation.format,
        filters: editingAutomation.filters || {},
        columns: editingAutomation.columns || getDefaultARColumns(),
        enabled: editingAutomation.enabled,
      };

      if (editingAutomation.id) {
        const { error } = await supabase
          .from('ar_report_automations')
          .update(automationData)
          .eq('id', editingAutomation.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ar_report_automations')
          .insert([automationData]);

        if (error) throw error;
      }

      setEditingAutomation(null);
      await loadAutomations();
    } catch (error) {
      console.error('Error saving automation:', error);
      alert('Failed to save automation');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;

    try {
      const { error } = await supabase
        .from('ar_report_automations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadAutomations();
    } catch (error) {
      console.error('Error deleting automation:', error);
      alert('Failed to delete automation');
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('ar_report_automations')
        .update({ enabled: !enabled })
        .eq('id', id);

      if (error) throw error;
      await loadAutomations();
    } catch (error) {
      console.error('Error toggling automation:', error);
    }
  };

  const handleAddRecipient = () => {
    if (!newRecipient.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newRecipient)) {
      alert('Please enter a valid email address');
      return;
    }

    if (editingAutomation) {
      setEditingAutomation({
        ...editingAutomation,
        recipients: [...(editingAutomation.recipients || []), newRecipient],
      });
      setNewRecipient('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    if (editingAutomation) {
      setEditingAutomation({
        ...editingAutomation,
        recipients: (editingAutomation.recipients || []).filter(r => r !== email),
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">AR Report Automation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('automations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'automations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Automations
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Execution Logs
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'automations' && (
            <div className="space-y-6">
              {!editingAutomation ? (
                <>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      Configure automated AR reports to be sent via email on a schedule
                    </p>
                    <button
                      onClick={handleCreateNew}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      New Automation
                    </button>
                  </div>

                  <div className="space-y-3">
                    {automations.map(automation => (
                      <div
                        key={automation.id}
                        className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-base font-semibold text-gray-900">
                              {automation.name}
                            </h3>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                automation.enabled
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {automation.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {automation.frequency === 'daily' && 'Daily'}
                              {automation.frequency === 'weekly' && `Weekly on ${DAYS_OF_WEEK[automation.day_of_week || 0]}`}
                              {automation.frequency === 'monthly' && `Monthly on day ${automation.day_of_month}`}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {automation.time_of_day}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {automation.recipients.length} recipient(s)
                            </span>
                            {automation.format === 'pdf' ? (
                              <FileText className="w-4 h-4" />
                            ) : (
                              <FileSpreadsheet className="w-4 h-4" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleEnabled(automation.id, automation.enabled)}
                            className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-200 rounded"
                          >
                            {automation.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => setEditingAutomation(automation)}
                            className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAutomation(automation.id)}
                            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {automations.length === 0 && (
                      <div className="text-center py-12">
                        <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No Automations Yet
                        </h3>
                        <p className="text-gray-600">
                          Create your first automated AR report to get started
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Automation Name
                    </label>
                    <input
                      type="text"
                      value={editingAutomation.name || ''}
                      onChange={(e) =>
                        setEditingAutomation({ ...editingAutomation, name: e.target.value })
                      }
                      placeholder="Weekly AR Report"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Frequency
                      </label>
                      <select
                        value={editingAutomation.frequency}
                        onChange={(e) =>
                          setEditingAutomation({
                            ...editingAutomation,
                            frequency: e.target.value as 'daily' | 'weekly' | 'monthly',
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Time of Day
                      </label>
                      <input
                        type="time"
                        value={editingAutomation.time_of_day || '09:00'}
                        onChange={(e) =>
                          setEditingAutomation({
                            ...editingAutomation,
                            time_of_day: e.target.value + ':00',
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {editingAutomation.frequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Day of Week
                      </label>
                      <select
                        value={editingAutomation.day_of_week || 1}
                        onChange={(e) =>
                          setEditingAutomation({
                            ...editingAutomation,
                            day_of_week: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {DAYS_OF_WEEK.map((day, index) => (
                          <option key={index} value={index}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editingAutomation.frequency === 'monthly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Day of Month
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={editingAutomation.day_of_month || 1}
                        onChange={(e) =>
                          setEditingAutomation({
                            ...editingAutomation,
                            day_of_month: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Report Format
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          value="pdf"
                          checked={editingAutomation.format === 'pdf'}
                          onChange={() =>
                            setEditingAutomation({ ...editingAutomation, format: 'pdf' })
                          }
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">PDF</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          value="csv"
                          checked={editingAutomation.format === 'csv'}
                          onChange={() =>
                            setEditingAutomation({ ...editingAutomation, format: 'csv' })
                          }
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <FileSpreadsheet className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">CSV</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Recipients
                    </label>
                    <div className="flex space-x-2 mb-3">
                      <input
                        type="email"
                        value={newRecipient}
                        onChange={(e) => setNewRecipient(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
                        placeholder="email@example.com"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleAddRecipient}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(editingAutomation.recipients || []).map((email) => (
                        <div
                          key={email}
                          className="flex items-center justify-between bg-gray-100 px-3 py-2 rounded"
                        >
                          <span className="text-sm text-gray-900">{email}</span>
                          <button
                            onClick={() => handleRemoveRecipient(email)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <button
                      onClick={() => setEditingAutomation(null)}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAutomation}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>Save Automation</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-lg p-4 ${
                    log.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-semibold ${log.success ? 'text-green-800' : 'text-red-800'}`}>
                          {log.success ? 'Success' : 'Failed'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {format(new Date(log.executed_at), 'MMM dd, yyyy h:mm a')}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700">
                        <p>Invoices: {log.invoice_count}</p>
                        <p>Total Outstanding: ${log.total_outstanding?.toFixed(2) || '0.00'}</p>
                        <p>Recipients: {log.recipients.join(', ')}</p>
                        {log.error_message && (
                          <p className="text-red-600 mt-2">Error: {log.error_message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Logs Yet</h3>
                  <p className="text-gray-600">Execution logs will appear here once automations run</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
