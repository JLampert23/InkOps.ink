import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  notes: string;
  created_at: string;
}

interface QuoteLineItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface CompanySettings {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  company_logo_url?: string;
}

interface ApprovalData {
  quote: Quote;
  line_items: QuoteLineItem[];
  company_settings: CompanySettings;
  approval_status: string;
}

export default function PublicQuoteApprovalPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<ApprovalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const token = window.location.pathname.split('/').pop();

  useEffect(() => {
    loadApprovalData();
  }, []);

  const loadApprovalData = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/quote-approval/${token}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load quote');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (action: 'approve' | 'reject') => {
    setSubmitting(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/quote-approval/${token}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit response');
      }

      const result = await response.json();
      setSuccess(result.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Success</h1>
          <p className="text-gray-600">{success}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { quote, line_items, company_settings } = data;

  if (data.approval_status !== 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Quote Already {data.approval_status === 'approved' ? 'Approved' : 'Rejected'}
          </h1>
          <p className="text-gray-600">
            This quote has already been {data.approval_status}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8">
            {company_settings.company_logo_url && (
              <img
                src={company_settings.company_logo_url}
                alt={company_settings.company_name}
                className="h-16 mb-4"
              />
            )}
            <h1 className="text-3xl font-bold mb-2">Quote Review & Approval</h1>
            <p className="text-blue-100">Quote #{quote.quote_number}</p>
          </div>

          {/* Company Info */}
          {company_settings.company_name && (
            <div className="border-b border-gray-200 p-6 bg-gray-50">
              <h2 className="font-semibold text-gray-900 mb-2">{company_settings.company_name}</h2>
              {company_settings.company_address && (
                <p className="text-sm text-gray-600">{company_settings.company_address}</p>
              )}
              <div className="flex gap-4 mt-2 text-sm text-gray-600">
                {company_settings.company_phone && <span>{company_settings.company_phone}</span>}
                {company_settings.company_email && <span>{company_settings.company_email}</span>}
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Name:</span>
                <span className="ml-2 text-gray-900 font-medium">{quote.customer_name}</span>
              </div>
              <div>
                <span className="text-gray-600">Email:</span>
                <span className="ml-2 text-gray-900">{quote.customer_email}</span>
              </div>
              {quote.customer_phone && (
                <div>
                  <span className="text-gray-600">Phone:</span>
                  <span className="ml-2 text-gray-900">{quote.customer_phone}</span>
                </div>
              )}
              <div>
                <span className="text-gray-600">Date:</span>
                <span className="ml-2 text-gray-900">
                  {new Date(quote.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Quote Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Item</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Qty</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Unit Price</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {line_items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-sm text-gray-900">{item.product_name}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900">{item.quantity}</td>
                      <td className="py-3 px-4 text-sm text-right text-gray-900">
                        ${item.unit_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium text-gray-900">
                        ${item.total_price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="py-4 px-4 text-right font-semibold text-gray-900">
                      Total Amount:
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-xl text-gray-900">
                      ${quote.total_amount.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-6 bg-gray-50">
            <p className="text-sm text-gray-600 mb-4">
              Please review the quote above and select your response:
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => handleResponse('approve')}
                disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Approve Quote
                  </>
                )}
              </button>
              <button
                onClick={() => handleResponse('reject')}
                disabled={submitting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <XCircle className="h-5 w-5" />
                    Reject Quote
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
