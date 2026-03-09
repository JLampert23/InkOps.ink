import { useState } from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatDateTime, type SquareExportOptions } from '../../utils/square-export';
import { SquareApiService } from '../../services/square-api-service';
import SquareFilterBar from './SquareFilterBar';

export default function SquareTransactions() {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchTransactions = async () => {
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

      const data = await SquareApiService.listPayments(params);

      if (data.payments) {
        setTransactions(data.payments.map((payment: any) => ({
          id: payment.id,
          created_at: payment.created_at,
          amount: payment.amount_money ? payment.amount_money.amount / 100 : 0,
          status: payment.status,
          payment_method: payment.card_details?.card?.card_brand || 'Unknown',
          customer_name: payment.customer_id || 'N/A',
        })));
      } else {
        setTransactions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    const filename = `square-transactions-${new Date().toISOString().split('T')[0]}`;
    const options: SquareExportOptions = {
      filename,
      title: 'Square Transactions',
      columns: [
        { header: 'Date/Time', key: 'created_at', format: formatDateTime },
        { header: 'Transaction ID', key: 'id' },
        { header: 'Amount', key: 'amount', format: formatCurrency },
        { header: 'Status', key: 'status' },
        { header: 'Payment Method', key: 'payment_method' },
        { header: 'Customer', key: 'customer_name' },
      ],
      data: transactions,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} to ${dateRange.end}` : undefined,
      summary: [
        { label: 'Total Transactions', value: String(transactions.length) },
        { label: 'Total Amount', value: formatCurrency(transactions.reduce((sum, t) => sum + (t.amount || 0), 0)) },
      ],
    };

    if (format === 'csv') {
      exportToCSV(options);
    } else {
      exportToPDF(options);
    }
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6">
      <SquareFilterBar
        searchPlaceholder="Search transactions by ID, customer, or amount..."
        sortOptions={[
          { label: 'Sort by Date', value: 'date' },
          { label: 'Sort by Amount', value: 'amount' },
          { label: 'Sort by Status', value: 'status' }
        ]}
        onSearchChange={(value) => setSearchTerm(value)}
        onDateRangeChange={(start, end) => setDateRange({ start, end })}
        showDateRange={true}
        showSort={true}
      />

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Square Transactions</h2>

        <div className="flex gap-3">
          <button
            onClick={fetchTransactions}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Fetching...' : 'Fetch Data'}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={transactions.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-10">
                <button
                  onClick={() => handleExport('csv')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50"
                >
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
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {transactions.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{formatDateTime(transaction.created_at)}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">{transaction.id}</td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">{formatCurrency(transaction.amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{transaction.status}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{transaction.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No transactions to display. Click "Fetch Data" to load transactions from Square.</p>
        </div>
      )}
    </div>
  );
}
