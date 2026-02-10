import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { Calendar, ExternalLink, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface ImportedQuote {
  import_id: string;
  received_at: string;
  sale_order: string;
  store_name: string;
  batch_id: string;
  quote_id: string;
  quote_number: string;
  status: string;
  error_message?: string;
}

export default function ImportedQuotes() {
  const [imports, setImports] = useState<ImportedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    fetchImports();
  }, [statusFilter, startDate, endDate]);

  async function fetchImports() {
    setLoading(true);
    try {
      let query = supabase
        .from('chipply_import_logs')
        .select(`
          id,
          created_at,
          status,
          error_message,
          raw_json,
          quotes!quotes_chipply_import_log_id_fkey (
            id,
            quote_number
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate + 'T23:59:59');
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedData: ImportedQuote[] = (data || []).map((log: any) => {
        const payload = log.raw_json || {};
        const accountSummary = payload.accountSummary || {};
        const quote = Array.isArray(log.quotes) ? log.quotes[0] : log.quotes;

        return {
          import_id: log.id,
          received_at: log.created_at,
          sale_order: accountSummary.saleOrder || 'N/A',
          store_name: accountSummary.parentStoreName || 'N/A',
          batch_id: accountSummary.batchId || 'N/A',
          quote_id: quote?.id || '',
          quote_number: quote?.quote_number || 'N/A',
          status: log.status,
          error_message: log.error_message,
        };
      });

      setImports(formattedData);
    } catch (error) {
      console.error('Error fetching imports:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const styles = {
      processed: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium border ${
          styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800 border-gray-200'
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  function handleViewQuote(quoteId: string) {
    if (!quoteId) return;
    window.location.href = `#quotes/${quoteId}`;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Imported Quotes</h1>
        <p className="text-sm text-gray-600 mt-1">
          View all quotes imported from Chipply
        </p>
      </div>

      <div className="px-6 py-4 bg-white border-b">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Filter className="inline w-4 h-4 mr-1" />
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline w-4 h-4 mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline w-4 h-4 mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {(statusFilter !== 'all' || startDate || endDate) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading imports...</div>
          </div>
        ) : imports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="text-lg font-medium">No imports found</p>
            <p className="text-sm mt-2">
              {statusFilter !== 'all' || startDate || endDate
                ? 'Try adjusting your filters'
                : 'Import data will appear here when Chipply sends work orders'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Received At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chipply Sale Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Store Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batch ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quote Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {imports.map((imp) => (
                  <tr key={imp.import_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(imp.received_at), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {imp.sale_order}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {imp.store_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {imp.batch_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {imp.quote_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(imp.status)}
                        {imp.status === 'failed' && imp.error_message && (
                          <span className="text-xs text-red-600 mt-1" title={imp.error_message}>
                            {imp.error_message.length > 50
                              ? imp.error_message.substring(0, 50) + '...'
                              : imp.error_message}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {imp.quote_id ? (
                        <button
                          onClick={() => handleViewQuote(imp.quote_id)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          View Quote
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">No quote created</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
