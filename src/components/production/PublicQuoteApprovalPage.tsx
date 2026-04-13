import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';

interface ApprovalData {
  quote: Record<string, any>;
  line_items: Record<string, any>[];
  imprints: Record<string, any>[];
  company_settings: Record<string, any>;
  approval_status: string;
  expires_at: string | null;
  is_expired: boolean;
}

function fmt(amount: number | null | undefined): string {
  if (amount == null || isNaN(Number(amount))) return '$0.00';
  return '$' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const SIZE_COLS = [
  { key: 'qty_yxs', label: 'YXS' },
  { key: 'qty_ys', label: 'YS' },
  { key: 'qty_ym', label: 'YM' },
  { key: 'qty_yl', label: 'YL' },
  { key: 'qty_yxl', label: 'YXL' },
  { key: 'qty_xs', label: 'XS' },
  { key: 'qty_s', label: 'S' },
  { key: 'qty_m', label: 'M' },
  { key: 'qty_l', label: 'L' },
  { key: 'qty_xl', label: 'XL' },
  { key: 'qty_2xl', label: '2XL' },
  { key: 'qty_3xl', label: '3XL' },
  { key: 'qty_4xl', label: '4XL' },
  { key: 'qty_5xl', label: '5XL' },
] as const;

function calcTotalQty(item: Record<string, any>): number {
  return SIZE_COLS.reduce((sum, col) => sum + (Number(item[col.key]) || 0), 0);
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const token = window.location.pathname.split('/').pop();

  useEffect(() => {
    loadApprovalData();
  }, []);

  const loadApprovalData = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/quote-approval/${token}`, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to load quote');
      }
      const result = await response.json();
      setData(result);
      if (result.quote?.bill_name || result.quote?.customer_name) {
        setApproverName(result.quote.bill_name || result.quote.customer_name);
      }
      if (result.quote?.bill_email || result.quote?.customer_email) {
        setApproverEmail(result.quote.bill_email || result.quote.customer_email);
      }
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
        headers: { 'Content-Type': 'application/json' },
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-10 text-center">
          <div className={`rounded-full ${isApproved ? 'bg-emerald-50' : 'bg-red-50'} flex items-center justify-center mx-auto mb-5`} style={{ width: 72, height: 72 }}>
            {isApproved ? <CheckCircle className="h-9 w-9 text-emerald-600" /> : <XCircle className="h-9 w-9 text-red-500" />}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{isApproved ? 'Quote Approved!' : 'Quote Declined'}</h1>
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

  const { quote, line_items, imprints, company_settings } = data;

  if (data.approval_status !== 'pending') {
    const statusLabel = data.approval_status === 'approved' ? 'Approved' : data.approval_status === 'rejected' ? 'Rejected' : 'Processed';
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-10 text-center">
          <div className={`w-16 h-16 rounded-full ${data.approval_status === 'approved' ? 'bg-emerald-50' : 'bg-amber-50'} flex items-center justify-center mx-auto mb-4`}>
            {data.approval_status === 'approved' ? <CheckCircle className="h-8 w-8 text-emerald-600" /> : <Clock className="h-8 w-8 text-amber-600" />}
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Quote Already {statusLabel}</h1>
          <p className="text-gray-500 text-sm">This quote has already been {statusLabel.toLowerCase()}. If you need to make changes, please contact us.</p>
          {company_settings?.company_email && (
            <a href={`mailto:${company_settings.company_email}`} className="inline-block mt-6 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Contact Us</a>
          )}
        </div>
      </div>
    );
  }

  if (data.is_expired) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Quote Expired</h1>
          <p className="text-gray-500 text-sm">This approval link has expired. Please contact us for an updated quote.</p>
          {company_settings?.company_email && (
            <a href={`mailto:${company_settings.company_email}`} className="inline-block mt-6 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">Contact Us</a>
          )}
        </div>
      </div>
    );
  }

  const items = line_items.filter(li => li.line_type === 'item' || !li.line_type);
  const fees = line_items.filter(li => li.line_type === 'fee');
  const imprintLineItems = line_items.filter(li => li.line_type === 'imprint');

  const grouped = items.reduce((acc: Record<string, any[]>, item) => {
    const label = item.group_label || '';
    if (!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {});
  const itemGroups = Object.entries(grouped);

  const totalQtyAll = items.reduce((s, i) => s + calcTotalQty(i), 0);
  const itemTotal = items.reduce((s, i) => s + (Number(i.total_price) || 0), 0);
  const feesTotal = fees.reduce((s, i) => s + (Number(i.total_price) || 0), 0);

  const logoUrl = quote.company_logo_url || company_settings?.company_logo_primary_url || company_settings?.logo_url;

  const normalizeLabel = (l: string | null | undefined) => l || '';

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="max-w-[8.5in] mx-auto">
        {/* Quote Document */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-6">
          <div className="p-6" style={{ fontSize: '9pt' }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 pb-6 border-b-2 border-gray-100">
              <div className="flex flex-col items-center md:items-start gap-4 mb-4 md:mb-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company Logo" className="h-20 w-auto object-contain" />
                ) : (
                  <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase italic">
                    {quote.company_name || company_settings?.company_name || 'INKOPS'}
                  </h1>
                )}
                <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  Quote Document
                </div>
              </div>

              <div className="text-center md:text-right">
                <h1 className="text-4xl font-black text-gray-900 mb-1 tracking-tight">QUOTE</h1>
                <div className="flex flex-col gap-1 text-xs">
                  <p className="font-bold text-gray-900">
                    Quote #: <span className="font-normal text-gray-600">{quote.quote_number}</span>
                  </p>
                  <p className="font-bold text-gray-900">
                    Date: <span className="font-normal text-gray-600">{fmtDate(quote.created_at)}</span>
                  </p>
                  {quote.customer_due_date && (
                    <p className="font-bold text-gray-900">
                      Due Date: <span className="font-normal text-gray-600">{fmtDate(quote.customer_due_date)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Company Info Banner */}
            <div className="bg-gray-50 rounded-lg p-4 mb-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-gray-600 uppercase tracking-wider font-semibold">
              <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2">
                {quote.company_address && <span>{quote.company_address}</span>}
                {(quote.company_city || quote.company_state) && (
                  <span>{quote.company_city}{quote.company_state ? `, ${quote.company_state}` : ''} {quote.company_zip || ''}</span>
                )}
              </div>
              <div className="flex flex-wrap justify-center md:justify-end gap-x-6 gap-y-2 mt-2 md:mt-0">
                {(quote.company_phone || company_settings?.company_phone) && <span>{quote.company_phone || company_settings.company_phone}</span>}
                {(quote.company_email || company_settings?.company_email) && <span className="text-blue-600">{quote.company_email || company_settings.company_email}</span>}
              </div>
            </div>

            {/* Customer Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6 border-t border-gray-200 pt-6">
              <div className="text-left">
                <h3 className="font-bold text-gray-900 mb-2 text-xs uppercase tracking-wider text-blue-600">Customer Billing</h3>
                <div className="text-xs text-gray-700 leading-relaxed space-y-1">
                  {quote.bill_company && <p className="font-bold text-sm text-gray-900">{quote.bill_company}</p>}
                  {(quote.bill_first_name || quote.bill_last_name) && (
                    <p className="font-semibold text-gray-800">{quote.bill_first_name} {quote.bill_last_name}</p>
                  )}
                  {!quote.bill_first_name && !quote.bill_last_name && quote.bill_name && (
                    <p className="font-semibold text-gray-800">{quote.bill_name}</p>
                  )}
                  {quote.bill_address_1 && <p>{quote.bill_address_1}</p>}
                  {quote.bill_address_2 && <p>{quote.bill_address_2}</p>}
                  {(quote.bill_city || quote.billing_address?.city) && (
                    <p>{quote.bill_city || quote.billing_address?.city}, {quote.bill_state || quote.billing_address?.state || ''} {quote.bill_zip || quote.billing_address?.zip || ''}</p>
                  )}
                  {(quote.bill_email || quote.customer_email) && <p className="text-blue-600 font-medium">{quote.bill_email || quote.customer_email}</p>}
                  {(quote.bill_phone || quote.customer_phone) && <p>{quote.bill_phone || quote.customer_phone}</p>}
                </div>
              </div>
              <div className="text-left">
                <h3 className="font-bold text-gray-900 mb-2 text-xs uppercase tracking-wider text-blue-600">Customer Shipping</h3>
                <div className="text-xs text-gray-700 leading-relaxed space-y-1">
                  {quote.ship_company && <p className="font-bold text-sm text-gray-900">{quote.ship_company}</p>}
                  {(quote.ship_name || quote.shipping_address?.name) && (
                    <p className="font-semibold text-gray-800">{quote.ship_name || quote.shipping_address?.name}</p>
                  )}
                  {quote.ship_address_1 && <p>{quote.ship_address_1}</p>}
                  {quote.ship_address_2 && <p>{quote.ship_address_2}</p>}
                  {(quote.ship_city) && (
                    <p>{quote.ship_city}, {quote.ship_state || ''} {quote.ship_zip || ''}</p>
                  )}
                  {quote.shipping_address?.contact && <p className="text-xs text-gray-500">{quote.shipping_address.contact}</p>}
                </div>
              </div>
              <div className="text-left border-l border-gray-100 pl-0 md:pl-8">
                <h3 className="font-bold text-gray-900 mb-2 text-xs uppercase tracking-wider text-blue-600">Quote Details</h3>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-1 text-gray-500">Terms</td>
                      <td className="py-1 text-right font-medium">{quote.terms || 'Net 30'}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-1 text-gray-500">Delivery</td>
                      <td className="py-1 text-right font-medium">{quote.delivery_method || 'PICK-UP'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Production Notes Section */}
            {quote.production_notes && (
              <div className="mb-6 rounded-lg overflow-hidden border border-orange-200">
                <div className="bg-orange-500 px-4 py-2 text-white font-bold text-xs uppercase tracking-wider">
                  Production Notes
                </div>
                <div className="bg-white p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {quote.production_notes}
                </div>
              </div>
            )}

            {/* Line Items Table with Size Breakdown */}
            {items.length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <table className="w-full border-collapse border border-gray-400" style={{ fontSize: '8pt' }}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 px-1 py-0.5 text-left font-semibold">Item #</th>
                      <th className="border border-gray-400 px-1 py-0.5 text-left font-semibold">Color</th>
                      <th className="border border-gray-400 px-1 py-0.5 text-left font-semibold">Description</th>
                      {SIZE_COLS.map(c => (
                        <th key={c.key} className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold" style={{ width: '24px' }}>{c.label}</th>
                      ))}
                      <th className="border border-gray-400 px-1 py-0.5 text-center font-semibold">Qty</th>
                      <th className="border border-gray-400 px-1 py-0.5 text-right font-semibold">Unit Price</th>
                      <th className="border border-gray-400 px-1 py-0.5 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemGroups.map(([groupLabel, groupItems], groupIdx) => {
                      const normalizedGroupLabel = normalizeLabel(groupLabel);
                      const groupImprints = itemGroups.length === 1 && !groupLabel
                        ? (imprints || [])
                        : (imprints || []).filter(imp => normalizeLabel(imp.group_label) === normalizedGroupLabel);

                      return (
                        <GroupRows
                          key={groupIdx}
                          groupLabel={groupLabel}
                          groupItems={groupItems}
                          groupImprints={groupImprints}
                          onImageClick={setLightboxUrl}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Standalone Imprints (if no groups or from line items) */}
            {items.length === 0 && (imprints || []).length > 0 && (
              <ImprintCards imprints={imprints} onImageClick={setLightboxUrl} />
            )}

            {/* Legacy imprint line items */}
            {imprintLineItems.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold text-xs text-gray-900 uppercase tracking-wide mb-2">Imprints</h3>
                {imprintLineItems.map((imp, idx) => (
                  <div key={idx} className="mb-3 pb-3 border-b border-gray-200 last:border-0">
                    <p className="font-bold text-xs text-gray-900 mb-0.5">
                      IMPRINT #{(imp.imprint_number || `${quote.quote_number}-${idx + 1}`).replace(/^QTE-/, '')}
                    </p>
                    {imp.decoration_method && (
                      <p className="text-xs text-gray-700 font-medium uppercase mb-1">{imp.decoration_method}</p>
                    )}
                    {imp.artwork_url && (
                      <div className="my-1.5">
                        <img
                          src={imp.artwork_url}
                          alt="Artwork"
                          className="h-24 border border-gray-300 rounded cursor-pointer hover:border-blue-500 transition-colors"
                          onClick={() => setLightboxUrl(imp.artwork_url)}
                        />
                      </div>
                    )}
                    {imp.description && <p className="text-xs text-gray-600">{imp.description}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Fees Table */}
            {fees.length > 0 && (
              <div className="mb-4">
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
                    {fees.map((fee, idx) => {
                      const parts = (fee.description || '').split(' - ');
                      const feeName = parts[0] || '';
                      const feeDesc = parts.slice(1).join(' - ') || fee.notes || '';
                      return (
                        <tr key={idx}>
                          <td className="border border-gray-400 px-2 py-0.5">{feeName}</td>
                          <td className="border border-gray-400 px-2 py-0.5">{feeDesc}</td>
                          <td className="border border-gray-400 px-2 py-0.5 text-center">{fee.quantity || 1}</td>
                          <td className="border border-gray-400 px-2 py-0.5 text-right">{fmt(fee.unit_price)}</td>
                          <td className="border border-gray-400 px-2 py-0.5 text-right">{fmt(fee.total_price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Section */}
            <div className="flex justify-end mb-5">
              <div className="w-64 bg-gray-50 border border-gray-200 rounded p-2.5 text-xs">
                <div className="flex justify-between py-0.5"><span className="text-gray-600">Total Quantity</span><span className="font-medium">{totalQtyAll}</span></div>
                <div className="flex justify-between py-0.5"><span className="text-gray-600">Item Total</span><span className="font-medium">{fmt(itemTotal)}</span></div>
                {feesTotal > 0 && <div className="flex justify-between py-0.5"><span className="text-gray-600">Fees Total</span><span className="font-medium">{fmt(feesTotal)}</span></div>}
                <div className="flex justify-between py-0.5"><span className="text-gray-600">Sub Total</span><span className="font-medium">{fmt(quote.subtotal)}</span></div>
                {Number(quote.discount_amount || 0) > 0 && (
                  <div className="flex justify-between py-0.5"><span className="text-gray-600">Discount</span><span className="font-medium text-emerald-600">-{fmt(quote.discount_amount)}</span></div>
                )}
                <div className="flex justify-between py-0.5"><span className="text-gray-600">Tax</span><span className="font-medium">{fmt(quote.tax_amount)}</span></div>
                <div className="flex justify-between py-1 border-t border-gray-400 mt-1 pt-1">
                  <span className="font-bold text-gray-900">Total Due</span>
                  <span className="font-bold text-gray-900">{fmt(quote.total)}</span>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="pt-6 border-t border-gray-300 space-y-3">
              {quote.terms ? (
                <div className="text-xs text-gray-700 leading-relaxed">
                  <h4 className="font-bold text-gray-900 uppercase mb-1">Terms & Conditions</h4>
                  <p className="whitespace-pre-wrap">{quote.terms}</p>
                </div>
              ) : (
                <div className="text-[7pt] text-gray-500 italic">
                  No specific payment terms provided for this quote.
                </div>
              )}
              {quote.valid_until && (
                <p className="text-[7pt] text-gray-600 font-semibold">This quote is valid until {fmtDate(quote.valid_until)}.</p>
              )}
            </div>
          </div>
        </div>

        {/* Approval Form */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-5">Your Response</h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
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
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes (Optional)</label>
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
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle className="h-5 w-5" /> Approve Quote</>}
            </button>
            <button
              onClick={() => handleResponse(false)}
              disabled={submitting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><XCircle className="h-5 w-5" /> Reject Quote</>}
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-2 right-2 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
            >
              <XCircle className="w-6 h-6 text-gray-700" />
            </button>
            <div className="p-4 max-h-[90vh] overflow-auto">
              <img src={lightboxUrl} alt="Proof/Artwork" className="w-full h-auto object-contain" style={{ maxHeight: 'calc(90vh - 2rem)' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupRows({
  groupLabel,
  groupItems,
  groupImprints,
  onImageClick,
}: {
  groupLabel: string;
  groupItems: Record<string, any>[];
  groupImprints: Record<string, any>[];
  onImageClick: (url: string) => void;
}) {
  return (
    <>
      {groupLabel && (
        <tr className="bg-gray-200">
          <td colSpan={20} className="border border-gray-400 px-2 py-1 font-bold text-gray-900">{groupLabel}</td>
        </tr>
      )}
      {groupItems.map((item, idx) => {
        const totalQty = calcTotalQty(item);
        const garmentImg = item.garment_front_image_url || item.garment_image_url;
        return (
          <tr key={idx} className="hover:bg-gray-50">
            <td className="border border-gray-400 px-1 py-0.5">
              {garmentImg ? (
                <img
                  src={garmentImg}
                  alt={item.description || 'Garment'}
                  className="w-10 h-10 object-contain rounded cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => onImageClick(garmentImg)}
                />
              ) : (
                <span>{item.item_number || ''}</span>
              )}
            </td>
            <td className="border border-gray-400 px-1 py-0.5">{item.color || ''}</td>
            <td className="border border-gray-400 px-1 py-0.5">{item.description || ''}</td>
            {SIZE_COLS.map(c => (
              <td key={c.key} className="border border-gray-400 px-0.5 py-0.5 text-center">{item[c.key] || ''}</td>
            ))}
            <td className="border border-gray-400 px-1 py-0.5 text-center font-medium">{totalQty}</td>
            <td className="border border-gray-400 px-1 py-0.5 text-right">{fmt(item.unit_price)}</td>
            <td className="border border-gray-400 px-1 py-0.5 text-right font-medium">{fmt(item.total_price)}</td>
          </tr>
        );
      })}
      {groupImprints.length > 0 && (
        <tr>
          <td colSpan={20} className="border border-gray-400 p-3 bg-gray-50">
            <ImprintCards imprints={groupImprints} onImageClick={onImageClick} />
          </td>
        </tr>
      )}
    </>
  );
}

function ImprintCards({
  imprints,
  onImageClick,
}: {
  imprints: Record<string, any>[];
  onImageClick: (url: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {imprints.map((imp, idx) => {
        const mockups = Array.isArray(imp.mockups) ? imp.mockups : [];
        const hasMockups = mockups.some((m: any) => typeof m === 'string' ? m : m?.url);

        return (
          <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="flex items-start justify-between mb-1.5">
              <div>
                <p className="font-bold text-xs text-gray-900">
                  {imp.imprint_number ? `IMPRINT #${imp.imprint_number.replace(/^QTE-/, '')}` : `Imprint ${idx + 1}`}
                </p>
                {imp.type_of_work && (
                  <p className="text-xs text-blue-700 font-medium">{imp.type_of_work}</p>
                )}
              </div>
              {imp.location && (
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">{imp.location}</span>
              )}
            </div>

            {imp.details && (
              <p className="text-xs text-gray-600 whitespace-pre-wrap mb-2">{imp.details}</p>
            )}

            {imp.thread_ink_color && (
              <p className="text-xs text-gray-500 mb-2">Colors: {imp.thread_ink_color}</p>
            )}

            {hasMockups && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {mockups.map((mockup: any, mIdx: number) => {
                  const url = typeof mockup === 'string' ? mockup : mockup?.url;
                  if (!url) return null;
                  return (
                    <div key={mIdx} className="aspect-square">
                      <img
                        src={url}
                        alt={`Mockup ${mIdx + 1}`}
                        className="w-full h-full object-contain rounded border border-gray-200 cursor-pointer hover:border-blue-500 transition-all bg-white"
                        onClick={() => onImageClick(url)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
