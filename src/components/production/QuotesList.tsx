import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { FileText, Search, Plus, Clock, Send, CheckCircle, XCircle, AlertCircle, Loader2, CreditCard as Edit, Eye, Copy, RefreshCw, Trash2, Mail } from 'lucide-react';
import { format } from 'date-fns';

interface QuotesListProps {
  onSelectQuote: (quoteId: string) => void;
  onCreateQuote: () => void;
  onEditQuote: (quoteId: string) => void;
}

interface Quote {
  id: string;
  quote_number: string | null;
  customer_name: string | null;
  customer_company: string | null;
  customer_email: string | null;
  contact_name: string | null;
  total: number | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  approved_at: string | null;
  valid_until: string | null;
  followup_count: number | null;
  last_followup_sent_at: string | null;
  next_followup_due_at: string | null;
}

export default function QuotesList({ onSelectQuote, onCreateQuote, onEditQuote }: QuotesListProps) {
  const { showNotification } = useNotification();
  const { confirm } = useConfirmation();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sendingFollowup, setSendingFollowup] = useState<string | null>(null);

  useEffect(() => {
    loadQuotes();

    const channel = supabase
      .channel('quotes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
        },
        () => {
          loadQuotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          customer_name,
          customer_company,
          customer_email,
          total,
          status,
          created_at,
          sent_at,
          approved_at,
          valid_until,
          followup_count,
          last_followup_sent_at,
          next_followup_due_at,
          customer_contacts(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = (data || []).map(quote => ({
        ...quote,
        contact_name: (quote.customer_contacts as { full_name: string } | null)?.full_name || null
      }));

      setQuotes(formattedData);
    } catch (error) {
      console.error('Error loading quotes:', error);
      showNotification('Failed to load quotes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (quoteId: string) => {
    const confirmed = await confirm({
      title: 'Duplicate Quote',
      message: 'Create a copy of this quote?',
      confirmLabel: 'Duplicate',
      variant: 'info',
    });
    if (!confirmed) return;

    setDuplicating(quoteId);
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session check before duplicate:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
      });

      if (!session) {
        throw new Error('You must be logged in to duplicate quotes');
      }

      console.log('Invoking duplicate function for quote:', quoteId);
      console.log('Token preview:', session.access_token.substring(0, 50) + '...');

      const { data, error } = await supabase.functions.invoke(`quote-actions/${quoteId}/duplicate`, {
        method: 'POST',
      });

      console.log('Duplicate response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to duplicate quote');
      }

      showNotification(`Quote duplicated as ${data.quote.quote_number}`, 'success');
      loadQuotes();
    } catch (error: any) {
      console.error('Error duplicating quote:', error);
      showNotification(error.message || 'Failed to duplicate quote', 'error');
    } finally {
      setDuplicating(null);
    }
  };

  const handleDelete = async (quoteId: string, quoteNumber: string) => {
    const confirmed = await confirm({
      title: 'Delete Quote',
      message: `Are you sure you want to delete quote ${quoteNumber}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    setDeleting(quoteId);
    try {
      // Delete related records first (cascade delete)
      await supabase.from('quote_line_items').delete().eq('quote_id', quoteId);
      await supabase.from('quote_fees').delete().eq('quote_id', quoteId);
      await supabase.from('quote_imprints').delete().eq('quote_id', quoteId);
      await supabase.from('quote_approvals').delete().eq('quote_id', quoteId);

      // Delete the quote
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;

      showNotification(`Quote ${quoteNumber} deleted successfully`, 'success');
      loadQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      showNotification('Failed to delete quote', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleSendFollowup = async (quoteId: string, quoteNumber: string | null) => {
    const confirmed = await confirm({
      title: 'Send Follow-Up',
      message: `Send a follow-up email for quote ${quoteNumber || 'N/A'}?`,
      confirmLabel: 'Send Follow-Up',
      variant: 'info',
    });
    if (!confirmed) return;

    setSendingFollowup(quoteId);
    try {
      // Get current followup count
      const { data: quoteData, error: fetchError } = await supabase
        .from('quotes')
        .select('followup_count')
        .eq('id', quoteId)
        .single();

      if (fetchError) throw fetchError;

      const currentCount = quoteData?.followup_count || 0;
      const newCount = currentCount + 1;

      // Update quote with new followup count and timestamp
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          followup_count: newCount,
          last_followup_sent_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (updateError) throw updateError;

      // Queue follow-up in automation queue
      const { error: queueError } = await supabase
        .from('automation_queue')
        .insert({
          automation_type: 'quote_followup',
          entity_type: 'quote',
          entity_id: quoteId,
          status: 'pending',
          data: {
            quote_id: quoteId,
            followup_number: newCount,
          },
        });

      if (queueError) throw queueError;

      showNotification(`Follow-up #${newCount} queued for ${quoteNumber}`, 'success');
      loadQuotes();
    } catch (error) {
      console.error('Error sending follow-up:', error);
      showNotification('Failed to send follow-up', 'error');
    } finally {
      setSendingFollowup(null);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft':
        return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Clock, label: 'Unsent' };
      case 'sent':
        return { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Send, label: 'Sent' };
      case 'approved':
        return { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle, label: 'Approved' };
      case 'rejected':
        return { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Rejected' };
      case 'expired':
        return { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle, label: 'Expired' };
      case 'converted':
        return { color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400', icon: CheckCircle, label: 'Converted' };
      default:
        return { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', icon: Clock, label: status };
    }
  };

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      (quote.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (quote.quote_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (quote.customer_company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (quote.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (quote.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'active') {
      matchesStatus = ['draft', 'sent'].includes(quote.status);
    } else if (statusFilter === 'approved') {
      matchesStatus = ['approved', 'converted'].includes(quote.status);
    } else {
      matchesStatus = quote.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const stats = {
    active: quotes.filter(q => ['draft', 'sent'].includes(q.status)).length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    approved: quotes.filter(q => ['approved', 'converted'].includes(q.status)).length,
    rejected: quotes.filter(q => q.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Quotes & Approvals</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Create and manage customer quotes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadQuotes}
            disabled={loading}
            className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onCreateQuote}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Create Quote</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <button
          onClick={() => setStatusFilter('active')}
          className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border transition-all ${
            statusFilter === 'active'
              ? 'border-gray-900 dark:border-white ring-2 ring-gray-900 dark:ring-white'
              : 'border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-500'
          } p-3 text-left cursor-pointer`}
        >
          <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.active}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Active</div>
        </button>
        <button
          onClick={() => setStatusFilter('draft')}
          className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border transition-all ${
            statusFilter === 'draft'
              ? 'border-gray-600 dark:border-gray-400 ring-2 ring-gray-600 dark:ring-gray-400'
              : 'border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-500'
          } p-3 text-left cursor-pointer`}
        >
          <div className="text-xl font-bold text-gray-600 dark:text-gray-400">{stats.draft}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Unsent</div>
        </button>
        <button
          onClick={() => setStatusFilter('sent')}
          className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border transition-all ${
            statusFilter === 'sent'
              ? 'border-blue-600 dark:border-blue-400 ring-2 ring-blue-600 dark:ring-blue-400'
              : 'border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-500'
          } p-3 text-left cursor-pointer`}
        >
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.sent}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Sent</div>
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border transition-all ${
            statusFilter === 'approved'
              ? 'border-green-600 dark:border-green-400 ring-2 ring-green-600 dark:ring-green-400'
              : 'border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-500'
          } p-3 text-left cursor-pointer`}
        >
          <div className="text-xl font-bold text-green-600 dark:text-green-400">{stats.approved}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Approved</div>
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border transition-all ${
            statusFilter === 'rejected'
              ? 'border-red-600 dark:border-red-400 ring-2 ring-red-600 dark:ring-red-400'
              : 'border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-500'
          } p-3 text-left cursor-pointer`}
        >
          <div className="text-xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Rejected</div>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer, quote number, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
            >
              <option value="active">Active (Unsent + Sent)</option>
              <option value="all">All Quotes</option>
              <option value="draft">Unsent</option>
              <option value="sent">Sent</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-16 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading quotes...</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-16 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No quotes found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your filters to see more results'
              : 'Get started by creating your first customer quote'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={onCreateQuote}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Create Your First Quote
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Quote #
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredQuotes.map((quote) => {
                  const statusConfig = getStatusConfig(quote.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <tr
                      key={quote.id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={() => onSelectQuote(quote.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{quote.quote_number || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{quote.customer_name || 'N/A'}</div>
                          {quote.contact_name && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{quote.contact_name}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">${(quote.total ?? 0).toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {format(new Date(quote.created_at), 'MMM d, yyyy')}
                        </div>
                        {quote.valid_until && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Valid until {format(new Date(quote.valid_until), 'MMM d')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onSelectQuote(quote.id)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(quote.status === 'sent' || quote.status === 'pending') && (
                            <button
                              onClick={() => handleSendFollowup(quote.id, quote.quote_number)}
                              disabled={sendingFollowup === quote.id}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                              title={quote.followup_count ? `Send Follow-Up (${quote.followup_count} sent)` : 'Send Follow-Up'}
                            >
                              {sendingFollowup === quote.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'rejected') && (
                            <button
                              onClick={() => onEditQuote(quote.id)}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Edit Quote"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDuplicate(quote.id)}
                            disabled={duplicating === quote.id}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Duplicate Quote"
                          >
                            {duplicating === quote.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(quote.id, quote.quote_number || 'N/A')}
                            disabled={deleting === quote.id}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete Quote"
                          >
                            {deleting === quote.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredQuotes.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredQuotes.length} of {quotes.length} quotes
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
