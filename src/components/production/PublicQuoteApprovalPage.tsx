import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Mail, Phone, Globe, Clock } from 'lucide-react';

interface ApprovalData {
  quote: Record<string, any>;
  line_items: Record<string, any>[];
  company_settings: Record<string, any>;
  approval_status: string;
  expires_at: string | null;
  is_expired: boolean;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '$0.00';
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function PublicQuoteApprovalPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<ApprovalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<'approved' | 'rejected' | null>(null);
  const [approverName, setApproverName] = useState('');
  const [approverEmail, setApproverEmail] = useState('');
  const [approverNotes, setApproverNotes] = useState('');

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
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to load quote');
      }

      const result = await response.json();
      setData(result);
      if (result.quote?.customer_name) setApproverName(result.quote.customer_name);
      if (result.quote?.customer_email) setApproverEmail(result.quote.customer_email);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (approved: boolean) => {
    if (!approverName.trim() || !approverEmail.trim()) {
      setError('Please enter your name and email.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(approverEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    const action = approved ? 'approve' : 'reject';
    if (!confirm(`Are you sure you want to ${action} this quote?`)) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/quote-approval/${token}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approved,
          approver_name: approverName.trim(),
          approver_email: approverEmail.trim(),
          notes: approverNotes.trim() || null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to submit response');
      }

      setSubmitted(approved ? 'approved' : 'rejected');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Quote</h1>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const isApproved = submitted === 'approved';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-10 text-center">
          <div className={`w-18 h-18 rounded-full ${isApproved ? 'bg-emerald-50' : 'bg-red-50'} flex items-center justify-center mx-auto mb-5`} style={{ width: 72, height: 72 }}>
            {isApproved ? (
              <CheckCircle className="h-9 w-9 text-emerald-600" />
            ) : (
              <XCircle className="h-9 w-9 text-red-500" />
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {isApproved ? 'Quote Approved!' : 'Quote Declined'}
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            {isApproved
              ? 'Thank you for approving this quote. We will begin processing your order shortly.'
              : 'Thank you for your response. We have recorded your feedback and will be in touch.'}
          </p>
          {data?.company_settings?.company_email && (
            <p className="mt-6 text-xs text-gray-400">
              Questions? <a href={`mailto:${data.company_settings.company_email}`} className="text-blue-600 hover:underline">{data.company_settings.company_email}</a>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { quote, line_items, company_settings } = data;

  if (data.approval_status !== 'pending') {
    const statusLabel = data.approval_status === 'approved' ? 'Approved' : data.approval_status === 'rejected' ? 'Rejected' : 'Processed';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-10 text-center">
          <div className={`w-16 h-16 rounded-full ${data.approval_status === 'approved' ? 'bg-emerald-50' : 'bg-amber-50'} flex items-center justify-center mx-auto mb-4`}>
            {data.approval_status === 'approved' ? (
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            ) : (
              <Clock className="h-8 w-8 text-amber-600" />
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Quote Already {statusLabel}</h1>
          <p className="text-gray-500 text-sm">
            This quote has already been {statusLabel.toLowerCase()}. If you need to make changes, please contact us.
          </p>
          {company_settings?.company_email && (
            <a
              href={`mailto:${company_settings.company_email}`}
              className="inline-block mt-6 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Contact Us
            </a>
          )}
        </div>
      </div>
    );
  }

  if (data.is_expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Quote Expired</h1>
          <p className="text-gray-500 text-sm">
            This approval link has expired. Please contact us for an updated quote.
          </p>
          {company_settings?.company_email && (
            <a
              href={`mailto:${company_settings.company_email}`}
              className="inline-block mt-6 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Contact Us
            </a>
          )}
        </div>
      </div>
    );
  }

  const logoUrl = company_settings?.company_logo_primary_url || company_settings?.logo_url;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Company Header */}
        {company_settings?.company_name && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-4 flex-wrap">
              {logoUrl && (
                <img src={logoUrl} alt={company_settings.company_name} className="h-14 w-auto object-contain" />
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-900">{company_settings.company_name}</h1>
                <div className="flex gap-4 flex-wrap mt-1.5">
                  {company_settings.company_email && (
                    <a href={`mailto:${company_settings.company_email}`} className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> {company_settings.company_email}
                    </a>
                  )}
                  {company_settings.company_phone && (
                    <a href={`tel:${company_settings.company_phone}`} className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {company_settings.company_phone}
                    </a>
                  )}
                  {company_settings.company_website && (
                    <a href={company_settings.company_website} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" /> Website
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quote Details */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Quote {quote.quote_number}</h2>
              <p className="text-sm text-gray-500 mt-0.5">Please review the details below and submit your response</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
              Awaiting Response
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Customer</p>
              <p className="text-sm font-semibold text-gray-900">{quote.customer_name || 'N/A'}</p>
              {quote.customer_company && <p className="text-sm text-gray-600">{quote.customer_company}</p>}
              {quote.customer_email && <p className="text-sm text-gray-600">{quote.customer_email}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Quote Details</p>
              {quote.valid_until && (
                <p className="text-sm text-gray-600">Valid Until: <span className="font-medium text-gray-900">{new Date(quote.valid_until).toLocaleDateString()}</span></p>
              )}
              {quote.terms && (
                <p className="text-sm text-gray-600">Terms: <span className="font-medium text-gray-900">{quote.terms}</span></p>
              )}
              {quote.delivery_method && (
                <p className="text-sm text-gray-600">Delivery: <span className="font-medium text-gray-900">{quote.delivery_method}</span></p>
              )}
              <p className="text-sm text-gray-600">Date: <span className="font-medium text-gray-900">{new Date(quote.created_at).toLocaleDateString()}</span></p>
            </div>
          </div>

          {quote.customer_notes && (
            <div className="mt-5 bg-blue-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-800 mb-1">Notes</p>
              <p className="text-sm text-blue-900 whitespace-pre-wrap">{quote.customer_notes}</p>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Description</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Qty</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Unit Price</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {line_items.length > 0 ? line_items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {item.description || item.product_name || 'Item'}
                      {item.decoration_method && (
                        <span className="block text-xs text-gray-400 mt-0.5">
                          {item.decoration_method}{item.decoration_location ? ` - ${item.decoration_location}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{item.quantity || 0}</td>
                    <td className="py-3 px-4 text-sm text-right text-gray-900">{formatCurrency(item.unit_price)}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-gray-900">{formatCurrency(item.total_price)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-gray-400">No items</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-5">
            <div className="w-72">
              <div className="flex justify-between py-1.5 text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(quote.subtotal)}</span>
              </div>
              {(quote.discount || 0) > 0 && (
                <div className="flex justify-between py-1.5 text-sm text-gray-500">
                  <span>Discount</span>
                  <span className="text-emerald-600">-{formatCurrency(quote.discount)}</span>
                </div>
              )}
              {(quote.tax_amount || 0) > 0 && (
                <div className="flex justify-between py-1.5 text-sm text-gray-500">
                  <span>Tax{quote.tax_rate ? ` (${quote.tax_rate}%)` : ''}</span>
                  <span>{formatCurrency(quote.tax_amount)}</span>
                </div>
              )}
              {(quote.ship || 0) > 0 && (
                <div className="flex justify-between py-1.5 text-sm text-gray-500">
                  <span>Shipping</span>
                  <span>{formatCurrency(quote.ship)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 mt-2 border-t-2 border-gray-200 text-lg font-bold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Approval Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-5">Your Response</h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Your Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={approverEmail}
                onChange={(e) => setApproverEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              value={approverNotes}
              onChange={(e) => setApproverNotes(e.target.value)}
              placeholder="Add any comments or questions..."
              rows={3}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-vertical"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleResponse(true)}
              disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
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
              onClick={() => handleResponse(false)}
              disabled={submitting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
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
  );
}
