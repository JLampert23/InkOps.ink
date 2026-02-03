import { useEffect, useState } from 'react';
import { X, Download, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface QuotePreviewProps {
  quoteId: string;
  onClose: () => void;
}

export function QuotePreview({ quoteId, onClose }: QuotePreviewProps) {
  const [quote, setQuote] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuoteData();
  }, [quoteId]);

  const loadQuoteData = async () => {
    setLoading(true);
    try {
      const [quoteRes, itemsRes, settingsRes] = await Promise.all([
        supabase.from('quotes').select('*').eq('id', quoteId).single(),
        supabase.from('quote_line_items').select('*').eq('quote_id', quoteId).order('line_number'),
        supabase.from('company_settings').select('*').maybeSingle(),
      ]);

      if (quoteRes.data) setQuote(quoteRes.data);
      if (itemsRes.data) setLineItems(itemsRes.data);
      if (settingsRes.data) setCompanySettings(settingsRes.data);
    } catch (err) {
      console.error('Error loading quote:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    const companyName = quote.company_name || "Todd's Sporting Goods";
    const companyAddress = quote.company_address || '393 Cabot Street';
    const companyCity = quote.company_city || 'Beverly';
    const companyState = quote.company_state || 'Massachusetts';
    const companyZip = quote.company_zip || '01915';
    const companyPhone = quote.company_phone || '19789271600';
    const companyWebsite = quote.company_website || 'https://www.toddssportinggoods.com';
    const companyEmail = quote.company_email || 'jamie@toddssportinggoods.com';

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('QUOTE', 14, 18);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.quote_number, 14, 26);

    let yPos = 45;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 14, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(companyAddress, 14, yPos);
    yPos += 4;
    doc.text(`${companyCity}, ${companyState} ${companyZip}`, 14, yPos);
    yPos += 4;
    doc.text(companyPhone, 14, yPos);
    yPos += 4;
    doc.setTextColor(0, 0, 255);
    doc.text(companyWebsite, 14, yPos);
    yPos += 4;
    doc.text(companyEmail, 14, yPos);
    doc.setTextColor(0, 0, 0);

    yPos = 45;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Delivery Method', 120, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.delivery_method || 'PICK-UP', 170, yPos);
    yPos += 5;

    if (quote.po_number) {
      doc.setFont('helvetica', 'bold');
      doc.text('PO #', 120, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(quote.po_number, 170, yPos);
      yPos += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Created', 120, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(quote.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 170, yPos);
    yPos += 5;

    if (quote.valid_until) {
      doc.setFont('helvetica', 'bold');
      doc.text('Customer Due Date', 120, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(quote.valid_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 170, yPos);
      yPos += 5;
    }

    if (quote.invoice_date) {
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice Date', 120, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(quote.invoice_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 170, yPos);
      yPos += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Terms', 120, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.terms || 'Net 30', 170, yPos);
    yPos += 5;

    if (quote.payment_due_date) {
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Due Date', 120, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(quote.payment_due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 170, yPos);
      yPos += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Total', 120, yPos);
    doc.text(`$${quote.total.toFixed(2)}`, 170, yPos);
    yPos += 5;
    doc.text('Outstanding', 120, yPos);
    doc.text(`$${quote.total.toFixed(2)}`, 170, yPos);

    yPos = 85;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Billing', 14, yPos);
    doc.text('Customer Shipping', 75, yPos);
    doc.text('Customer Notes', 136, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const billing = quote.billing_address || {};
    const shipping = quote.shipping_address || {};

    let billingY = yPos;
    doc.text(quote.customer_name || '', 14, billingY);
    billingY += 4;
    if (quote.customer_company) {
      doc.text(quote.customer_company, 14, billingY);
      billingY += 4;
    }
    if (billing.line1) {
      doc.text(billing.line1, 14, billingY);
      billingY += 4;
    }
    if (billing.city) {
      doc.text(`${billing.city}, ${billing.state || ''} ${billing.zip || ''}`, 14, billingY);
      billingY += 4;
    }
    if (quote.customer_phone) {
      doc.text(quote.customer_phone, 14, billingY);
      billingY += 4;
    }
    if (quote.customer_email) {
      doc.setTextColor(0, 0, 255);
      doc.text(quote.customer_email, 14, billingY);
      doc.setTextColor(0, 0, 0);
    }

    let shippingY = yPos;
    if (shipping.name) {
      doc.text(shipping.name, 75, shippingY);
      shippingY += 4;
    }
    if (shipping.contact) {
      doc.text(shipping.contact, 75, shippingY);
      shippingY += 4;
    }

    if (quote.customer_notes) {
      doc.text(doc.splitTextToSize(quote.customer_notes, 60), 136, yPos);
    }

    yPos = Math.max(billingY, shippingY, yPos + 20);

    const items = lineItems.filter(item => item.line_type === 'item' || !item.line_type);
    const fees = lineItems.filter(item => item.line_type === 'fee');
    const imprints = lineItems.filter(item => item.line_type === 'imprint');

    if (items.length > 0) {
      const itemRows = items.map(item => [
        item.item_number || '',
        item.color || '',
        item.description || '',
        item.qty_yxs || '',
        item.qty_ys || '',
        item.qty_ym || '',
        item.qty_yl || '',
        item.qty_yxl || '',
        item.qty_xs || '',
        item.qty_s || '',
        item.qty_m || '',
        item.qty_l || '',
        item.qty_xl || '',
        item.qty_2xl || '',
        item.qty_3xl || '',
        item.qty_4xl || '',
        item.quantity || 0,
        `$${(item.unit_price || 0).toFixed(2)}`,
        `$${(item.total_price || 0).toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Item #', 'Color', 'Description', 'YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Qty', 'Price', 'Total']],
        body: itemRows,
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 0.5 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      });

      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    if (imprints.length > 0) {
      imprints.forEach((imprint) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`IMPRINT #${imprint.imprint_number || ''}`, 14, yPos);
        yPos += 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        if (imprint.decoration_method) {
          doc.text(`${imprint.decoration_method.toUpperCase()}`, 14, yPos);
          yPos += 4;
        }
        if (imprint.description) {
          doc.text(imprint.description, 14, yPos);
          yPos += 4;
        }
        yPos += 4;
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
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      });

      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const totalQty = items.reduce((sum, item) => {
      return sum + (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) + (item.qty_yl || 0) +
             (item.qty_yxl || 0) + (item.qty_xs || 0) + (item.qty_s || 0) + (item.qty_m || 0) +
             (item.qty_l || 0) + (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) + (item.qty_4xl || 0);
    }, 0);
    const itemTotal = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const feesTotal = fees.reduce((sum, fee) => sum + (fee.total_price || 0), 0);

    doc.text('Total Quantity', 140, yPos);
    doc.text(totalQty.toString(), 185, yPos);
    yPos += 5;
    doc.text('Item Total', 140, yPos);
    doc.text(`$${itemTotal.toFixed(2)}`, 185, yPos);
    yPos += 5;
    doc.text('Fees Total', 140, yPos);
    doc.text(`$${feesTotal.toFixed(2)}`, 185, yPos);
    yPos += 5;
    doc.text('Sub Total', 140, yPos);
    doc.text(`$${quote.subtotal.toFixed(2)}`, 185, yPos);
    yPos += 5;
    doc.text('Tax', 140, yPos);
    doc.text(`$${quote.tax_amount.toFixed(2)}`, 185, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Due', 140, yPos);
    doc.text(`$${quote.total.toFixed(2)}`, 185, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Paid', 140, yPos);
    doc.text('$0.00', 185, yPos);
    yPos += 5;
    doc.text('Outstanding', 140, yPos);
    doc.text(`$${quote.total.toFixed(2)}`, 185, yPos);

    yPos += 10;
    doc.setFontSize(7);
    const terms = [
      'Payment Terms: Unless you have a billing account set up or are ordering through a PO system, a 50% down payment is due before blank goods are ordered, and the remaining 50% balance is due at pickup. All orders must be signed for at pickup, and signing off on your order confirms you have received the correct products, quantities, colors and sizes.',
      '',
      'Artwork Proofs - All orders must have customer approval on artwork before production can begin. Once final approval has been made, we will proceed with production. No refunds, returns or reprints due to approving artwork with incorrect spelling, placement or colors. Your proof is an approximate representation of location and size, but sizing (appearance) and placement will change across different sizes of shirts (i.e. the print will be placed and look different on a youth medium vs. an adult xlarge).',
    ];

    terms.forEach(term => {
      const lines = doc.splitTextToSize(term, 180);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 3;
    });

    doc.save(`quote-${quote.quote_number}.pdf`);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quote Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-slate-900">
          <div className="bg-white shadow-lg p-6 max-w-[8.5in] mx-auto" style={{ minHeight: '11in', fontSize: '9pt' }}>
            {/* Header */}
            <div className="flex items-start justify-between mb-3 pb-3 border-b border-gray-300">
              <div>
                <h1 className="text-lg font-bold text-gray-900 mb-0.5">{quote.quote_number}</h1>
                <p className="text-sm text-gray-600 uppercase">{quote.customer_name}</p>
              </div>
            </div>

            {/* Company Info and Invoice Details Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Left: Company Info with Logo */}
              <div className="flex gap-3">
                {quote.company_logo_url && (
                  <img src={quote.company_logo_url} alt="Company Logo" className="h-16 w-auto object-contain" />
                )}
                <div className="text-xs leading-tight">
                  <h2 className="font-bold text-gray-900 uppercase mb-0.5">
                    {quote.company_name || "Todd's Sporting Goods"}
                  </h2>
                  <div className="text-gray-700 space-y-0">
                    <p>{quote.company_address || '393 Cabot Street'}</p>
                    <p>
                      {quote.company_city || 'Beverly'}, {quote.company_state || 'Massachusetts'} {quote.company_zip || '01915'}
                    </p>
                    <p>{quote.company_phone || '19789271600'}</p>
                    <p className="text-blue-600">{quote.company_website || 'https://www.toddssportinggoods.com'}</p>
                    <p className="text-blue-600">{quote.company_email || 'jamie@toddssportinggoods.com'}</p>
                  </div>
                </div>
              </div>

              {/* Right: Invoice Details Table */}
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
                        {new Date(quote.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                    {quote.valid_until && (
                      <tr className="border-b border-gray-200">
                        <td className="py-0.5 pr-2 font-semibold text-gray-700">Customer Due Date</td>
                        <td className="py-0.5 text-right">
                          {new Date(quote.valid_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    )}
                    {quote.invoice_date && (
                      <tr className="border-b border-gray-200">
                        <td className="py-0.5 pr-2 font-semibold text-gray-700">Invoice Date</td>
                        <td className="py-0.5 text-right">
                          {new Date(quote.invoice_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-200">
                      <td className="py-0.5 pr-2 font-semibold text-gray-700">Terms</td>
                      <td className="py-0.5 text-right">{quote.terms || 'Net 30'}</td>
                    </tr>
                    {quote.payment_due_date && (
                      <tr className="border-b border-gray-200">
                        <td className="py-0.5 pr-2 font-semibold text-gray-700">Payment Due Date</td>
                        <td className="py-0.5 text-right">
                          {new Date(quote.payment_due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-200">
                      <td className="py-0.5 pr-2 font-bold text-gray-900">Total</td>
                      <td className="py-0.5 text-right font-bold">${quote.total.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-2 font-bold text-gray-900">Outstanding</td>
                      <td className="py-0.5 text-right font-bold">${quote.total.toFixed(2)}</td>
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
                <div className="text-xs text-gray-700 leading-tight space-y-0">
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
            {lineItems.filter(item => item.line_type === 'item' || !item.line_type).length > 0 && (
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
                    {(() => {
                      const items = lineItems.filter(item => item.line_type === 'item' || !item.line_type);
                      const groupedItems = items.reduce((acc, item) => {
                        const groupLabel = (item as any).group_label || '';
                        if (!acc[groupLabel]) {
                          acc[groupLabel] = [];
                        }
                        acc[groupLabel].push(item);
                        return acc;
                      }, {} as Record<string, any[]>);
                      const itemGroups = Object.entries(groupedItems);

                      return itemGroups.map(([groupLabel, groupItems], groupIdx) => (
                        <>
                          {groupLabel && (
                            <tr key={`group-${groupIdx}`} className="bg-gray-200">
                              <td colSpan={18} className="border border-gray-400 px-2 py-1 font-bold text-gray-900">
                                {groupLabel}
                              </td>
                            </tr>
                          )}
                          {groupItems.map((item, idx) => {
                            const totalQty = (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
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
                                <td className="border border-gray-400 px-1 py-0.5 text-center">{totalQty}</td>
                                <td className="border border-gray-400 px-1 py-0.5 text-right">${(item.unit_price || 0).toFixed(2)}</td>
                                <td className="border border-gray-400 px-1 py-0.5 text-right">${(item.total_price || 0).toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {/* Imprint Section */}
            {lineItems.filter(item => item.line_type === 'imprint').length > 0 && (
              <div className="mb-3">
                {lineItems.filter(item => item.line_type === 'imprint').map((imprint, idx) => (
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
            {lineItems.filter(item => item.line_type === 'fee').length > 0 && (
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
                    {lineItems.filter(item => item.line_type === 'fee').map((fee, idx) => (
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
                  <span className="font-medium">
                    {lineItems.filter(item => item.line_type === 'item' || !item.line_type).reduce((sum, item) => {
                      return sum + (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
                             (item.qty_yl || 0) + (item.qty_yxl || 0) + (item.qty_xs || 0) +
                             (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) +
                             (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
                             (item.qty_4xl || 0);
                    }, 0)}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Item Total</span>
                  <span className="font-medium">
                    ${lineItems.filter(item => item.line_type === 'item' || !item.line_type)
                      .reduce((sum, item) => sum + (item.total_price || 0), 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Fees Total</span>
                  <span className="font-medium">
                    ${lineItems.filter(item => item.line_type === 'fee')
                      .reduce((sum, item) => sum + (item.total_price || 0), 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Sub Total</span>
                  <span className="font-medium">${quote.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Tax</span>
                  <span className="font-medium">${quote.tax_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5 border-t border-gray-400 mt-0.5 pt-0.5">
                  <span className="font-bold text-gray-900">Total Due</span>
                  <span className="font-bold text-gray-900">${quote.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Paid</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-gray-700">Outstanding</span>
                  <span className="font-medium">${quote.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div className="mt-4 pt-2 border-t border-gray-300 space-y-1" style={{ fontSize: '7pt', lineHeight: '1.3' }}>
              <p className="text-gray-700">
                <strong>Payment Terms:</strong> Unless you have a billing account set up or are ordering through a PO system, a 50% down payment is due before blank goods are ordered, and the remaining 50% balance is due at pickup. All orders must be signed for at pickup, and signing off on your order confirms you have received the correct products, quantities, colors and sizes.
              </p>
              <p className="text-gray-700">
                <strong>Artwork Proofs -</strong> All orders must have customer approval on artwork before production can begin. Once final approval has been made, we will proceed with production. No refunds, returns or reprints due to approving artwork with incorrect spelling, placement or colors. Your proof is an approximate representation of location and size, but sizing (appearance) and placement will change across different sizes of shirts (i.e. the print will be placed and look different on a youth medium vs. an adult xlarge).
              </p>
              <p className="text-gray-700">
                <strong>Ink/Thread Colors:</strong> We use standard, stock ink and thread colors that we order from our suppliers. The colors you see on your proof are considered stock colors. The color(s) you see on your proof are a close, but not exact representation of these ink or thread colors. If you have specific colors that you need, please provide us with a Pantone Color, a HEX value, or CMYK/RGB value to work from.
              </p>
              <p className="text-gray-700">
                <strong>Custom Colors (screen printing ink only):</strong> Colors are matched as closely as possible using the Pantone Matching System. We cannot guarantee a 100% color match to computer monitors or digital screens. Please be aware that colors appear slightly different on every computer screen or monitor. If you have questions or concerns about color accuracy, the best option is to come by our shop with printed samples, view our on hand Pantone Matching Chart, or view our in house inventory of inks.
              </p>
              <p className="text-gray-700">
                Customization on customer supplied goods is none refundable, including but not limited to digitized files and artwork.
              </p>
              <p className="text-gray-700">
                Please be aware that prices on blank goods and materials are in a continuous state of change, so this pricing is based on what we are paying for blank goods and materials today.
              </p>
              <p className="text-gray-700 font-semibold">This quote is good for 15 days.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
