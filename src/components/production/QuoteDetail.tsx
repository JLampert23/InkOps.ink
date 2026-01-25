import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  ArrowLeft,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  Copy,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Download,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  delivery_method: string | null;
  po_number: string | null;
  terms: string | null;
  payment_due_date: string | null;
  invoice_date: string | null;
  billing_address: any;
  shipping_address: any;
  company_name: string | null;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  company_phone: string | null;
  company_website: string | null;
  company_email: string | null;
  company_logo_url: string | null;
}

interface LineItem {
  id: string;
  line_number: number;
  line_type: string | null;
  item_number: string | null;
  color: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  decoration_method: string | null;
  decoration_location: string | null;
  imprint_number: string | null;
  artwork_url: string | null;
  notes: string | null;
  qty_yxs: number | null;
  qty_ys: number | null;
  qty_ym: number | null;
  qty_yl: number | null;
  qty_yxl: number | null;
  qty_xs: number | null;
  qty_s: number | null;
  qty_m: number | null;
  qty_l: number | null;
  qty_xl: number | null;
  qty_2xl: number | null;
  qty_3xl: number | null;
  qty_4xl: number | null;
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
      if (!session) {
        console.error('No session found');
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quotes-api/${quoteId}`;
      console.log('Fetching quote from:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response not OK:', response.status, errorText);
        throw new Error(`Failed to load quote: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Quote data loaded:', data);

      setQuote(data.quote);
      setLineItems(data.lineItems || []);
      setApprovals(data.approvals || []);
      setActivityLog(data.activityLog || []);
    } catch (error: any) {
      console.error('Error loading quote:', error);
      alert(`Failed to load quote details: ${error.message}`);
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
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-yellow-100 text-yellow-800';
      case 'converted': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const exportToPDF = () => {
    if (!quote) return;
    const doc = new jsPDF();

    const companyName = quote.company_name || "Todd's Sporting Goods";
    const companyAddress = quote.company_address || '393 Cabot Street';
    const companyCity = quote.company_city || 'Beverly';
    const companyState = quote.company_state || 'Massachusetts';
    const companyZip = quote.company_zip || '01915';
    const companyPhone = quote.company_phone || '19789271600';
    const companyWebsite = quote.company_website || 'https://www.toddssportinggoods.com';
    const companyEmail = quote.company_email || 'jamie@toddssportinggoods.com';

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Invoice #${quote.quote_number}`, 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.customer_name || '', 14, 24);

    let yPos = 35;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 14, yPos);
    yPos += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(companyAddress, 14, yPos);
    yPos += 3.5;
    doc.text(`${companyCity}, ${companyState} ${companyZip}`, 14, yPos);
    yPos += 3.5;
    doc.text(companyPhone, 14, yPos);
    yPos += 3.5;
    doc.setTextColor(0, 0, 255);
    doc.text(companyWebsite, 14, yPos);
    yPos += 3.5;
    doc.text(companyEmail, 14, yPos);
    doc.setTextColor(0, 0, 0);

    yPos = 35;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Delivery Method', 120, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.delivery_method || 'PICK-UP', 165, yPos);
    yPos += 4;

    if (quote.po_number) {
      doc.setFont('helvetica', 'bold');
      doc.text('PO #', 120, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.po_number, 165, yPos);
      yPos += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Created', 120, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(quote.created_at), 165, yPos);
    yPos += 4;

    if (quote.valid_until) {
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Due Date', 120, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(quote.valid_until), 165, yPos);
      yPos += 4;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Terms', 120, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.terms || 'Net 30', 165, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Total', 120, yPos);
    doc.text(`$${quote.total.toFixed(2)}`, 165, yPos);
    yPos += 4;
    doc.text('Outstanding', 120, yPos);
    doc.text(`$${quote.total.toFixed(2)}`, 165, yPos);

    yPos = 70;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Billing', 14, yPos);
    doc.text('Customer Shipping', 75, yPos);
    doc.text('Customer Notes', 136, yPos);
    yPos += 4;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const billing = quote.billing_address || {};

    let billingY = yPos;
    doc.text(quote.customer_name || '', 14, billingY);
    billingY += 3.5;
    if (quote.customer_company) { doc.text(quote.customer_company, 14, billingY); billingY += 3.5; }
    if (billing.line1) { doc.text(billing.line1, 14, billingY); billingY += 3.5; }
    if (billing.city) { doc.text(`${billing.city}, ${billing.state || ''} ${billing.zip || ''}`, 14, billingY); billingY += 3.5; }
    if (quote.customer_phone) { doc.text(quote.customer_phone, 14, billingY); billingY += 3.5; }
    if (quote.customer_email) { doc.setTextColor(0, 0, 255); doc.text(quote.customer_email, 14, billingY); doc.setTextColor(0, 0, 0); }

    const shipping = quote.shipping_address || {};
    let shippingY = yPos;
    if (shipping.name) { doc.text(shipping.name, 75, shippingY); shippingY += 3.5; }
    if (shipping.contact) { doc.text(shipping.contact, 75, shippingY); }

    if (quote.customer_notes) {
      doc.text(doc.splitTextToSize(quote.customer_notes, 55), 136, yPos);
    }

    yPos = Math.max(billingY, shippingY, yPos + 15) + 5;

    const items = lineItems.filter(item => item.line_type === 'item' || !item.line_type);
    const fees = lineItems.filter(item => item.line_type === 'fee');
    const imprints = lineItems.filter(item => item.line_type === 'imprint');

    if (items.length > 0) {
      const itemRows = items.map(item => [
        item.item_number || '',
        item.color || '',
        item.description || '',
        item.qty_yxs || '', item.qty_ys || '', item.qty_ym || '', item.qty_yl || '', item.qty_yxl || '',
        item.qty_xs || '', item.qty_s || '', item.qty_m || '', item.qty_l || '', item.qty_xl || '',
        item.qty_2xl || '', item.qty_3xl || '', item.qty_4xl || '',
        (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) + (item.qty_yl || 0) + (item.qty_yxl || 0) +
        (item.qty_xs || 0) + (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) + (item.qty_xl || 0) +
        (item.qty_2xl || 0) + (item.qty_3xl || 0) + (item.qty_4xl || 0),
        `$${(item.unit_price || 0).toFixed(2)}`,
        `$${(item.total_price || 0).toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Item #', 'Color', 'Description', 'YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Qty', 'Price', 'Total']],
        body: itemRows,
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 0.8 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;
    }

    if (imprints.length > 0) {
      imprints.forEach((imprint) => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`IMPRINT #${imprint.imprint_number || ''}`, 14, yPos);
        yPos += 4;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        if (imprint.decoration_method) { doc.text(`${imprint.decoration_method.toUpperCase()}`, 14, yPos); yPos += 3.5; }
        if (imprint.description) { doc.text(imprint.description, 14, yPos); yPos += 3.5; }
        yPos += 2;
      });
    }

    if (fees.length > 0) {
      const feeRows = fees.map(fee => [
        fee.description || '',
        fee.notes || '',
        fee.quantity || 1,
        `$${(fee.unit_price || 0).toFixed(2)}`,
        `$${(fee.total_price || 0).toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Fee', 'Description', 'Qty', 'Amount', 'Total']],
        body: feeRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      });

      yPos = (doc as any).lastAutoTable.finalY + 5;
    }

    doc.setFontSize(8);
    const totalQty = items.reduce((sum, item) => {
      return sum + (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) + (item.qty_yl || 0) +
             (item.qty_yxl || 0) + (item.qty_xs || 0) + (item.qty_s || 0) + (item.qty_m || 0) +
             (item.qty_l || 0) + (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) + (item.qty_4xl || 0);
    }, 0);
    const itemTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const feesTotal = fees.reduce((sum, fee) => sum + (fee.total_price || 0), 0);

    doc.setFont('helvetica', 'normal');
    doc.text('Total Quantity', 145, yPos); doc.text(totalQty.toString(), 190, yPos, { align: 'right' }); yPos += 4;
    doc.text('Item Total', 145, yPos); doc.text(`$${itemTotal.toFixed(2)}`, 190, yPos, { align: 'right' }); yPos += 4;
    doc.text('Fees Total', 145, yPos); doc.text(`$${feesTotal.toFixed(2)}`, 190, yPos, { align: 'right' }); yPos += 4;
    doc.text('Sub Total', 145, yPos); doc.text(`$${quote.subtotal.toFixed(2)}`, 190, yPos, { align: 'right' }); yPos += 4;
    doc.text('Tax', 145, yPos); doc.text(`$${quote.tax_amount.toFixed(2)}`, 190, yPos, { align: 'right' }); yPos += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Due', 145, yPos); doc.text(`$${quote.total.toFixed(2)}`, 190, yPos, { align: 'right' }); yPos += 4;
    doc.setFont('helvetica', 'normal');
    doc.text('Paid', 145, yPos); doc.text('$0.00', 190, yPos, { align: 'right' }); yPos += 4;
    doc.text('Outstanding', 145, yPos); doc.text(`$${quote.total.toFixed(2)}`, 190, yPos, { align: 'right' });

    yPos += 8;
    doc.setFontSize(6);
    const terms = [
      'Payment Terms: Unless you have a billing account set up or are ordering through a PO system, a 50% down payment is due before blank goods are ordered, and the remaining 50% balance is due at pickup.',
      'Artwork Proofs - All orders must have customer approval on artwork before production can begin. Once final approval has been made, we will proceed with production. No refunds, returns or reprints due to approving artwork with incorrect spelling, placement or colors.',
    ];

    terms.forEach(term => {
      const lines = doc.splitTextToSize(term, 180);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 2.5;
    });

    doc.save(`quote-${quote.quote_number}.pdf`);
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

  const items = lineItems.filter(item => item.line_type === 'item' || !item.line_type);
  const fees = lineItems.filter(item => item.line_type === 'fee');
  const imprints = lineItems.filter(item => item.line_type === 'imprint');

  const totalQty = items.reduce((sum, item) => {
    return sum + (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) + (item.qty_yl || 0) +
           (item.qty_yxl || 0) + (item.qty_xs || 0) + (item.qty_s || 0) + (item.qty_m || 0) +
           (item.qty_l || 0) + (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) + (item.qty_4xl || 0);
  }, 0);
  const itemTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const feesTotal = fees.reduce((sum, fee) => sum + (fee.total_price || 0), 0);

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Quote {quote.quote_number}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(quote.status)}`}>
              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToPDF}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-gray-300"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          {(quote.status === 'draft' || quote.status === 'sent') && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-700 dark:text-gray-300"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          {quote.status === 'draft' && (
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          )}
          {quote.status === 'approved' && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Convert
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

      {/* Invoice Preview */}
      <div className="bg-white shadow-lg p-6 max-w-[8.5in] mx-auto print:shadow-none" style={{ fontSize: '9pt' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3 pb-2 border-b border-gray-300">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Invoice #{quote.quote_number}</h1>
            <p className="text-sm text-gray-600 uppercase">{quote.customer_name}</p>
          </div>
        </div>

        {/* Company Info and Invoice Details */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex gap-3">
            {quote.company_logo_url && (
              <img src={quote.company_logo_url} alt="Logo" className="h-14 w-auto object-contain" />
            )}
            <div className="text-xs leading-tight">
              <h2 className="font-bold text-gray-900 mb-0.5">
                {quote.company_name || "Todd's Sporting Goods"}
              </h2>
              <p className="text-gray-700">{quote.company_address || '393 Cabot Street'}</p>
              <p className="text-gray-700">
                {quote.company_city || 'Beverly'}, {quote.company_state || 'Massachusetts'} {quote.company_zip || '01915'}
              </p>
              <p className="text-gray-700">{quote.company_phone || '19789271600'}</p>
              <p className="text-blue-600">{quote.company_website || 'https://www.toddssportinggoods.com'}</p>
              <p className="text-blue-600">{quote.company_email || 'jamie@toddssportinggoods.com'}</p>
            </div>
          </div>

          <table className="text-xs border-collapse">
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-0.5 pr-3 font-semibold text-gray-700">Delivery Method</td>
                <td className="py-0.5 text-right">{quote.delivery_method || 'PICK-UP'}</td>
              </tr>
              {quote.po_number && (
                <tr className="border-b border-gray-200">
                  <td className="py-0.5 pr-3 font-semibold text-gray-700">PO #</td>
                  <td className="py-0.5 text-right">{quote.po_number}</td>
                </tr>
              )}
              <tr className="border-b border-gray-200">
                <td className="py-0.5 pr-3 font-semibold text-gray-700">Created</td>
                <td className="py-0.5 text-right">{formatDate(quote.created_at)}</td>
              </tr>
              {quote.valid_until && (
                <tr className="border-b border-gray-200">
                  <td className="py-0.5 pr-3 font-semibold text-gray-700">Customer Due Date</td>
                  <td className="py-0.5 text-right">{formatDate(quote.valid_until)}</td>
                </tr>
              )}
              <tr className="border-b border-gray-200">
                <td className="py-0.5 pr-3 font-semibold text-gray-700">Terms</td>
                <td className="py-0.5 text-right">{quote.terms || 'Net 30'}</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-0.5 pr-3 font-bold text-gray-900">Total</td>
                <td className="py-0.5 text-right font-bold">${quote.total.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-3 font-bold text-gray-900">Outstanding</td>
                <td className="py-0.5 text-right font-bold">${quote.total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Customer Info */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <h3 className="font-bold text-gray-900 mb-1 text-xs">Customer Billing</h3>
            <div className="text-xs text-gray-700 leading-tight">
              <p>{quote.customer_name}</p>
              {quote.customer_company && <p>{quote.customer_company}</p>}
              {quote.billing_address?.line1 && <p>{quote.billing_address.line1}</p>}
              {quote.billing_address?.city && (
                <p>{quote.billing_address.city}, {quote.billing_address.state} {quote.billing_address.zip}</p>
              )}
              {quote.customer_phone && <p>{quote.customer_phone}</p>}
              {quote.customer_email && <p className="text-blue-600">{quote.customer_email}</p>}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-gray-900 mb-1 text-xs">Customer Shipping</h3>
            <div className="text-xs text-gray-700 leading-tight">
              {quote.shipping_address?.name && <p>{quote.shipping_address.name}</p>}
              {quote.shipping_address?.contact && <p>{quote.shipping_address.contact}</p>}
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
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">YXS</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">YS</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">YM</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">YL</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">YXL</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">XS</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">S</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">M</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">L</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">XL</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">2XL</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">3XL</th>
                  <th className="border border-gray-400 px-0.5 py-0.5 text-center font-semibold w-6">4XL</th>
                  <th className="border border-gray-400 px-1 py-0.5 text-center font-semibold">Qty</th>
                  <th className="border border-gray-400 px-1 py-0.5 text-right font-semibold">Price</th>
                  <th className="border border-gray-400 px-1 py-0.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const itemQty = (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
                                 (item.qty_yl || 0) + (item.qty_yxl || 0) + (item.qty_xs || 0) +
                                 (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) +
                                 (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
                                 (item.qty_4xl || 0);
                  return (
                    <tr key={idx}>
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
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{itemQty}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-right">${(item.unit_price || 0).toFixed(2)}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-right">${(item.total_price || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Imprints */}
        {imprints.length > 0 && (
          <div className="mb-3">
            {imprints.map((imprint, idx) => (
              <div key={idx} className="mb-2">
                <h4 className="font-bold text-xs text-gray-900 mb-0.5">
                  IMPRINT #{imprint.imprint_number || `${quote.quote_number}-${idx + 1}`}
                </h4>
                {imprint.decoration_method && (
                  <p className="text-xs text-gray-700 font-medium uppercase">{imprint.decoration_method}</p>
                )}
                {imprint.artwork_url && (
                  <img src={imprint.artwork_url} alt="Artwork" className="h-16 my-1 border border-gray-300" />
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

        {/* Totals */}
        <div className="flex justify-end mb-4">
          <div className="w-56 bg-gray-50 p-2 text-xs">
            <div className="flex justify-between py-0.5"><span className="text-gray-700">Total Quantity</span><span className="font-medium">{totalQty}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-700">Item Total</span><span className="font-medium">${itemTotal.toFixed(2)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-700">Fees Total</span><span className="font-medium">${feesTotal.toFixed(2)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-700">Sub Total</span><span className="font-medium">${quote.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-700">Tax</span><span className="font-medium">${quote.tax_amount.toFixed(2)}</span></div>
            <div className="flex justify-between py-0.5 border-t border-gray-400 mt-0.5 pt-0.5"><span className="font-bold text-gray-900">Total Due</span><span className="font-bold text-gray-900">${quote.total.toFixed(2)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-700">Paid</span><span className="font-medium">$0.00</span></div>
            <div className="flex justify-between py-0.5"><span className="text-gray-700">Outstanding</span><span className="font-medium">${quote.total.toFixed(2)}</span></div>
          </div>
        </div>

        {/* Terms */}
        <div className="pt-2 border-t border-gray-300 space-y-1" style={{ fontSize: '7pt', lineHeight: '1.3' }}>
          <p className="text-gray-700">
            <strong>Payment Terms:</strong> Unless you have a billing account set up or are ordering through a PO system, a 50% down payment is due before blank goods are ordered, and the remaining 50% balance is due at pickup.
          </p>
          <p className="text-gray-700">
            <strong>Artwork Proofs -</strong> All orders must have customer approval on artwork before production can begin. Once final approval has been made, we will proceed with production.
          </p>
          <p className="text-gray-700 font-semibold">This quote is good for 15 days.</p>
        </div>
      </div>

      {/* Approvals Section */}
      {approvals.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Approval Links</h2>
          <div className="space-y-3">
            {approvals.map((approval) => (
              <div key={approval.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {approval.is_used ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-blue-500" />}
                    <span className="font-medium text-gray-900 dark:text-white">{approval.is_used ? 'Used' : 'Active'}</span>
                  </div>
                  <button
                    onClick={() => copyApprovalLink(approval.approval_token)}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                {approval.responses?.map((response) => (
                  <div key={response.id} className={`p-2 rounded text-xs ${response.approved ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <div className="flex items-center gap-1">
                      {response.approved ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                      <span>{response.approved ? 'Approved' : 'Rejected'} by {response.approver_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Send Approval Link</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expires In (Days)</label>
                <input
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  min="1"
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="singleUse" checked={singleUse} onChange={(e) => setSingleUse(e.target.checked)} className="rounded" />
                <label htmlFor="singleUse" className="text-sm text-gray-700 dark:text-gray-300">Single-use link</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auto-Approve After (Days)</label>
                <input
                  type="number"
                  value={autoApproveAfterDays || ''}
                  onChange={(e) => setAutoApproveAfterDays(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Leave empty to disable"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  min="1"
                />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="autoConvert" checked={autoConvertOnApproval} onChange={(e) => setAutoConvertOnApproval(e.target.checked)} className="rounded" />
                <label htmlFor="autoConvert" className="text-sm text-gray-700 dark:text-gray-300">Auto-convert when approved</label>
              </div>
              <div className="flex gap-2 pt-4">
                <button onClick={() => setShowSendModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300">Cancel</button>
                <button onClick={handleSendApproval} disabled={sending} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
