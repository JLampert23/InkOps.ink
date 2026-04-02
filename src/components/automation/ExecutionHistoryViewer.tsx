import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format } from 'date-fns';

interface ExecutionLog {
  id: string;
  report_id: string;
  executed_at: string;
  scheduled_time_local: string;
  scheduled_time_utc: string;
  actual_execution_time_utc: string;
  timezone: string;
  was_sent: boolean;
  skip_reason: string | null;
  within_time_window: boolean;
  already_sent_today: boolean;
  minutes_since_scheduled: number;
  success: boolean;
  error_message: string | null;
}

interface AutomatedReport {
  id: string;
  report_name: string;
  report_type: string;
}

interface ExecutionHistoryViewerProps {
  ruleId?: string;
  onClose: () => void;
}

export default function ExecutionHistoryViewer({ ruleId, onClose }: ExecutionHistoryViewerProps) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [report, setReport] = useState<AutomatedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExecutionHistory();
  }, [ruleId]);

  const loadExecutionHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      if (ruleId) {
        const { data: reportData, error: reportError } = await supabase
          .from('automated_reports')
          .select('id, report_name, report_type')
          .eq('id', ruleId)
          .single();

        if (reportError) throw reportError;
        setReport(reportData);
      }

      let query = supabase
        .from('automated_reports_execution_log')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(100);

      if (ruleId) {
        query = query.eq('report_id', ruleId);
      }

      const { data, error: logsError } = await query;

      if (logsError) throw logsError;
      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load execution history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (log: ExecutionLog) => {
    if (log.was_sent && log.success) {
      return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
    } else if (!log.was_sent && log.success) {
      return <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />;
    } else {
      return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
    }
  };

  const getStatusText = (log: ExecutionLog) => {
    if (log.was_sent && log.success) {
      return 'Sent';
    } else if (!log.was_sent && log.success) {
      return 'Skipped';
    } else {
      return 'Failed';
    }
  };

  const getStatusColor = (log: ExecutionLog) => {
    if (log.was_sent && log.success) {
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
    } else if (!log.was_sent && log.success) {
      return 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-400';
    } else {
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Execution History</h2>
              {report && (
                <p className="text-blue-100 dark:text-blue-200 mt-1">
                  {report.report_name} - {report.report_type}
                </p>
              )}
              {!ruleId && (
                <p className="text-blue-100 dark:text-blue-200 mt-1">
                  All automated reports
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-300">Error</h3>
                <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading execution history...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 p-12 text-center">
              <Clock className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No execution history yet</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Execution logs will appear here once the automated report system runs.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(log)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(log)}`}>
                            {getStatusText(log)}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(log.executed_at), 'MMM d, yyyy h:mm:ss a')}
                          </span>
                        </div>
                        {log.skip_reason && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {log.skip_reason}
                          </p>
                        )}
                        {log.error_message && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            Error: {log.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400 mb-1">Scheduled Time</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {log.scheduled_time_local}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{log.timezone}</p>
                    </div>

                    <div>
                      <p className="text-gray-500 dark:text-gray-400 mb-1">Time Since Scheduled</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {log.minutes_since_scheduled >= 0
                          ? `${Math.floor(log.minutes_since_scheduled)} min after`
                          : `${Math.abs(Math.floor(log.minutes_since_scheduled))} min before`}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500 dark:text-gray-400 mb-1">Within Window</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {log.within_time_window ? 'Yes' : 'No'}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-500 dark:text-gray-400 mb-1">Already Sent Today</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {log.already_sent_today ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-50 dark:bg-slate-900 p-4 flex justify-between items-center border-t border-gray-200 dark:border-slate-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {logs.length} execution {logs.length === 1 ? 'log' : 'logs'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={loadExecutionHistory}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
