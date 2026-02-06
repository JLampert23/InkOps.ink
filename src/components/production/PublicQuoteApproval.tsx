import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Mail, Phone, Globe, Loader2 } from 'lucide-react';

interface PublicQuoteApprovalProps {
  token: string;
}

export default function PublicQuoteApproval({ token }: PublicQuoteApprovalProps) {
  const [quote, setQuote] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [approval, setApproval] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approverName, setApproverName] = useState('');
  const [approverEmail, setApproverEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [wasApproved, setWasApproved] = useState(false);

  useEffect(() => {
    loadQuoteApproval();
  }, [token]);

  const loadQuoteApproval = async () => {
    setLoading(true);
    setError(null);
    try {
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

      if (data.quote?.customer_email) setApproverEmail(data.quote.customer_email);
      if (data.quote?.customer_name) setApproverName(data.quote.customer_name);
    } catch (err: any) {
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

    const action = isApproved ? 'approve' : 'reject';
    if (!confirm(`Are you sure you want to ${action} this quote?`)) return;

    setSubmitting(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-approval/${token}/respond`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      setWasApproved(isApproved);
      setSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isExpired = approval?.expires_at && new Date(approval.expires_at) < new Date();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Unable to Load Quote</h1>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          {wasApproved ? (
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
              <h1 className="mt-4 text-2xl font-bold text-gray-900">Quote Declined</h1>
              <p className="mt-2 text-gray-600">
                Thank you for your response. We have recorded your feedback and will be in touch.
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

  if (!quote) return null;

  const items = lineItems.filter(item => item.line_type === 'item' || !item.line_type);
  const fees = lineItems.filter(item => item.line_type === 'fee');
  const imprints = lineItems.filter(item => item.line_type === 'imprint');

  const groupedItems = items.reduce((acc: Record<string, any[]>, item) => {
    const groupLabel = item.group_label || '';
    if (!acc[groupLabel]) acc[groupLabel] = [];
    acc[groupLabel].push(item);
    return acc;
  }, {});

  const totalQty = items.reduce((sum, item) => {
    return sum + (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
           (item.qty_yl || 0) + (item.qty_yxl || 0) + (item.qty_xs || 0) +
           (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) +
           (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
           (item.qty_4xl || 0);
  }, 0);

  const itemTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const feesTotal = fees.reduce((sum, item) => sum + (item.total_price || 0), 0);

  const logoUrl = companySettings?.company_logo_primary_url || companySettings?.logo_url || '';

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Company Header Bar */}
        <div className="bg-white rounded-lg shadow-sm p-5 mb-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img src={logoUrl} alt={companySettings?.company_name} className="h-14 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{companySettings?.company_name || 'Quote'}</h1>
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                {companySettings?.company_email && (
                  <a href={`mailto:${companySettings.company_email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                    <Mail className="w-3 h-3" /> {companySettings.company_email}
                  </a>
                )}
                {companySettings?.company_phone && (
                  <a href={`tel:${companySettings.company_phone}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                    <Phone className="w-3 h-3" /> {companySettings.company_phone}
                  </a>
                )}
                {companySettings?.company_website && (
                  <a href={companySettings.company_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                    <Globe className="w-3 h-3" /> Website
                  </a>
                )}
              </div>
            </div>
          </div>
          {isExpired ? (
            <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
              <Clock className="w-4 h-4" /> Expired
            </span>
          ) : (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
              Awaiting Your Response
            </span>
          )}
        </div>

        {/* Quote Document */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="p-6" style={{ fontSize: '9pt' }}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-300">
              <div>
                <h1 className="text-lg font-bold text-gray-900 mb-0.5">{quote.quote_number}</h1>
                <p className="text-sm text-gray-600 uppercase">{quote.customer_name}</p>
              </div>
            </div>

            {/* Company Info and Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex gap-3">
                {quote.company_logo_url && (
                  <img src={quote.company_logo_url} alt="Logo" className="h-16 w-auto object-contain" />
                )}
                <div className="text-xs leading-tight">
                  <h2 className="font-bold text-gray-900 uppercase mb-0.5">
                    {quote.company_name || companySettings?.company_name || ''}
                  </h2>
                  <div className="text-gray-700 space-y-0">
                    {quote.company_address && <p>{quote.company_address}</p>}
                    {quote.company_city && (
                      <p>{quote.company_city}, {quote.company_state || ''} {quote.company_zip || ''}</p>
                    )}
                    {quote.company_phone && <p>{quote.company_phone}</p>}
                    {quote.company_website && <p className="text-blue-600">{quote.company_website}</p>}
                    {quote.company_email && <p className="text-blue-600">{quote.company_email}</p>}
                  </div>
                </div>
              </div>

              <div>
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="py-0.5 pr-2 font-semibold text-gray-700">Delivery Method</td>
                      <td className="py-0.5 text-right">{quote.delivery_method || 'PICK-UP'}</td>
                    </tr>
                    {quote.po_number && (
                      <tr className="border-b border-gray-200">
                        <td className="py-0.5 pr-2 font-semibold text-gray-700">PO #</td>
                        <td className="py-0.5 text-right">{quote.po_number}</td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-200">
                      <td className="py-0.5 pr-2 font-semibold text-gray-700">Created</td>
                      <td className="py-0.5 text-right">
                        {formatDate(quote.created_at)}
                      </td>
                    </tr>
                    {quote.valid_until && (
                      <tr className="border-b border-gray-200">
                        <td className="py-0.5 pr-2 font-semibold text-gray-700">Customer Due Date</td>
                        <td className="py-0.5 text-right">{formatDate(quote.valid_until)}</td>
                      </tr>
                    )}
                    {quote.invoice_date && (
                      <tr className="border-b border-gray-200">
                        <td className="py-0.5 pr-2 font-semibold text-gray-700">Invoice Date</td>
                        <td className="py-0.5 text-right">{formatDate(quote.invoice_date)}</td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-200">
                      <td className="py-0.5 pr-2 font-semibold text-gray-700">Terms</td>
                      <td className="py-0.5 text-right">{quote.terms || 'Net 30'}</td>
                    </tr>
                    {quote.payment_due_date && (
                      <tr className="border-b border-gray-200">
                        <td className="py-0.5 pr-2 font-semibold text-gray-700">Payment Due Date</td>
                        <td className="py-0.5 text-right">{formatDate(quote.payment_due_date)}</td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-200">
                      <td className="py-0.5 pr-2 font-bold text-gray-900">Total</td>
                      <td className="py-0.5 text-right font-bold">${(quote.total || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Customer Info Grid */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <h3 className="font-bold text-gray-900 mb-1 text-xs">Customer Billing</h3>
                <div className="text-xs text-gray-700 leading-tight space-y-0">
                  <p>{quote.customer_name}</p>
                  {quote.customer_company && <p>{quote.customer_company}</p>}
                  {quote.bill_address_1 && <p>{quote.bill_address_1}</p>}
                  {quote.bill_city && (
                    <p>{quote.bill_city}, {quote.bill_state || ''} {quote.bill_zip || ''}</p>
                  )}
                  {(quote.customer_phone || quote.bill_phone) && <p>{quote.customer_phone || quote.bill_phone}</p>}
                  {quote.customer_email && <p className="text-blue-600">{quote.customer_email}</p>}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1 text-xs">Customer Shipping</h3>
                <div className="text-xs text-gray-700 leading-tight space-y-0">
                  {quote.ship_name && <p>{quote.ship_name}</p>}
                  {quote.ship_company && <p>{quote.ship_company}</p>}
                  {quote.ship_address_1 && <p>{quote.ship_address_1}</p>}
                  {quote.ship_city && (
                    <p>{quote.ship_city}, {quote.ship_state || ''} {quote.ship_zip || ''}</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1 text-xs">Customer Notes</h3>
                <div className="text-xs text-gray-700 leading-tight">
                  {quote.customer_notes && <p>{quote.customer_notes}</p>}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            {items.length > 0 && (
              <div className="mb-3 overflow-x-auto">
                <table className="w-full border-collapse border border-gray-400" style={{ fontSize: '8pt' }}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 px-1 py-0.5 text-left font-semibold">Item #</th>
                      <th className="border border-gray-400 px-1 py-0.5 text-left font-semibold">Color</th>
                      <th className="border border-gray-400 px-1 py-0.5 text-left font-semibold">Description</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>YXS</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>YS</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>YM</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>YL</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>YXL</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>XS</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>S</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>M</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>L</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>XL</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>2XL</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>3XL</th>
                      <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>4XL</th>
                      <th className="border border-gray-400 px-1 py-0.5 text-center font-semibold">Qty</th>
                      <th className="border border-gray-400 px-1 py-0.5 text-right font-semibold">Unit Price</th>
                      <th className="border border-gray-400 px-1 py-0.5 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedItems).map(([groupLabel, groupItems], groupIdx) => (
                      <>
                        {groupLabel && (
                          <tr key={`group-${groupIdx}`} className="bg-gray-200">
                            <td colSpan={19} className="border border-gray-400 px-2 py-1 font-bold text-gray-900">
                              {groupLabel}
                            </td>
                          </tr>
                        )}
                        {(groupItems as any[]).map((item, idx) => {
                          const rowQty = (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
                                        (item.qty_yl || 0) + (item.qty_yxl || 0) + (item.qty_xs || 0) +
                                        (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) +
                                        (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
                                        (item.qty_4xl || 0);
                          return (
                            <tr key={`${groupIdx}-${idx}`}>
                              <td className="border border-gray-400 px-1 py-0.5">{item.item_number || ''}</td>
                              <td className="border border-gray-400 px-1 py-0.5">{item.color || ''}</td>
                              <td className="border border-gray-400 px-1 py-0.5">{item.description}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_yxs || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_ys || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_ym || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_yl || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_yxl || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_xs || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_s || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_m || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_l || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_xl || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_2xl || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_3xl || ''}</td>
                              <td className="border border-gray-400 px-0.5 py-0.5 text-center">{item.qty_4xl || ''}</td>
                              <td className="border border-gray-400 px-1 py-0.5 text-center">{rowQty}</td>
                              <td className="border border-gray-400 px-1 py-0.5 text-right">${(item.unit_price || 0).toFixed(2)}</td>
                              <td className="border border-gray-400 px-1 py-0.5 text-right">${(item.total_price || 0).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Imprint Section */}
            {imprints.length > 0 && (
              <div className="mb-3">
                {imprints.map((imprint, idx) => (
                  <div key={idx} className="mb-2">
                    <h4 className="font-bold text-xs text-gray-900 mb-0.5">
                      IMPRINT #{imprint.imprint_number || `${quote.quote_number}-${idx + 1}`}
                    </h4>
                    {imprint.decoration_method && (
                      <p className="text-xs text-gray-700 font-medium uppercase mb-1">{imprint.decoration_method}</p>
                    )}
                    {imprint.artwork_url && (
                      <div className="my-1">
                        <img src={imprint.artwork_url} alt="Artwork" className="h-20 border border-gray-300" />
                      </div>
                    )}
                    {imprint.description && (
                      <p className="text-xs text-gray-600">{imprint.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Fees Table */}
            {fees.length > 0 && (
              <div className="mb-3">
                <table className="w-full border-collapse border border-gray-400" style={{ fontSize: '9pt' }}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 px-2 py-0.5 text-left font-semibold">Fee</th>
                      <th className="border border-gray-400 px-2 py-0.5 text-left font-semibold">Description</th>
                      <th className="border border-gray-400 px-2 py-0.5 text-center font-semibold">Qty</th>
                      <th className="border border-gray-400 px-2 py-0.5 text-right font-semibold">Amount</th>
                      <th className="border border-gray-400 px-2 py-0.5 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map((fee, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-400 px-2 py-0.5">{fee.description}</td>
                        <td className="border border-gray-400 px-2 py-0.5">{fee.notes || ''}</td>
                        <td className="border border-gray-400 px-2 py-0.5 text-center">{fee.quantity || 1}</td>
                        <td className="border border-gray-400 px-2 py-0.5 text-right">${(fee.unit_price || 0).toFixed(2)}</td>
                        <td className="border border-gray-400 px-2 py-0.5 text-right">${(fee.total_price || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Section */}
            <div className="flex justify-end mb-4">
              <div className="w-64 bg-gray-50 p-2 text-xs">
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Total Quantity</span>
                  <span className="font-medium">{totalQty}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Item Total</span>
                  <span className="font-medium">${itemTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Fees Total</span>
                  <span className="font-medium">${feesTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Sub Total</span>
                  <span className="font-medium">${(quote.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Tax</span>
                  <span className="font-medium">${(quote.tax_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-t border-gray-400 mt-0.5 pt-0.5">
                  <span className="font-bold text-gray-900">Total Due</span>
                  <span className="font-bold text-gray-900">${(quote.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="mt-4 pt-2 border-t border-gray-300 space-y-1" style={{ fontSize: '7pt', lineHeight: '1.3' }}>
              <p className="text-gray-700">
                <strong>Payment Terms:</strong> Unless you have a billing account set up or are ordering through a PO system, a 50% down payment is due before blank goods are ordered, and the remaining 50% balance is due at pickup. All orders must be signed for at pickup, and signing off on your order confirms you have received the correct products, quantities, colors and sizes.
              </p>
              <p className="text-gray-700">
                <strong>Artwork Proofs -</strong> All orders must have customer approval on artwork before production can begin. Once final approval has been made, we will proceed with production. No refunds, returns or reprints due to approving artwork with incorrect spelling, placement or colors. Your proof is an approximate representation of location and size, but sizing (appearance) and placement will change across different sizes of shirts.
              </p>
            </div>
          </div>
        </div>

        {/* Approval / Rejection Form */}
        {!isExpired && (
          <div className="bg-white rounded-lg shadow-lg p-6 mt-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Approve or Decline This Quote</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add any comments or questions..."
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
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
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                Decline Quote
              </button>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mt-4">
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
