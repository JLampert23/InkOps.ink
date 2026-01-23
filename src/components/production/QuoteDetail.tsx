import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  ArrowLeft,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  Clock,
  User,
  Mail,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface QuoteDetailProps {
  quoteId: string;
  onBack: () => void;
  onEdit: () => void;
}

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string;
  customer_company: string;
  customer_phone: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: string;
  valid_until: string | null;
  created_at: string;
  sent_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  customer_notes: string | null;
  notes: string | null;
}

interface LineItem {
  id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  decoration_method: string | null;
  decoration_location: string | null;
}

interface Approval {
  id: string;
  approval_token: string;
  expires_at: string | null;
  single_use: boolean;
  is_used: boolean;
  created_at: string;
  responses: ApprovalResponse[];
}

interface ApprovalResponse {
  id: string;
  approved: boolean;
  approver_name: string;
  approver_email: string;
  notes: string | null;
  responded_at: string;
  ip_address: string | null;
}

interface ActivityLog {
  id: string;
  action: string;
  performed_by_name: string | null;
  performed_at: string;
  meta: any;
}

export default function QuoteDetail({ quoteId, onBack, onEdit }: QuoteDetailProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);

  const [expiresInDays, setExpiresInDays] = useState(30);
  const [singleUse, setSingleUse] = useState(true);
  const [autoApproveAfterDays, setAutoApproveAfterDays] = useState<number | null>(null);
  const [autoConvertOnApproval, setAutoConvertOnApproval] = useState(false);

  useEffect(() => {
    loadQuoteDetails();
  }, [quoteId]);

  const loadQuoteDetails = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quotes-api/${quoteId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load quote');
      }

      const data = await response.json();
      setQuote(data.quote);
      setLineItems(data.lineItems || []);
      setApprovals(data.approvals || []);
      setActivityLog(data.activityLog || []);
    } catch (error) {
      console.error('Error loading quote:', error);
      alert('Failed to load quote details');
    } finally {
      setLoading(false);
    }
  };

  const handleSendApproval = async () => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-actions/${quoteId}/send`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expires_in_days: expiresInDays,
          single_use: singleUse,
          auto_approve_after_days: autoApproveAfterDays,
          auto_convert_on_approval: autoConvertOnApproval,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send approval link');
      }

      const data = await response.json();

      // Copy link to clipboard
      await navigator.clipboard.writeText(data.approvalUrl);

      alert('Approval link created and copied to clipboard!');
      setShowSendModal(false);
      loadQuoteDetails();
    } catch (error) {
      console.error('Error sending approval:', error);
      alert('Failed to send approval link');
    } finally {
      setSending(false);
    }
  };

  const handleConvert = async () => {
    if (!confirm('Convert this quote to a production job?')) return;

    setConverting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-actions/${quoteId}/convert`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to convert quote');
      }

      alert('Quote converted to production job!');
      loadQuoteDetails();
    } catch (error) {
      console.error('Error converting quote:', error);
      alert('Failed to convert quote');
    } finally {
      setConverting(false);
    }
  };

  const copyApprovalLink = async (token: string) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-approval/${token}`;
    await navigator.clipboard.writeText(url);
    alert('Approval link copied to clipboard!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-yellow-100 text-yellow-800';
      case 'converted':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400">Quote not found</p>
        <button onClick={onBack} className="mt-4 text-blue-600 dark:text-blue-400 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Quote {quote.quote_number}
            </h1>
            <span className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(quote.status)}`}>
              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(quote.status === 'draft' || quote.status === 'sent') && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-gray-300"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          {quote.status === 'draft' && (
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              Send for Approval
            </button>
          )}
          {quote.status === 'approved' && !quote.status.includes('converted') && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Convert to Production
            </button>
          )}
          <button
            onClick={loadQuoteDetails}
            className="p-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Customer Info */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
            <p className="text-gray-900 dark:text-white font-medium">{quote.customer_name}</p>
          </div>
          {quote.customer_company && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Company</p>
              <p className="text-gray-900 dark:text-white">{quote.customer_company}</p>
            </div>
          )}
          {quote.customer_email && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-gray-900 dark:text-white">{quote.customer_email}</p>
            </div>
          )}
          {quote.customer_phone && (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
              <p className="text-gray-900 dark:text-white">{quote.customer_phone}</p>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Line Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Decoration</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{item.line_number}</td>
                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">{item.description}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {item.decoration_method && (
                      <div>
                        {item.decoration_method}
                        {item.decoration_location && ` - ${item.decoration_location}`}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-gray-900 dark:text-white">{item.quantity}</td>
                  <td className="px-4 py-4 text-right text-sm text-gray-900 dark:text-white">${item.unit_price.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                    ${item.total_price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-6 border-t border-gray-200 dark:border-slate-700 pt-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                <span className="text-gray-900 dark:text-white">${quote.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Tax ({quote.tax_rate}%):</span>
                <span className="text-gray-900 dark:text-white">${quote.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-slate-700 pt-2">
                <span className="text-gray-900 dark:text-white">Total:</span>
                <span className="text-gray-900 dark:text-white">${quote.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Links */}
      {approvals.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Approval Links</h2>
          <div className="space-y-4">
            {approvals.map((approval) => (
              <div key={approval.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {approval.is_used ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-blue-500" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {approval.is_used ? 'Used' : 'Active'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Created: {formatDateTime(approval.created_at)}
                    </p>
                    {approval.expires_at && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Expires: {formatDateTime(approval.expires_at)}
                      </p>
                    )}
                    {approval.single_use && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Single-use link</p>
                    )}
                  </div>
                  <button
                    onClick={() => copyApprovalLink(approval.approval_token)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </button>
                </div>

                {/* Responses */}
                {approval.responses && approval.responses.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Responses:</h4>
                    <div className="space-y-3">
                      {approval.responses.map((response) => (
                        <div
                          key={response.id}
                          className={`p-3 rounded-lg ${
                            response.approved
                              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            {response.approved ? (
                              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {response.approved ? 'Approved' : 'Rejected'} by {response.approver_name}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{response.approver_email}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {formatDateTime(response.responded_at)}
                              </p>
                              {response.notes && (
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 italic">
                                  "{response.notes}"
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Log */}
      {activityLog.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h2>
          <div className="space-y-3">
            {activityLog.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-600 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-white">
                    <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                    {log.performed_by_name && <span className="text-gray-600 dark:text-gray-400"> by {log.performed_by_name}</span>}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{formatDateTime(log.performed_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Approval Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Send Approval Link</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expires In (Days)
                </label>
                <input
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  min="1"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="singleUse"
                  checked={singleUse}
                  onChange={(e) => setSingleUse(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="singleUse" className="text-sm text-gray-700 dark:text-gray-300">
                  Single-use link (expires after first response)
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Auto-Approve After (Days) - Optional
                </label>
                <input
                  type="number"
                  value={autoApproveAfterDays || ''}
                  onChange={(e) => setAutoApproveAfterDays(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Leave empty to disable"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  min="1"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoConvert"
                  checked={autoConvertOnApproval}
                  onChange={(e) => setAutoConvertOnApproval(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="autoConvert" className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-convert to production job when approved
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendApproval}
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
