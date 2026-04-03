import { useState, useEffect } from 'react';
import { Plus, Search, Power, PowerOff, CreditCard as Edit, Trash2, Clock, Zap, Loader2, Eye, PlayCircle, Mail, Save } from 'lucide-react';
import { Automation } from '../../types/automation';
import { AutomationEngineService } from '../../services/automation-engine-service';
import { AutomationBuilder } from './AutomationBuilder';
import { AutomationLogs } from './AutomationLogs';
import { TRIGGER_OPTIONS } from './automation-config';
import { supabase } from '../../lib/supabase-client';

type View = 'dashboard' | 'builder' | 'logs' | 'edit';

export function AutomationsDashboard() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [queueStats, setQueueStats] = useState<{ pending: number; completed: number; failed: number } | null>(null);

  // Quote Follow-Up Settings
  const [quoteFollowupEnabled, setQuoteFollowupEnabled] = useState(false);
  const [quoteFollowupDays, setQuoteFollowupDays] = useState(7);
  const [quoteFollowupMaxAttempts, setQuoteFollowupMaxAttempts] = useState(2);
  const [quoteFollowupIntervalDays, setQuoteFollowupIntervalDays] = useState(7);
  const [savingFollowupSettings, setSavingFollowupSettings] = useState(false);
  const [companySettingsId, setCompanySettingsId] = useState<string | null>(null);

  useEffect(() => {
    loadAutomations();
    loadQueueStats();
    loadFollowupSettings();
  }, []);

  const loadFollowupSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('id, quote_followup_enabled, quote_followup_days, quote_followup_max_attempts, quote_followup_interval_days')
        .single();

      if (error) throw error;

      if (data) {
        setCompanySettingsId(data.id);
        setQuoteFollowupEnabled(data.quote_followup_enabled || false);
        setQuoteFollowupDays(data.quote_followup_days || 7);
        setQuoteFollowupMaxAttempts(data.quote_followup_max_attempts || 2);
        setQuoteFollowupIntervalDays(data.quote_followup_interval_days || 7);
      }
    } catch (error) {
      console.error('Failed to load follow-up settings:', error);
    }
  };

  const saveFollowupSettings = async () => {
    if (!companySettingsId) {
      alert('Company settings not loaded');
      return;
    }

    try {
      setSavingFollowupSettings(true);

      const { error } = await supabase
        .from('company_settings')
        .update({
          quote_followup_enabled: quoteFollowupEnabled,
          quote_followup_days: quoteFollowupDays,
          quote_followup_max_attempts: quoteFollowupMaxAttempts,
          quote_followup_interval_days: quoteFollowupIntervalDays,
        })
        .eq('id', companySettingsId);

      if (error) throw error;

      alert('Quote follow-up settings have been updated successfully!');
    } catch (err) {
      console.error('Error saving follow-up settings:', err);
      alert('Failed to save follow-up settings');
    } finally {
      setSavingFollowupSettings(false);
    }
  };

  const loadQueueStats = async () => {
    try {
      const { data, error } = await supabase
        .from('automation_queue')
        .select('status');

      if (error) throw error;

      const stats = {
        pending: data.filter(q => q.status === 'pending').length,
        completed: data.filter(q => q.status === 'completed').length,
        failed: data.filter(q => q.status === 'failed').length,
      };

      setQueueStats(stats);
    } catch (error) {
      console.error('Failed to load queue stats:', error);
    }
  };

  const loadAutomations = async () => {
    setLoading(true);
    try {
      const data = await AutomationEngineService.getAllAutomations();
      setAutomations(data);
    } catch (error) {
      console.error('Failed to load automations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutomation = async (id: string, enabled: boolean) => {
    try {
      await AutomationEngineService.toggleAutomation(id, enabled);
      await loadAutomations();
    } catch (error) {
      console.error('Failed to toggle automation:', error);
      alert('Failed to toggle automation');
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;

    try {
      await AutomationEngineService.deleteAutomation(id);
      await loadAutomations();
    } catch (error) {
      console.error('Failed to delete automation:', error);
      alert('Failed to delete automation');
    }
  };

  const handleEditAutomation = (automation: Automation) => {
    setEditingAutomation(automation);
    setCurrentView('edit');
  };

  const handleCreateNew = () => {
    setEditingAutomation(null);
    setCurrentView('builder');
  };

  const handleSaveComplete = () => {
    setCurrentView('dashboard');
    setEditingAutomation(null);
    loadAutomations();
  };

  const handleViewLogs = (automationId: string) => {
    setSelectedAutomationId(automationId);
    setCurrentView('logs');
  };

  const handleProcessQueue = async () => {
    setProcessingQueue(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-automation-queue', {
        body: {}
      });

      if (error) throw error;

      alert(data.message || `Successfully processed ${data.successful || 0} automation(s)`);
      await loadQueueStats();
      await loadAutomations();
    } catch (error) {
      console.error('Failed to process queue:', error);
      alert('Failed to process automation queue. Please try again.');
    } finally {
      setProcessingQueue(false);
    }
  };

  const getTriggerLabel = (triggerType: string) => {
    const trigger = TRIGGER_OPTIONS.find(t => t.value === triggerType);
    return trigger?.label || triggerType;
  };

  const filteredAutomations = automations.filter(automation =>
    automation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getTriggerLabel(automation.trigger_type).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (currentView === 'builder' || currentView === 'edit') {
    return (
      <AutomationBuilder
        automation={editingAutomation}
        onSave={handleSaveComplete}
        onCancel={() => {
          setCurrentView('dashboard');
          setEditingAutomation(null);
        }}
      />
    );
  }

  if (currentView === 'logs') {
    return (
      <AutomationLogs
        automationId={selectedAutomationId || undefined}
        onBack={() => {
          setCurrentView('dashboard');
          setSelectedAutomationId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Quote Follow-Up Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Quote Follow-Up Automation</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Automatically send follow-up emails to customers who haven't responded to quotes</p>
        </div>

        <div className="space-y-4 border-t border-gray-200 dark:border-slate-700 pt-4">
          {/* Enable Follow-ups */}
          <div className="flex items-start gap-3">
            <div className="flex items-center h-9">
              <input
                type="checkbox"
                id="enable-followups"
                checked={quoteFollowupEnabled}
                onChange={(e) => setQuoteFollowupEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label htmlFor="enable-followups" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Enable Automatic Follow-Ups
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                When enabled, the system will automatically send follow-up emails for quotes that are in "sent" or "pending" status
              </p>
            </div>
          </div>

          {quoteFollowupEnabled && (
            <>
              {/* Days Before First Follow-up */}
              <div>
                <label htmlFor="followup-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Days Before First Follow-Up
                </label>
                <input
                  type="number"
                  id="followup-days"
                  value={quoteFollowupDays}
                  onChange={(e) => setQuoteFollowupDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 7)))}
                  min="1"
                  max="365"
                  className="w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Number of days to wait after sending a quote before sending the first follow-up (1-365 days)
                </p>
              </div>

              {/* Maximum Attempts */}
              <div>
                <label htmlFor="followup-max-attempts" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maximum Follow-Up Attempts
                </label>
                <input
                  type="number"
                  id="followup-max-attempts"
                  value={quoteFollowupMaxAttempts}
                  onChange={(e) => setQuoteFollowupMaxAttempts(Math.max(1, Math.min(10, parseInt(e.target.value) || 2)))}
                  min="1"
                  max="10"
                  className="w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maximum number of follow-up emails to send per quote (1-10 attempts)
                </p>
              </div>

              {/* Interval Between Follow-ups */}
              <div>
                <label htmlFor="followup-interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Days Between Follow-Ups
                </label>
                <input
                  type="number"
                  id="followup-interval"
                  value={quoteFollowupIntervalDays}
                  onChange={(e) => setQuoteFollowupIntervalDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 7)))}
                  min="1"
                  max="90"
                  className="w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Number of days to wait between subsequent follow-up emails (1-90 days)
                </p>
              </div>

              {/* Preview Timeline */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Follow-Up Timeline Preview
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-blue-600 dark:text-blue-400 font-medium">Day 0:</span>
                    <span className="text-gray-700 dark:text-gray-300">Quote sent to customer</span>
                  </div>
                  {Array.from({ length: quoteFollowupMaxAttempts }, (_, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        Day {i === 0 ? quoteFollowupDays : quoteFollowupDays + (i * quoteFollowupIntervalDays)}:
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">
                        Follow-up #{i + 1} sent automatically
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Template Note */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
                <p className="text-xs font-medium text-yellow-900 dark:text-yellow-300 mb-2 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Template Configuration
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Follow-up emails use the "Quote Follow-Up" template from the Communication Templates section.
                  You can customize the email content, subject line, and attachments in the templates manager.
                </p>
              </div>
            </>
          )}

          {/* Save Button */}
          <button
            onClick={saveFollowupSettings}
            disabled={savingFollowupSettings}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingFollowupSettings ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Follow-Up Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Workflow Automations Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Workflow Automations</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create and manage custom workflow automations</p>
          {queueStats && (
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Queue:</span>
              <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
                {queueStats.pending} pending
              </span>
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                {queueStats.completed} completed
              </span>
              {queueStats.failed > 0 && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                  {queueStats.failed} failed
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {queueStats && queueStats.pending > 0 && (
            <button
              onClick={handleProcessQueue}
              disabled={processingQueue}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingQueue ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4" />
              )}
              {processingQueue ? 'Processing...' : `Process Queue (${queueStats.pending})`}
            </button>
          )}
          <button
            onClick={() => setCurrentView('logs')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <Clock className="w-4 h-4" />
            View Logs
          </button>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Automation
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search automations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading automations...</p>
        </div>
      ) : filteredAutomations.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <Zap className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No automations found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first automation to streamline your workflow</p>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Automation
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAutomations.map((automation) => (
            <div
              key={automation.id}
              className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{automation.name}</h3>
                    {automation.is_enabled ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full">
                        <Power className="w-3 h-3" />
                        Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                        <PowerOff className="w-3 h-3" />
                        Disabled
                      </span>
                    )}
                  </div>

                  {automation.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{automation.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium">Trigger:</span>
                      <span>{getTriggerLabel(automation.trigger_type)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Conditions:</span>
                      <span>{automation.conditions.length || 'None'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Actions:</span>
                      <span>{automation.actions.length}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="capitalize">{automation.scheduling.type}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewLogs(automation.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="View Logs"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleAutomation(automation.id, !automation.is_enabled)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                    title={automation.is_enabled ? 'Disable' : 'Enable'}
                  >
                    {automation.is_enabled ? (
                      <PowerOff className="w-4 h-4" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEditAutomation(automation)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteAutomation(automation.id)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
