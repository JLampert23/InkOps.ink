import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Clock, Loader2, Filter } from 'lucide-react';
import { AutomationLog, Automation } from '../../types/automation';
import { AutomationEngineService } from '../../services/automation-engine-service';
import { format } from 'date-fns';

interface AutomationLogsProps {
  automationId?: string;
  onBack: () => void;
}

export function AutomationLogs({ automationId, onBack }: AutomationLogsProps) {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [automations, setAutomations] = useState<Record<string, Automation>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AutomationLog | null>(null);

  useEffect(() => {
    loadData();
  }, [automationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsData, automationsData] = await Promise.all([
        AutomationEngineService.getAutomationLogs(automationId, 100),
        AutomationEngineService.getAllAutomations(),
      ]);

      setLogs(logsData);

      const automationsMap: Record<string, Automation> = {};
      automationsData.forEach(a => {
        automationsMap[a.id] = a;
      });
      setAutomations(automationsMap);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'failure':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      success: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      failure: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      partial: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-300'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredLogs = statusFilter === 'all'
    ? logs
    : logs.filter(log => log.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Automation Logs</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {automationId && automations[automationId]
                ? `Logs for: ${automations[automationId].name}`
                : 'All automation execution logs'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="partial">Partial</option>
          </select>
          <div className="ml-auto text-sm text-gray-600 dark:text-gray-400">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'log' : 'logs'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <Clock className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No logs found</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {statusFilter === 'all'
              ? 'No automation executions have been logged yet'
              : `No logs with status: ${statusFilter}`}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Automation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Executed At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {filteredLogs.map((log) => {
                const automation = automations[log.automation_id];

                return (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        {getStatusBadge(log.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {automation?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {format(new Date(log.executed_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(log.executed_at), 'h:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {log.execution_time_ms}ms
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {log.executed_actions.length} action{log.executed_actions.length !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Execution Details</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Automation</label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  {automations[selectedLog.automation_id]?.name || 'Unknown'}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Executed At</label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  {format(new Date(selectedLog.executed_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Execution Time</label>
                <div className="mt-1 text-sm text-gray-900 dark:text-white">
                  {selectedLog.execution_time_ms}ms
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <label className="text-sm font-medium text-red-700 dark:text-red-400">Error Message</label>
                  <div className="mt-1 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-900 dark:text-red-300">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Trigger Event</label>
                <pre className="mt-1 p-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-gray-300 overflow-x-auto">
                  {JSON.stringify(selectedLog.trigger_event, null, 2)}
                </pre>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Executed Actions ({selectedLog.executed_actions.length})
                </label>
                <div className="mt-1 space-y-2">
                  {selectedLog.executed_actions.map((action, index) => (
                    <div key={index} className="p-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-lg">
                      <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {action.type}
                      </div>
                      <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                        {JSON.stringify(action.config, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
