import { useState, useEffect } from 'react';
import { PortalLayout } from './PortalLayout';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { supabase } from '../../lib/supabase-client';
import { FileText, CheckCircle, XCircle, Eye, Loader2, Download } from 'lucide-react';

interface Quote {
  id: string;
  quote_number: string;
  created_date: string;
  expiry_date: string | null;
  total_amount: number;
  status: string;
  customer_name: string;
  customer_email: string;
  notes: string | null;
}

export function PortalQuotes() {
  const { user } = useCustomerPortal();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (user) {
      loadQuotes();
    }
  }, [user]);

  const loadQuotes = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, created_date, expiry_date, total_amount, status, customer_name, customer_email, notes')
        .eq('company_id', user!.company_id)
        .eq('customer_email', user!.email)
        .order('created_date', { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleApprove = async (quoteId: string) => {
    setApproving(true);
    try {
      const token = localStorage.getItem('customer_portal_token');
      if (!token) {
        alert('Session expired. Please log in again.');
        return;
      }

      window.location.href = `/quote-approval/${token}`;
    } catch (error) {
      console.error('Error approving quote:', error);
      alert('Failed to approve quote. Please try again.');
    } finally {
      setApproving(false);
    }
  };

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote);
  };

  if (loading) {
    return (
      <PortalLayout activeTab="quotes">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </PortalLayout>
    );
  }

  if (selectedQuote) {
    return (
      <PortalLayout activeTab="quotes">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Quote {selectedQuote.quote_number}
            </h2>
            <button
              onClick={() => setSelectedQuote(null)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Quotes
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Quote Date</p>
                <p className="text-base font-medium text-gray-900">
                  {new Date(selectedQuote.created_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Expiry Date</p>
                <p className="text-base font-medium text-gray-900">
                  {selectedQuote.expiry_date
                    ? new Date(selectedQuote.expiry_date).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-base font-medium text-gray-900">
                  ${selectedQuote.total_amount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedQuote.status)}`}>
                  {selectedQuote.status}
                </span>
              </div>
            </div>

            {selectedQuote.notes && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Notes</p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-900">{selectedQuote.notes}</p>
                </div>
              </div>
            )}

            {selectedQuote.status === 'sent' && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(selectedQuote.id)}
                  disabled={approving}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" />
                  {approving ? 'Processing...' : 'Approve Quote'}
                </button>
                <button
                  className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout activeTab="quotes">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Your Quotes</h1>
        </div>

        {quotes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No quotes found</h3>
            <p className="text-gray-600">You don't have any quotes yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quote
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expiry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {quote.quote_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {new Date(quote.created_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {quote.expiry_date
                          ? new Date(quote.expiry_date).toLocaleDateString()
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${quote.total_amount.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(quote.status)}`}>
                        {quote.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewQuote(quote)}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="View Quote"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {quote.status === 'sent' && (
                          <button
                            onClick={() => handleApprove(quote.id)}
                            disabled={approving}
                            className="text-green-600 hover:text-green-700 p-1 disabled:opacity-50"
                            title="Approve Quote"
                          >
                            <CheckCircle className="w-4 h-4" />
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
    </PortalLayout>
  );
}
