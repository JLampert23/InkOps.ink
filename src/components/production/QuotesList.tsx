import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Copy,
  Send,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
} from 'lucide-react';

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string;
  customer_company: string;
  total: number;
  status: string;
  created_at: string;
  valid_until: string | null;
  sent_at: string | null;
  approved_at: string | null;
}

interface QuotesListProps {
  onSelectQuote: (quoteId: string) => void;
  onCreateQuote: () => void;
  onEditQuote: (quoteId: string) => void;
}

export default function QuotesList({ onSelectQuote, onCreateQuote, onEditQuote }: QuotesListProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadQuotes();
  }, [statusFilter]);

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quotes-api`;
      const params = new URLSearchParams();

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`${url}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load quotes');
      }

      const data = await response.json();
      setQuotes(data.quotes || []);
    } catch (error) {
      console.error('Error loading quotes:', error);
      alert('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (quoteId: string) => {
    if (!confirm('Duplicate this quote?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-actions/${quoteId}/duplicate`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate quote');
      }

      alert('Quote duplicated successfully!');
      loadQuotes();
    } catch (error) {
      console.error('Error duplicating quote:', error);
      alert('Failed to duplicate quote');
    }
  };

  const handleDelete = async (quoteId: string) => {
    if (!confirm('Are you sure you want to delete this quote? This action cannot be undone.')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quotes-api/${quoteId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete quote');
      }

      alert('Quote deleted successfully!');
      loadQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      alert('Failed to delete quote. Only admins can delete quotes.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'sent':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'expired':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'converted':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'sent':
        return <Send className="w-4 h-4" />;
      case 'expired':
        return <Clock className="w-4 h-4" />;
      case 'converted':
        return <FileText className="w-4 h-4" />;
      default:
        return <Edit className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Quotes</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage customer quotes
          </p>
        </div>
        <button
          onClick={onCreateQuote}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Quote
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search quotes by number, customer name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadQuotes()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
          <button
            onClick={loadQuotes}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Status:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
                <option value="converted">Converted</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Quotes Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading quotes...</p>
          </div>
        ) : quotes.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-16 h-16 mx-auto text-gray-400" />
            <p className="mt-2 text-gray-600 dark:text-gray-400">No quotes found</p>
            <button
              onClick={onCreateQuote}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create your first quote
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Quote #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Valid Until
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                    onClick={() => onSelectQuote(quote.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {quote.quote_number}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {quote.customer_name}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {quote.customer_company || quote.customer_email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        ${quote.total.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(quote.status)}`}>
                        {getStatusIcon(quote.status)}
                        {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(quote.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(quote.valid_until)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectQuote(quote.id)}
                          className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(quote.status === 'draft' || quote.status === 'sent') && (
                          <button
                            onClick={() => onEditQuote(quote.id)}
                            className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(quote.id)}
                          className="text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {(quote.status === 'draft' || quote.status === 'rejected') && (
                          <button
                            onClick={() => handleDelete(quote.id)}
                            className="text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
