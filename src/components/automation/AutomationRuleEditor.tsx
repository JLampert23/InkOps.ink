import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { AutomationService, CreateAutomationRuleInput, AutomationRule } from '../../services/automation-service';

interface AutomationRuleEditorProps {
  ruleId?: string;
  onClose: () => void;
  onSave: () => void;
}

const REPORT_TYPES = [
  { value: 'accounts-receivable', label: 'Daily Accounts Receivable Report' },
  { value: 'deposits-24h', label: 'Deposit Report (Previous 24 Hours)' },
  { value: 'open-invoices', label: 'Open Invoices Report' },
  { value: 'customer-summary', label: 'Customer Summary Report' },
  { value: 'sales-summary', label: 'Sales Summary Report' },
  { value: 'aging-report', label: 'Aging Report' },
  { value: 'square-transactions', label: 'Square Transactions Report' },
  { value: 'square-deposits', label: 'Square Deposits Report' },
];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function AutomationRuleEditor({ ruleId, onClose, onSave }: AutomationRuleEditorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');

  const [formData, setFormData] = useState<CreateAutomationRuleInput>({
    report_type: '',
    report_name: '',
    schedule_type: 'daily',
    schedule_time: '08:00',
    schedule_timezone: 'America/New_York',
    email_recipients: [],
    file_formats: ['pdf'],
    is_enabled: true,
  });

  useEffect(() => {
    if (ruleId) {
      loadRule();
    }
  }, [ruleId]);

  const loadRule = async () => {
    try {
      setLoading(true);
      const rule = await AutomationService.getAutomationRule(ruleId!);
      if (rule) {
        setFormData({
          report_type: rule.report_type,
          report_name: rule.report_name,
          schedule_type: rule.schedule_type,
          schedule_time: rule.schedule_time.substring(0, 5),
          schedule_timezone: rule.schedule_timezone,
          schedule_day_of_week: rule.schedule_day_of_week,
          schedule_day_of_month: rule.schedule_day_of_month,
          email_recipients: rule.email_recipients,
          file_formats: rule.file_formats,
          is_enabled: rule.is_enabled,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rule');
    } finally {
      setLoading(false);
    }
  };

  const handleReportTypeChange = (reportType: string) => {
    const report = REPORT_TYPES.find(r => r.value === reportType);
    setFormData({
      ...formData,
      report_type: reportType,
      report_name: report?.label || reportType,
    });
  };

  const handleAddEmail = () => {
    if (emailInput && emailInput.includes('@')) {
      if (!formData.email_recipients.includes(emailInput)) {
        setFormData({
          ...formData,
          email_recipients: [...formData.email_recipients, emailInput],
        });
      }
      setEmailInput('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setFormData({
      ...formData,
      email_recipients: formData.email_recipients.filter(e => e !== email),
    });
  };

  const toggleFileFormat = (format: 'pdf' | 'csv') => {
    const formats = formData.file_formats.includes(format)
      ? formData.file_formats.filter(f => f !== format)
      : [...formData.file_formats, format];

    setFormData({ ...formData, file_formats: formats });
  };

  const handleSave = async () => {
    setError(null);

    if (!formData.report_type) {
      setError('Please select a report type');
      return;
    }

    if (formData.email_recipients.length === 0) {
      setError('Please add at least one email recipient');
      return;
    }

    if (formData.file_formats.length === 0) {
      setError('Please select at least one file format');
      return;
    }

    if (formData.schedule_type === 'weekly' && formData.schedule_day_of_week === undefined) {
      setError('Please select a day of the week');
      return;
    }

    if (formData.schedule_type === 'monthly' && formData.schedule_day_of_month === undefined) {
      setError('Please select a day of the month');
      return;
    }

    try {
      setLoading(true);
      if (ruleId) {
        await AutomationService.updateAutomationRule(ruleId, formData);
      } else {
        await AutomationService.createAutomationRule(formData);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {ruleId ? 'Edit Automation Rule' : 'Create Automation Rule'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Report Type
            </label>
            <select
              value={formData.report_type}
              onChange={(e) => handleReportTypeChange(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a report...</option>
              {REPORT_TYPES.map(report => (
                <option key={report.value} value={report.value}>
                  {report.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Schedule Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['daily', 'weekly', 'monthly', 'custom'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFormData({ ...formData, schedule_type: type })}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    formData.schedule_type === type
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {formData.schedule_type === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Day of Week
              </label>
              <select
                value={formData.schedule_day_of_week ?? ''}
                onChange={(e) => setFormData({ ...formData, schedule_day_of_week: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a day...</option>
                {DAYS_OF_WEEK.map(day => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.schedule_type === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Day of Month
              </label>
              <select
                value={formData.schedule_day_of_month ?? ''}
                onChange={(e) => setFormData({ ...formData, schedule_day_of_month: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a day...</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Delivery Time
              </label>
              <input
                type="time"
                value={formData.schedule_time}
                onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Timezone
              </label>
              <select
                value={formData.schedule_timezone}
                onChange={(e) => setFormData({ ...formData, schedule_timezone: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Email Recipients
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                placeholder="Enter email address..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleAddEmail}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            {formData.email_recipients.length > 0 && (
              <div className="space-y-2">
                {formData.email_recipients.map(email => (
                  <div
                    key={email}
                    className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg"
                  >
                    <span className="text-sm text-gray-900">{email}</span>
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              File Formats
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => toggleFileFormat('pdf')}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  formData.file_formats.includes('pdf')
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                PDF
              </button>
              <button
                onClick={() => toggleFileFormat('csv')}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  formData.file_formats.includes('csv')
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                CSV
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Enable Automation</h4>
              <p className="text-xs text-gray-600 mt-0.5">
                Turn this rule on or off
              </p>
            </div>
            <button
              onClick={() => setFormData({ ...formData, is_enabled: !formData.is_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.is_enabled ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
