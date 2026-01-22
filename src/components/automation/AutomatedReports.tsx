import { useState, useEffect } from 'react';
import { Plus, RefreshCw, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { AutomationService, AutomationRule } from '../../services/automation-service';
import AutomationRuleEditor from './AutomationRuleEditor';
import AutomationRuleList from './AutomationRuleList';

export default function AutomatedReports() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AutomationService.listAutomationRules();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load automation rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingRuleId(undefined);
    setShowEditor(true);
  };

  const handleEdit = (ruleId: string) => {
    setEditingRuleId(ruleId);
    setShowEditor(true);
  };

  const handleDelete = async (ruleId: string) => {
    if (deleteConfirm === ruleId) {
      try {
        await AutomationService.deleteAutomationRule(ruleId);
        await loadRules();
        setDeleteConfirm(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete rule');
      }
    } else {
      setDeleteConfirm(ruleId);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const handleToggle = async (ruleId: string, enabled: boolean) => {
    try {
      await AutomationService.toggleAutomationRule(ruleId, enabled);
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle rule');
    }
  };

  const handleTest = async (ruleId: string) => {
    try {
      setError(null);
      setSuccessMessage(null);
      await AutomationService.generateAndSendReport(ruleId);
      setSuccessMessage('Test report sent successfully! Check your email inbox.');
      await loadRules();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test report');
    }
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setEditingRuleId(undefined);
  };

  const handleSaveEditor = async () => {
    await loadRules();
  };

  const activeRulesCount = rules.filter(r => r.is_enabled).length;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Automated Reports</h1>
            <p className="text-blue-100 dark:text-blue-200">
              Schedule reports to be delivered automatically to your team via email
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{activeRulesCount}</div>
            <div className="text-sm text-blue-100 dark:text-blue-200">Active Rules</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 dark:text-red-300">Error</h3>
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900 dark:text-green-300">Success</h3>
            <p className="text-sm text-green-800 dark:text-green-400">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Automation Rules</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure scheduled reports with custom recipients and formats
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadRules}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleCreateNew}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Rule
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading automation rules...</p>
          </div>
        ) : (
          <AutomationRuleList
            rules={rules}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggle}
            onTest={handleTest}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Flexible Scheduling</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose from daily, weekly, monthly, or custom schedules with timezone support
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Multiple Formats</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Receive reports as PDF, CSV, or both formats automatically attached to emails
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Easy Management</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Pause, edit, or delete automation rules at any time with a single click
          </p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3">How Automated Reports Work</h3>
        <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-semibold">1.</span>
            <span>Create a new automation rule and select the report type you want to automate</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">2.</span>
            <span>Choose your delivery schedule (daily, weekly, or monthly) and set the time</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">3.</span>
            <span>Add one or more email recipients who will receive the report</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">4.</span>
            <span>Select file formats (PDF, CSV, or both) and enable the automation</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">5.</span>
            <span>The system will automatically generate and send reports according to your schedule</span>
          </li>
        </ol>
      </div>

      {showEditor && (
        <AutomationRuleEditor
          ruleId={editingRuleId}
          onClose={handleCloseEditor}
          onSave={handleSaveEditor}
        />
      )}
    </div>
  );
}
