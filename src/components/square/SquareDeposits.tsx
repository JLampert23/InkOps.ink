import { useState } from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatDate, type SquareExportOptions } from '../../utils/square-export';
import SquareFilterBar from './SquareFilterBar';

export default function SquareDeposits() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchDeposits = async () => {
    setLoading(true);
    setError(null);
    try {
      // PLACEHOLDER: Replace with actual Square API call
      alert('Fetch Deposits - Connect to Square API here');
      setDeposits([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deposits');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    const filename = `square-deposits-${new Date().toISOString().split('T')[0]}`;
    const options: SquareExportOptions = {
      filename,
      title: 'Square Deposits / Payouts',
      columns: [
        { header: 'Date', key: 'date', format: formatDate },
        { header: 'Deposit ID', key: 'id' },
        { header: 'Amount', key: 'amount', format: formatCurrency },
        { header: 'Status', key: 'status' },
        { header: 'Type', key: 'type' },
      ],
      data: deposits,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} to ${dateRange.end}` : undefined,
    };

    if (format === 'csv') exportToCSV(options);
    else exportToPDF(options);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6">
      <SquareFilterBar
        searchPlaceholder="Search deposits by ID, amount, or status..."
        sortOptions={[
          { label: 'Sort by Date', value: 'date' },
          { label: 'Sort by Amount', value: 'amount' },
          { label: 'Sort by Status', value: 'status' }
        ]}
        onDateRangeChange={(start, end) => setDateRange({ start, end })}
        showDateRange={true}
        showSort={true}
      />

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Deposits / Payouts</h2>

        <div className="flex gap-3">
          <button
            onClick={fetchDeposits}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch Data'}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={deposits.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-10">
                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-left hover:bg-gray-50">
                  Export as CSV
                </button>
                <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2 text-left hover:bg-gray-50">
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {deposits.length === 0 && !loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No deposits to display. Click "Fetch Data" to load from Square.</p>
        </div>
      )}
    </div>
  );
}
