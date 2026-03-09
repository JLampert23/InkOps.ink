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
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failure':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      success: 'bg-green-100 text-green-800',
      failure: 'bg-red-100 text-red-800',
      partial: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
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
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Automation Logs</h2>
            <p className="text-sm text-gray-600 mt-1">
              {automationId && automations[automationId]
                ? `Logs for: ${automations[automationId].name}`
                : 'All automation execution logs'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="partial">Partial</option>
          </select>
          <div className="ml-auto text-sm text-gray-600">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'log' : 'logs'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No logs found</h3>
          <p className="text-gray-600">
            {statusFilter === 'all'
              ? 'No automation executions have been logged yet'
              : `No logs with status: ${statusFilter}`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Automation</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Executed At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLogs.map((log) => {
                const automation = automations[log.automation_id];

                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        {getStatusBadge(log.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {automation?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {format(new Date(log.executed_at), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(log.executed_at), 'h:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {log.execution_time_ms}ms
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {log.executed_actions.length} action{log.executed_actions.length !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-sm text-blue-600 hover:text-blue-700"
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Execution Details</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Automation</label>
                <div className="mt-1 text-sm text-gray-900">
                  {automations[selectedLog.automation_id]?.name || 'Unknown'}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Executed At</label>
                <div className="mt-1 text-sm text-gray-900">
                  {format(new Date(selectedLog.executed_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Execution Time</label>
                <div className="mt-1 text-sm text-gray-900">
                  {selectedLog.execution_time_ms}ms
                </div>
              </div>

              {selectedLog.error_message && (
                <div>
                  <label className="text-sm font-medium text-red-700">Error Message</label>
                  <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700">Trigger Event</label>
                <pre className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog.trigger_event, null, 2)}
                </pre>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Executed Actions ({selectedLog.executed_actions.length})
                </label>
                <div className="mt-1 space-y-2">
                  {selectedLog.executed_actions.map((action, index) => (
                    <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="text-sm font-medium text-gray-900 mb-1">
                        {action.type}
                      </div>
                      <pre className="text-xs text-gray-600 overflow-x-auto">
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
