import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Building2, Mail, Phone, Globe, Loader2 } from 'lucide-react';

interface Quote {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_email: string;
  customer_company: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  valid_until: string | null;
  customer_notes: string | null;
  status: string;
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
  artwork_url: string | null;
}

interface CompanySettings {
  company_name: string;
  logo_url: string | null;
  company_logo_primary_url: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
}

interface Approval {
  id: string;
  expires_at: string | null;
  single_use: boolean;
}

export default function PublicQuoteApproval() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [approverName, setApproverName] = useState('');
  const [approverEmail, setApproverEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [approved, setApproved] = useState<boolean | null>(null);

  useEffect(() => {
    loadQuoteApproval();
  }, []);

  const loadQuoteApproval = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get token from URL
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const token = pathParts[pathParts.length - 1];

      if (!token) {
        throw new Error('Invalid approval link');
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-approval/${token}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load quote');
      }

      const data = await response.json();
      setQuote(data.quote);
      setLineItems(data.lineItems || []);
      setCompanySettings(data.companySettings || null);
      setApproval(data.approval);

      // Pre-fill customer email if available
      if (data.quote?.customer_email) {
        setApproverEmail(data.quote.customer_email);
      }
      if (data.quote?.customer_name) {
        setApproverName(data.quote.customer_name);
      }
    } catch (err: any) {
      console.error('Error loading quote:', err);
      setError(err.message || 'Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (isApproved: boolean) => {
    if (!approverName.trim() || !approverEmail.trim()) {
      alert('Please enter your name and email');
      return;
    }

    if (!confirm(isApproved ? 'Approve this quote?' : 'Reject this quote?')) {
      return;
    }

    setSubmitting(true);
    try {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const token = pathParts[pathParts.length - 1];

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-approval/${token}/respond`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approved: isApproved,
          approver_name: approverName,
          approver_email: approverEmail,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit response');
      }

      const data = await response.json();
      setApproved(isApproved);
      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting response:', err);
      alert(err.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isExpired = approval?.expires_at && new Date(approval.expires_at) < new Date();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Error</h1>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          {approved ? (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h1 className="mt-4 text-2xl font-bold text-gray-900">Quote Approved!</h1>
              <p className="mt-2 text-gray-600">
                Thank you for approving quote {quote?.quote_number}. We will begin processing your order shortly.
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h1 className="mt-4 text-2xl font-bold text-gray-900">Quote Rejected</h1>
              <p className="mt-2 text-gray-600">
                Thank you for your response. We have recorded your feedback and will be in touch soon.
              </p>
            </>
          )}
          {companySettings?.company_email && (
            <p className="mt-6 text-sm text-gray-500">
              Questions? Contact us at{' '}
              <a href={`mailto:${companySettings.company_email}`} className="text-blue-600 hover:underline">
                {companySettings.company_email}
              </a>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Company Header */}
        {companySettings && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {(companySettings.company_logo_primary_url || companySettings.logo_url) && (
                  <img
                    src={companySettings.company_logo_primary_url || companySettings.logo_url || ''}
                    alt={companySettings.company_name}
                    className="h-16 w-auto object-contain"
                  />
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{companySettings.company_name}</h1>
                  <div className="mt-2 space-y-1">
                    {companySettings.company_email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${companySettings.company_email}`} className="hover:text-blue-600">
                          {companySettings.company_email}
                        </a>
                      </div>
                    )}
                    {companySettings.company_phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${companySettings.company_phone}`} className="hover:text-blue-600">
                          {companySettings.company_phone}
                        </a>
                      </div>
                    )}
                    {companySettings.company_website && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Globe className="w-4 h-4" />
                        <a href={companySettings.company_website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                          {companySettings.company_website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quote Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Quote {quote.quote_number}</h2>
              <p className="mt-1 text-gray-600">Review and respond to this quote</p>
            </div>
            {isExpired && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                <Clock className="w-4 h-4" />
                Expired
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Customer</h3>
              <div className="space-y-1">
                <p className="text-gray-900 font-medium">{quote.customer_name}</p>
                {quote.customer_company && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {quote.customer_company}
                  </p>
                )}
                {quote.customer_email && (
                  <p className="text-gray-600 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {quote.customer_email}
                  </p>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Quote Details</h3>
              <div className="space-y-1">
                {quote.valid_until && (
                  <p className="text-gray-900">
                    <span className="font-medium">Valid Until:</span> {formatDate(quote.valid_until)}
                  </p>
                )}
                {approval?.single_use && (
                  <p className="text-gray-600 text-sm">This approval link is single-use only</p>
                )}
              </div>
            </div>
          </div>

          {quote.customer_notes && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Notes</h3>
              <p className="text-blue-800 text-sm whitespace-pre-wrap">{quote.customer_notes}</p>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Decoration</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{item.description}</div>
                      {item.artwork_url && (
                        <a
                          href={item.artwork_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View Artwork
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {item.decoration_method && (
                        <div>
                          {item.decoration_method}
                          {item.decoration_location && ` - ${item.decoration_location}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-gray-900">{item.quantity}</td>
                    <td className="px-4 py-4 text-right text-sm text-gray-900">${item.unit_price.toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-sm font-medium text-gray-900">
                      ${item.total_price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mt-6 border-t border-gray-200 pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">${quote.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax ({quote.tax_rate}%):</span>
                  <span className="text-gray-900">${quote.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                  <span className="text-gray-900">Total:</span>
                  <span className="text-gray-900">${quote.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Approval Form */}
        {!isExpired && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Response</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={approverEmail}
                  onChange={(e) => setApproverEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any comments or questions..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  Approve Quote
                </button>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  Reject Quote
                </button>
              </div>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <Clock className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">This Quote Has Expired</h3>
            <p className="text-red-700">
              This approval link expired on {formatDate(approval?.expires_at || null)}.
              Please contact us for an updated quote.
            </p>
            {companySettings?.company_email && (
              <a
                href={`mailto:${companySettings.company_email}`}
                className="inline-block mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Contact Us
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
