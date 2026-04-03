import { useState, useEffect } from 'react';
import { PortalLayout } from './PortalLayout';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { FileText, CheckCircle, XCircle, Eye, Loader2 } from 'lucide-react';
import { PortalQuoteViewerModal } from './PortalQuoteViewerModal';

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
  const [viewingQuoteId, setViewingQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadQuotes();
    }
  }, [user]);

  const loadQuotes = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem('customer_portal_token');
      if (!token) {
        throw new Error('No portal session found');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?type=quotes`,
        {
          headers: {
            'X-Customer-Token': token,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load quotes');
      }

      const result = await response.json();

      const mappedQuotes = (result.data || []).map((q: any) => ({
        id: q.id,
        quote_number: q.quote_number,
        created_date: q.created_at,
        expiry_date: q.expiry_date,
        total_amount: parseFloat(q.total || q.subtotal || 0) + (q.total ? 0 : parseFloat(q.tax_amount || 0)),
        status: q.status,
        customer_name: q.customer_name,
        customer_email: q.customer_email,
        notes: q.notes
      }));

      setQuotes(mappedQuotes);
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

  const handleViewQuote = (quoteId: string) => {
    setViewingQuoteId(quoteId);
  };

  const handleModalClose = () => {
    setViewingQuoteId(null);
  };

  const handleApprovalComplete = () => {
    setViewingQuoteId(null);
    loadQuotes();
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

  return (
    <>
      {viewingQuoteId && (
        <PortalQuoteViewerModal
          quoteId={viewingQuoteId}
          onClose={handleModalClose}
          onApprovalComplete={handleApprovalComplete}
        />
      )}
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
                          onClick={() => handleViewQuote(quote.id)}
                          className="text-blue-600 hover:text-blue-700 p-1.5 hover:bg-blue-50 rounded transition-colors"
                          title="View Quote"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {quote.status === 'sent' && (
                          <button
                            onClick={() => handleViewQuote(quote.id)}
                            className="text-green-600 hover:text-green-700 p-1.5 hover:bg-green-50 rounded transition-colors"
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
    </>
  );
}
