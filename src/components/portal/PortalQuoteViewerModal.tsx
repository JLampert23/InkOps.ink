import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, XCircle, Loader2, Clock, Download, Printer, ChevronLeft } from 'lucide-react';
import { supabaseAnon } from '../../lib/supabase-anon-client';
import { portalAnalyticsService } from '../../services/portal-analytics-service';
import { generateQuotePDF, QuotePDFData } from '../../utils/quote-pdf-export';

interface QuoteViewerProps {
  quoteId: string;
  onClose: () => void;
  onApprovalComplete?: () => void;
  customerId?: string;
  companyId?: string;
}

interface FullQuoteData {
  quote: Record<string, any>;
  line_items: Record<string, any>[];
  imprints: Record<string, any>[];
  company_settings: Record<string, any>;
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

function fmt(amount: number | null | undefined): string {
  if (amount == null || isNaN(Number(amount))) return '$0.00';
  return '$' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function calcTotalQty(item: Record<string, any>): number {
  return SIZE_COLS.reduce((sum, col) => sum + (Number(item[col.key]) || 0), 0);
}

export function PortalQuoteViewerModal({ quoteId, onClose, onApprovalComplete, customerId, companyId }: QuoteViewerProps) {
  const useDirectAccess = !!(customerId && companyId);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<FullQuoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<'approved' | 'rejected' | null>(null);
  const [approverName, setApproverName] = useState('');
  const [approverEmail, setApproverEmail] = useState('');
  const [approverNotes, setApproverNotes] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadQuoteData();
  }, [quoteId]);

  const loadQuoteData = async () => {
    try {
      setLoading(true);
      setError(null);

      let quoteData: FullQuoteData;

      if (useDirectAccess) {
        const { data: quote, error: quoteError } = await supabaseAnon
          .from('quotes')
          .select('*')
          .eq('id', quoteId)
          .eq('customer_id', customerId)
          .eq('company_id', companyId)
          .maybeSingle();

        if (quoteError) throw quoteError;
        if (!quote) throw new Error('Quote not found');

        const { data: lineItems, error: lineItemsError } = await supabaseAnon
          .from('quote_line_items')
          .select('*')
          .eq('quote_id', quoteId)
          .order('sort_order', { ascending: true });

        if (lineItemsError) throw lineItemsError;

        const { data: imprints, error: imprintsError } = await supabaseAnon
          .from('quote_imprints')
          .select('*')
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: true });

        if (imprintsError) throw imprintsError;

        const { data: companySettings, error: companyError } = await supabaseAnon
          .from('company_settings')
          .select('company_name, logo_url, company_logo_primary_url, company_logo_secondary_url, company_address, company_city, company_state, company_zip, company_phone, company_website, company_email, quote_terms')
          .eq('id', companyId)
          .maybeSingle();

        if (companyError) throw companyError;

        quoteData = {
          quote: { ...quote, quote_terms: companySettings?.quote_terms },
          line_items: lineItems || [],
          imprints: imprints || [],
          company_settings: companySettings || {}
        };
      } else {
        const token = localStorage.getItem('customer_portal_token');
        if (!token) {
          throw new Error('No portal session found');
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?type=quote_detail&quote_id=${quoteId}`,
          {
            headers: {
              'X-Customer-Token': token,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || 'Failed to load quote details');
        }

        const result = await response.json();
        quoteData = result.data;
      }

      setData(quoteData);

      if (quoteData?.quote?.bill_name || quoteData?.quote?.customer_name) {
        setApproverName(quoteData.quote.bill_name || quoteData.quote.customer_name);
      }
      if (quoteData?.quote?.bill_email || quoteData?.quote?.customer_email) {
        setApproverEmail(quoteData.quote.bill_email || quoteData.quote.customer_email);
      }

      if (customerId && companyId) {
        await portalAnalyticsService.trackEvent({
          companyId: companyId,
          customerId: customerId,
          eventType: 'quote_viewed',
          resourceType: 'quote',
          resourceId: quoteId
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approved: boolean) => {
    if (!approverName.trim() || !approverEmail.trim()) {
      setError('Please enter your name and email.');
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(approverEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    const action = approved ? 'approve' : 'decline';
    if (!confirm(`Are you sure you want to ${action} this quote?`)) return;

    setSubmitting(true);
    setError(null);
    try {
      if (useDirectAccess) {
        const newStatus = approved ? 'approved' : 'rejected';
        const { error: updateError } = await supabaseAnon
          .from('quotes')
          .update({
            status: newStatus,
            approver_name: approverName.trim(),
            approver_email: approverEmail.trim(),
            approval_notes: approverNotes.trim() || null,
            approved_at: approved ? new Date().toISOString() : null,
            rejected_at: approved ? null : new Date().toISOString(),
          })
          .eq('id', quoteId)
          .eq('customer_id', customerId)
          .eq('company_id', companyId);

        if (updateError) throw updateError;
      } else {
        const token = localStorage.getItem('customer_portal_token');
        if (!token) {
          throw new Error('Session expired. Please log in again.');
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data`,
          {
            method: 'POST',
            headers: {
              'X-Customer-Token': token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'approve_quote',
              quote_id: quoteId,
              approved,
              approver_name: approverName.trim(),
              approver_email: approverEmail.trim(),
              notes: approverNotes.trim() || null,
            }),
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || 'Failed to submit response');
        }
      }

      setSubmitted(approved ? 'approved' : 'rejected');

      if (customerId && companyId) {
        await portalAnalyticsService.trackEvent({
          companyId: companyId,
          customerId: customerId,
          eventType: approved ? 'quote_approved' : 'quote_rejected',
          resourceType: 'quote',
          resourceId: quoteId
        });
      }

      if (onApprovalComplete) {
        setTimeout(() => {
          onApprovalComplete();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!data?.quote) return;

    setDownloadingPdf(true);
    try {
      const pdfData: QuotePDFData = {
        quote_number: data.quote.quote_number,
        nickname: data.quote.nickname,
        customer_name: data.quote.customer_name || '',
        customer_email: data.quote.customer_email || '',
        customer_company: data.quote.customer_company || '',
        customer_phone: data.quote.customer_phone || '',
        bill_company: data.quote.bill_company,
        bill_name: data.quote.bill_name,
        bill_first_name: data.quote.bill_first_name,
        bill_last_name: data.quote.bill_last_name,
        bill_address_1: data.quote.bill_address_1,
        bill_address_2: data.quote.bill_address_2,
        bill_city: data.quote.bill_city,
        bill_state: data.quote.bill_state,
        bill_zip: data.quote.bill_zip,
        bill_phone: data.quote.bill_phone,
        bill_email: data.quote.bill_email,
        ship_company: data.quote.ship_company,
        ship_name: data.quote.ship_name,
        ship_address_1: data.quote.ship_address_1,
        ship_address_2: data.quote.ship_address_2,
        ship_city: data.quote.ship_city,
        ship_state: data.quote.ship_state,
        ship_zip: data.quote.ship_zip,
        subtotal: parseFloat(data.quote.subtotal || 0),
        tax_rate: parseFloat(data.quote.tax_rate || 0),
        tax_amount: parseFloat(data.quote.tax_amount || 0),
        discount_amount: parseFloat(data.quote.discount_amount || 0),
        discount_type: data.quote.discount_type,
        total: parseFloat(data.quote.total || 0),
        status: data.quote.status,
        valid_until: data.quote.valid_until,
        created_at: data.quote.created_at,
        created_date: data.quote.created_date,
        customer_due_date: data.quote.customer_due_date,
        production_due_date: data.quote.production_due_date,
        notes: data.quote.notes,
        production_notes: data.quote.production_notes,
        delivery_method: data.quote.delivery_method,
        po_number: data.quote.po_number,
        terms: data.quote.terms,
        payment_due_date: data.quote.payment_due_date,
        invoice_date: data.quote.invoice_date,
        company_name: data.quote.company_name || data.company_settings?.company_name,
        company_address: data.quote.company_address || data.company_settings?.company_address,
        company_city: data.quote.company_city || data.company_settings?.company_city,
        company_state: data.quote.company_state || data.company_settings?.company_state,
        company_zip: data.quote.company_zip || data.company_settings?.company_zip,
        company_phone: data.quote.company_phone || data.company_settings?.company_phone,
        company_website: data.quote.company_website || data.company_settings?.company_website,
        company_email: data.quote.company_email || data.company_settings?.company_email,
        company_logo_url: data.quote.company_logo_url || data.company_settings?.company_logo_primary_url || data.company_settings?.logo_url,
        company_logo_secondary_url: data.company_settings?.company_logo_secondary_url,
        line_items: data.line_items.map(li => ({
          line_type: li.line_type || 'item',
          item_number: li.item_number,
          description: li.description || '',
          unit_price: parseFloat(li.unit_price || 0),
          total_price: parseFloat(li.total_price || 0),
          color: li.color,
          notes: li.notes,
          quantity: li.quantity,
          group_label: li.group_label,
          qty_yxs: li.qty_yxs,
          qty_ys: li.qty_ys,
          qty_ym: li.qty_ym,
          qty_yl: li.qty_yl,
          qty_yxl: li.qty_yxl,
          qty_xs: li.qty_xs,
          qty_s: li.qty_s,
          qty_m: li.qty_m,
          qty_l: li.qty_l,
          qty_xl: li.qty_xl,
          qty_2xl: li.qty_2xl,
          qty_3xl: li.qty_3xl,
          qty_4xl: li.qty_4xl,
          qty_5xl: li.qty_5xl,
          qty_6xl: li.qty_6xl,
          garment_front_image_url: li.garment_front_image_url,
          garment_back_image_url: li.garment_back_image_url,
          garment_sleeve_image_url: li.garment_sleeve_image_url,
          garment_image_url: li.garment_image_url,
        })),
        imprints: data.imprints?.map(imp => ({
          id: imp.id,
          type_of_work: imp.type_of_work,
          location: imp.location,
          num_colors: imp.num_colors,
          description: imp.description,
          details: imp.details,
          artwork_description: imp.artwork_description,
          thread_ink_color: imp.thread_ink_color,
          artwork_url: imp.artwork_url,
          artwork_images: imp.artwork_images,
          mockups: imp.mockups,
          group_label: imp.group_label,
        })),
        quote_terms: data.quote.quote_terms,
      };

      await generateQuotePDF(pdfData);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (!data && error) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Quote</h2>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    const isApproved = submitted === 'approved';
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className={`rounded-full ${isApproved ? 'bg-emerald-50' : 'bg-red-50'} flex items-center justify-center mx-auto mb-5`} style={{ width: 72, height: 72 }}>
            {isApproved ? <CheckCircle className="h-9 w-9 text-emerald-600" /> : <XCircle className="h-9 w-9 text-red-500" />}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{isApproved ? 'Quote Approved!' : 'Quote Declined'}</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            {isApproved
              ? 'Thank you for approving this quote. We will begin processing your order shortly.'
              : 'Thank you for your response. We have recorded your feedback and will be in touch.'}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { quote, line_items, imprints, company_settings } = data;
  const isPending = quote.status === 'sent' || quote.status === 'pending';
  const isApproved = quote.status === 'approved';
  const isRejected = quote.status === 'rejected' || quote.status === 'declined';

  const items = line_items.filter(li => li.line_type === 'item' || !li.line_type);
  const fees = line_items.filter(li => li.line_type === 'fee');

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
    <>
      <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center p-4 py-8">
          <div className="bg-gray-100 rounded-xl shadow-2xl w-full max-w-[8.5in] relative">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 rounded-t-xl px-6 py-4 flex items-center justify-between print:hidden">
              <button
                onClick={onClose}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium">Back to Quotes</span>
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {downloadingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Download PDF</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6" ref={printRef}>
              <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-6 print:shadow-none">
                <div className="p-6" style={{ fontSize: '9pt' }}>
                  <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-300">
                    <div>
                      <h1 className="text-xl font-bold text-gray-900 mb-0.5">{quote.quote_number}</h1>
                      <p className="text-sm text-gray-600 uppercase">{quote.customer_name}</p>
                    </div>
                    {isPending && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                        <Clock className="w-3 h-3" />
                        Awaiting Approval
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold">
                        <XCircle className="w-3 h-3" />
                        Declined
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
                    <div className="flex gap-3">
                      {logoUrl && (
                        <img src={logoUrl} alt="Company Logo" className="h-16 w-auto object-contain flex-shrink-0" />
                      )}
                      <div className="text-xs leading-tight">
                        <h2 className="font-bold text-gray-900 uppercase mb-0.5">
                          {quote.company_name || company_settings?.company_name || ''}
                        </h2>
                        <div className="text-gray-700 space-y-0">
                          {quote.company_address && <p>{quote.company_address}</p>}
                          {(quote.company_city || quote.company_state) && (
                            <p>{quote.company_city}{quote.company_state ? `, ${quote.company_state}` : ''} {quote.company_zip || ''}</p>
                          )}
                          {(quote.company_phone || company_settings?.company_phone) && <p>{quote.company_phone || company_settings.company_phone}</p>}
                          {(quote.company_website || company_settings?.company_website) && (
                            <p className="text-blue-600">{quote.company_website || company_settings.company_website}</p>
                          )}
                          {(quote.company_email || company_settings?.company_email) && (
                            <p className="text-blue-600">{quote.company_email || company_settings.company_email}</p>
                          )}
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
                            <td className="py-0.5 text-right">{fmtDate(quote.created_at)}</td>
                          </tr>
                          {quote.customer_due_date && (
                            <tr className="border-b border-gray-200">
                              <td className="py-0.5 pr-2 font-semibold text-gray-700">Customer Due Date</td>
                              <td className="py-0.5 text-right">{fmtDate(quote.customer_due_date)}</td>
                            </tr>
                          )}
                          {quote.valid_until && (
                            <tr className="border-b border-gray-200">
                              <td className="py-0.5 pr-2 font-semibold text-gray-700">Valid Until</td>
                              <td className="py-0.5 text-right">{fmtDate(quote.valid_until)}</td>
                            </tr>
                          )}
                          <tr className="border-b border-gray-200">
                            <td className="py-0.5 pr-2 font-semibold text-gray-700">Terms</td>
                            <td className="py-0.5 text-right">{quote.terms || 'Net 30'}</td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-0.5 pr-2 font-bold text-gray-900">Total</td>
                            <td className="py-0.5 text-right font-bold">{fmt(quote.total)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1 text-xs uppercase tracking-wide">Customer Billing</h3>
                      <div className="text-xs text-gray-700 leading-tight space-y-0">
                        {quote.bill_company && <p className="font-bold text-gray-900">{quote.bill_company}</p>}
                        {(quote.bill_first_name || quote.bill_last_name) && (
                          <p className="font-medium">{quote.bill_first_name} {quote.bill_last_name}</p>
                        )}
                        {!quote.bill_first_name && !quote.bill_last_name && quote.bill_name && (
                          <p className="font-medium">{quote.bill_name}</p>
                        )}
                        {quote.bill_address_1 && <p>{quote.bill_address_1}</p>}
                        {quote.bill_address_2 && <p>{quote.bill_address_2}</p>}
                        {quote.bill_city && (
                          <p>{quote.bill_city}, {quote.bill_state || ''} {quote.bill_zip || ''}</p>
                        )}
                        {(quote.bill_email || quote.customer_email) && <p className="text-blue-600">{quote.bill_email || quote.customer_email}</p>}
                        {(quote.bill_phone || quote.customer_phone) && <p>{quote.bill_phone || quote.customer_phone}</p>}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-1 text-xs uppercase tracking-wide">Customer Shipping</h3>
                      <div className="text-xs text-gray-700 leading-tight space-y-0">
                        {quote.ship_name && <p>{quote.ship_name}</p>}
                        {quote.ship_company && <p>{quote.ship_company}</p>}
                        {quote.ship_address_1 && <p>{quote.ship_address_1}</p>}
                        {quote.ship_address_2 && <p>{quote.ship_address_2}</p>}
                        {quote.ship_city && (
                          <p>{quote.ship_city}, {quote.ship_state || ''} {quote.ship_zip || ''}</p>
                        )}
                      </div>
                    </div>
                  </div>

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

                  {items.length === 0 && (imprints || []).length > 0 && (
                    <ImprintCards imprints={imprints} onImageClick={setLightboxUrl} />
                  )}

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

                  <div className="pt-3 border-t border-gray-300 space-y-1" style={{ fontSize: '7pt', lineHeight: '1.3' }}>
                    <p className="text-gray-600">
                      <strong>Payment Terms:</strong> Unless you have a billing account set up or are ordering through a PO system, a 50% down payment is due before blank goods are ordered, and the remaining 50% balance is due at pickup.
                    </p>
                    <p className="text-gray-600">
                      <strong>Artwork Proofs -</strong> All orders must have customer approval on artwork before production can begin.
                    </p>
                    <p className="text-gray-600">
                      <strong>Ink/Thread Colors:</strong> We use standard, stock ink and thread colors. The colors you see on your proof are a close, but not exact representation.
                    </p>
                    <p className="text-gray-600 font-semibold">This quote is good for 15 days.</p>
                  </div>
                </div>
              </div>

              {isPending && (
                <div className="bg-white shadow-lg rounded-lg p-6 print:hidden">
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
                      onClick={() => handleApproval(true)}
                      disabled={submitting}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle className="h-5 w-5" /> Approve Quote</>}
                    </button>
                    <button
                      onClick={() => handleApproval(false)}
                      disabled={submitting}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><XCircle className="h-5 w-5" /> Decline Quote</>}
                    </button>
                  </div>
                </div>
              )}

              {isApproved && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center print:hidden">
                  <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-emerald-900 mb-1">Quote Approved</h3>
                  <p className="text-emerald-700 text-sm">This quote has been approved. Your order is being processed.</p>
                </div>
              )}

              {isRejected && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center print:hidden">
                  <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-red-900 mb-1">Quote Declined</h3>
                  <p className="text-red-700 text-sm">This quote has been declined. Please contact us if you have questions.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-2 right-2 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-6 h-6 text-gray-700" />
            </button>
            <div className="p-4 max-h-[90vh] overflow-auto">
              <img src={lightboxUrl} alt="Proof/Artwork" className="w-full h-auto object-contain" style={{ maxHeight: 'calc(90vh - 2rem)' }} />
            </div>
          </div>
        </div>
      )}
    </>
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
          <td colSpan={19} className="border border-gray-400 px-2 py-1 font-bold text-gray-900">{groupLabel}</td>
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
          <td colSpan={19} className="border border-gray-400 p-3 bg-gray-50">
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
