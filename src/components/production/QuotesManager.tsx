import { useState, useEffect } from 'react';
import { FileText, Search, Filter, Plus, Check, X, Clock, Send, Eye, Calendar, DollarSign, Edit, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase-client';
import { QuoteBuilder } from './QuoteBuilder';
import { QuotePreview } from './QuotePreview';

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  created_date: string;
  due_date: string | null;
  valid_until: string | null;
  terms: string;
  customer_billing_name: string | null;
  customer_billing_email: string | null;
  total: number;
  outstanding: number;
  status: string;
}

export function QuotesManager() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | undefined>();
  const [previewQuoteId, setPreviewQuoteId] = useState<string | undefined>();
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadQuotes();
  }, [statusFilter]);

  const loadQuotes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (quoteId: string) => {
    try {
      await supabase
        .from('quotes')
        .update({ status: 'approved' })
        .eq('id', quoteId);
      await loadQuotes();
      setShowApprovalModal(false);
    } catch (error) {
      console.error('Error approving quote:', error);
    }
  };

  const handleReject = async (quoteId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    try {
      await supabase
        .from('quotes')
        .update({
          status: 'rejected',
          internal_notes: rejectionReason
        })
        .eq('id', quoteId);
      await loadQuotes();
      setShowApprovalModal(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting quote:', error);
    }
  };

  const handleCreateQuote = () => {
    setEditingQuoteId(undefined);
    setShowBuilder(true);
  };

  const handleEditQuote = (quoteId: string) => {
    setEditingQuoteId(quoteId);
    setShowBuilder(true);
  };

  const handlePreviewQuote = (quoteId: string) => {
    setPreviewQuoteId(quoteId);
    setShowPreview(true);
  };

  const handleSaveComplete = () => {
    setShowBuilder(false);
    setEditingQuoteId(undefined);
    loadQuotes();
  };

  const handleCancel = () => {
    setShowBuilder(false);
    setEditingQuoteId(undefined);
  };

  const filteredQuotes = quotes.filter(quote =>
    (quote.customer_billing_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800', icon: Clock },
      sent: { label: 'Sent', color: 'bg-blue-100 text-blue-800', icon: Send },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: Check },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: X },
      expired: { label: 'Expired', color: 'bg-orange-100 text-orange-800', icon: Clock },
    };

    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  if (showBuilder) {
    return (
      <QuoteBuilder
        quoteId={editingQuoteId}
        onSave={handleSaveComplete}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quotes & Approvals</h2>
          <p className="text-sm text-gray-600 mt-1">Manage quotes and approval workflow</p>
        </div>
        <button
          onClick={handleCreateQuote}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Quote
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search quotes by customer or quote number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="w-4 h-4" />
              More Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-600">Loading quotes...</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No quotes found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first quote</p>
          <button
            onClick={handleCreateQuote}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Quote
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quote #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredQuotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{quote.quote_number}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{quote.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{quote.customer_billing_name || '-'}</div>
                    {quote.customer_billing_email && (
                      <div className="text-xs text-gray-500">{quote.customer_billing_email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(quote.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
                      <DollarSign className="w-4 h-4" />
                      {quote.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(quote.created_date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handlePreviewQuote(quote.id)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Preview Quote"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditQuote(quote.id)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Quote"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedQuote(quote);
                          setShowApprovalModal(true);
                        }}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {quote.status === 'sent' && (
                        <>
                          <button
                            onClick={() => handleApprove(quote.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedQuote(quote);
                              setShowApprovalModal(true);
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showApprovalModal && selectedQuote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Quote Details</h3>
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setRejectionReason('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Quote Number</label>
                  <p className="text-base font-semibold text-gray-900 mt-1">{selectedQuote.quote_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedQuote.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Title</label>
                  <p className="text-base font-medium text-gray-900 mt-1">{selectedQuote.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Customer</label>
                  <p className="text-base text-gray-900 mt-1">{selectedQuote.customer_billing_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total</label>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    ${selectedQuote.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Outstanding</label>
                  <p className="text-base font-semibold text-gray-900 mt-1">
                    ${selectedQuote.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {selectedQuote.status === 'sent' && (
                <div className="border-t border-gray-200 pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Approval Actions</h4>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleApprove(selectedQuote.id)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Check className="w-5 h-5" />
                      Approve Quote
                    </button>
                    <div className="space-y-2">
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason for rejection..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => handleReject(selectedQuote.id)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <X className="w-5 h-5" />
                        Reject Quote
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPreview && previewQuoteId && (
        <QuotePreview
          quoteId={previewQuoteId}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
