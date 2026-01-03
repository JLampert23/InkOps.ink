import { Edit2, Trash2, Clock, Mail, FileText, Calendar, Power } from 'lucide-react';
import { AutomationRule } from '../../services/automation-service';
import { format } from 'date-fns';

interface AutomationRuleListProps {
  rules: AutomationRule[];
  onEdit: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (ruleId: string, enabled: boolean) => void;
}

export default function AutomationRuleList({ rules, onEdit, onDelete, onToggle }: AutomationRuleListProps) {
  const getScheduleDescription = (rule: AutomationRule) => {
    const time = rule.schedule_time.substring(0, 5);
    const tz = rule.schedule_timezone.split('/')[1].replace('_', ' ');

    switch (rule.schedule_type) {
      case 'daily':
        return `Daily at ${time} ${tz}`;
      case 'weekly': {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const day = rule.schedule_day_of_week !== undefined ? days[rule.schedule_day_of_week] : 'Unknown';
        return `Every ${day} at ${time} ${tz}`;
      }
      case 'monthly': {
        const day = rule.schedule_day_of_month || '1st';
        return `Monthly on day ${day} at ${time} ${tz}`;
      }
      case 'custom':
        return `Custom schedule at ${time} ${tz}`;
      default:
        return 'Unknown schedule';
    }
  };

  const getStatusBadge = (enabled: boolean) => {
    return enabled ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
        Paused
      </span>
    );
  };

  if (rules.length === 0) {
    return (
      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No automation rules yet</h3>
        <p className="text-gray-600 mb-6">
          Create your first automation rule to start receiving scheduled reports via email.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{rule.report_name}</h3>
                  {getStatusBadge(rule.is_enabled)}
                </div>
                <p className="text-sm text-gray-600">{rule.report_type}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onToggle(rule.id, !rule.is_enabled)}
                  className={`p-2 rounded-lg transition-colors ${
                    rule.is_enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={rule.is_enabled ? 'Pause automation' : 'Activate automation'}
                >
                  <Power className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit(rule.id)}
                  className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  title="Edit rule"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(rule.id)}
                  className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  title="Delete rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Schedule</p>
                  <p className="text-sm font-medium text-gray-900">{getScheduleDescription(rule)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Mail className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Recipients</p>
                  <p className="text-sm font-medium text-gray-900">
                    {rule.email_recipients.length} {rule.email_recipients.length === 1 ? 'recipient' : 'recipients'}
                  </p>
                  <p className="text-xs text-gray-600 truncate max-w-[200px]">
                    {rule.email_recipients[0]}
                    {rule.email_recipients.length > 1 && `, +${rule.email_recipients.length - 1} more`}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Formats</p>
                  <p className="text-sm font-medium text-gray-900">
                    {rule.file_formats.map(f => f.toUpperCase()).join(', ')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Calendar className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Last Sent</p>
                  <p className="text-sm font-medium text-gray-900">
                    {rule.last_sent_at
                      ? format(new Date(rule.last_sent_at), 'MMM d, yyyy')
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
