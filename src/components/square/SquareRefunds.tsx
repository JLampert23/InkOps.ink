import { useState } from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatDateTime, type SquareExportOptions } from '../../utils/square-export';
import { SquareApiService } from '../../services/square-api-service';
import SquareFilterBar from './SquareFilterBar';

export default function SquareRefunds() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchRefunds = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};

      if (dateRange.start) {
        params.begin_time = new Date(dateRange.start).toISOString();
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        params.end_time = endDate.toISOString();
      }

      const data = await SquareApiService.listRefunds(params);

      if (data.refunds) {
        setRefunds(data.refunds.map((refund: any) => ({
          id: refund.id,
          created_at: refund.created_at,
          amount: refund.amount_money ? refund.amount_money.amount / 100 : 0,
          status: refund.status,
          payment_id: refund.payment_id || 'N/A',
          reason: refund.reason || 'N/A',
        })));
      } else {
        setRefunds([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch refunds');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    const options: SquareExportOptions = {
      filename: `square-refunds-${new Date().toISOString().split('T')[0]}`,
      title: 'Square Refunds',
      columns: [
        { header: 'Date/Time', key: 'created_at', format: formatDateTime },
        { header: 'Refund ID', key: 'id' },
        { header: 'Amount', key: 'amount', format: formatCurrency },
        { header: 'Status', key: 'status' },
        { header: 'Reason', key: 'reason' },
      ],
      data: refunds,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} to ${dateRange.end}` : undefined,
      summary: [
        { label: 'Total Refunds', value: String(refunds.length) },
        { label: 'Total Amount', value: formatCurrency(refunds.reduce((sum, r) => sum + (r.amount || 0), 0)) },
      ],
    };
    if (format === 'csv') exportToCSV(options);
    else exportToPDF(options);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6">
      <SquareFilterBar
        searchPlaceholder="Search refunds by ID, amount, or status..."
        sortOptions={[
          { label: 'Sort by Date', value: 'date' },
          { label: 'Sort by Amount', value: 'amount' },
          { label: 'Sort by Status', value: 'status' }
        ]}
        onDateRangeChange={(start, end) => setDateRange({ start, end })}
        showDateRange={true}
        showSort={true}
      />

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Refunds</h2>
        <div className="flex gap-3">
          <button
            onClick={fetchRefunds}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Fetching...' : 'Fetch Data'}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={refunds.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg dark:shadow-slate-900/50 py-2 z-10">
                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-600">Export as CSV</button>
                <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-600">Export as PDF</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 dark:text-red-300">Error</h3>
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {refunds.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Refund ID</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reason</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {refunds.map((refund, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{formatDateTime(refund.created_at)}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400 text-xs">{refund.id}</td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-red-600 dark:text-red-400">{formatCurrency(refund.amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{refund.status}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{refund.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">No refunds to display. Click "Fetch Data" to load refunds from Square.</p>
        </div>
      )}
    </div>
  );
}
