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
  const [items, setItems] = useState<any[]>([]);
  const [imprints, setImprints] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuoteData();
  }, [quoteId]);

  const loadQuoteData = async () => {
    setLoading(true);
    try {
      const [quoteRes, itemsRes, imprintsRes, feesRes, settingsRes] = await Promise.all([
        supabase.from('quotes').select('*').eq('id', quoteId).single(),
        supabase.from('quote_items').select('*').eq('quote_id', quoteId).order('sort_order'),
        supabase.from('quote_imprints').select('*').eq('quote_id', quoteId).order('sort_order'),
        supabase.from('quote_fees').select('*').eq('quote_id', quoteId).order('sort_order'),
        supabase.from('company_settings').select('*').maybeSingle(),
      ]);

      if (quoteRes.data) setQuote(quoteRes.data);
      if (itemsRes.data) setItems(itemsRes.data);
      if (imprintsRes.data) setImprints(imprintsRes.data);
      if (feesRes.data) setFees(feesRes.data);
      if (settingsRes.data) setCompanySettings(settingsRes.data);
    } catch (err) {
      console.error('Error loading quote:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`Quote #${quote.quote_number}`, 14, 20);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(quote.title, 14, 28);

    doc.setFontSize(10);
    doc.text('QUOTE', 190, 20, { align: 'right' });

    let yPos = 40;

    if (companySettings) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text("Todd's Sporting Goods", 14, yPos);
      yPos += 5;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('393 Cabot Street', 14, yPos);
      yPos += 5;
      doc.text('Beverly, Massachusetts 01915', 14, yPos);
      yPos += 5;
      doc.text('19789271600', 14, yPos);
      yPos += 5;
      doc.text('https://www.toddssportinggoods.com', 14, yPos);
      yPos += 5;
      doc.text('jamie@toddssportinggoods.com', 14, yPos);
    }

    yPos = 40;
    doc.text(`Created: ${new Date(quote.created_date).toLocaleDateString()}`, 140, yPos);
    yPos += 5;
    if (quote.due_date) {
      doc.text(`Customer Due Date: ${new Date(quote.due_date).toLocaleDateString()}`, 140, yPos);
      yPos += 5;
    }
    doc.text(`Terms: ${quote.terms}`, 140, yPos);
    yPos += 5;
    doc.text(`Total: $${quote.total.toFixed(2)}`, 140, yPos);
    yPos += 5;
    doc.text(`Outstanding: $${quote.outstanding.toFixed(2)}`, 140, yPos);

    yPos = 80;
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Billing', 14, yPos);
    doc.text('Customer Shipping', 110, yPos);
    yPos += 5;

    doc.setFont('helvetica', 'normal');
    if (quote.customer_billing_name) {
      doc.text(quote.customer_billing_name, 14, yPos);
      yPos += 5;
    }
    if (quote.customer_billing_contact) {
      doc.text(quote.customer_billing_contact, 14, yPos);
      yPos += 5;
    }
    if (quote.customer_billing_address_line1) {
      doc.text(quote.customer_billing_address_line1, 14, yPos);
      yPos += 5;
    }
    if (quote.customer_billing_address_line2) {
      doc.text(quote.customer_billing_address_line2, 14, yPos);
      yPos += 5;
    }
    if (quote.customer_billing_city) {
      doc.text(`${quote.customer_billing_city}, ${quote.customer_billing_state} ${quote.customer_billing_zip}`, 14, yPos);
      yPos += 5;
    }

    yPos = 90;
    if (quote.customer_shipping_name) {
      doc.text(quote.customer_shipping_name, 110, yPos);
      yPos += 5;
    }
    if (quote.customer_shipping_contact) {
      doc.text(quote.customer_shipping_contact, 110, yPos);
      yPos += 5;
    }
    if (quote.customer_shipping_address_line1) {
      doc.text(quote.customer_shipping_address_line1, 110, yPos);
      yPos += 5;
    }

    yPos = Math.max(yPos, 120);

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
        item.total_quantity || 0,
        `$${item.unit_price.toFixed(2)}`,
        `$${item.total_price.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Item #', 'Color', 'Description', 'YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Qty', 'Price', 'Total']],
        body: itemRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    if (imprints.length > 0) {
      imprints.forEach((imprint, idx) => {
        doc.setFont('helvetica', 'bold');
        doc.text(`IMPRINT #${imprint.imprint_number}`, 14, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.text(`${imprint.decoration_method} • ${imprint.num_colors} Color`, 14, yPos);
        yPos += 5;
        doc.text(imprint.location, 14, yPos);
        yPos += 10;
      });
    }

    if (fees.length > 0) {
      const feeRows = fees.map(fee => [
        fee.fee_name,
        fee.description,
        fee.quantity,
        `$${fee.unit_amount.toFixed(2)}`,
        `$${fee.total_amount.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Fee', 'Description', 'Qty', 'Amount', 'Total']],
        body: feeRows,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    doc.setFont('helvetica', 'normal');
    doc.text(`Total Quantity: ${items.reduce((sum, item) => sum + item.total_quantity, 0)}`, 140, yPos);
    yPos += 5;
    doc.text(`Item Total: $${quote.item_total.toFixed(2)}`, 140, yPos);
    yPos += 5;
    doc.text(`Fees Total: $${quote.fees_total.toFixed(2)}`, 140, yPos);
    yPos += 5;
    doc.text(`Sub Total: $${quote.subtotal.toFixed(2)}`, 140, yPos);
    yPos += 5;
    doc.text(`Tax: $${quote.tax.toFixed(2)}`, 140, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Due: $${quote.total.toFixed(2)}`, 140, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`Paid: $${quote.paid.toFixed(2)}`, 140, yPos);
    yPos += 5;
    doc.text(`Outstanding: $${quote.outstanding.toFixed(2)}`, 140, yPos);

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

        <div className="flex-1 overflow-y-auto p-8 bg-gray-100 dark:bg-slate-900">
          <div className="bg-white shadow-lg rounded-lg p-8 max-w-5xl mx-auto" style={{ minHeight: '11in' }}>
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Quote #{quote.quote_number}</h1>
                <p className="text-lg text-gray-700">{quote.title}</p>
              </div>
              <div className="px-4 py-2 border-2 border-orange-500 text-orange-500 font-bold rounded">
                QUOTE
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Todd's Sporting Goods</h2>
                  <p className="text-sm text-gray-700">393 Cabot Street</p>
                  <p className="text-sm text-gray-700">Beverly, Massachusetts 01915</p>
                  <p className="text-sm text-gray-700">19789271600</p>
                  <p className="text-sm text-blue-600">https://www.toddssportinggoods.com</p>
                  <p className="text-sm text-blue-600">jamie@toddssportinggoods.com</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Created</span>
                    <span className="text-gray-900">{new Date(quote.created_date).toLocaleDateString()}</span>
                  </div>
                  {quote.due_date && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Customer Due Date</span>
                      <span className="text-gray-900">{new Date(quote.due_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Terms</span>
                    <span className="text-gray-900">{quote.terms}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium text-gray-700">Total</span>
                    <span className="font-bold text-gray-900">${quote.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Outstanding</span>
                    <span className="font-bold text-gray-900">${quote.outstanding.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Customer Billing</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  {quote.customer_billing_name && <p>{quote.customer_billing_name}</p>}
                  {quote.customer_billing_contact && <p>{quote.customer_billing_contact}</p>}
                  {quote.customer_billing_address_line1 && <p>{quote.customer_billing_address_line1}</p>}
                  {quote.customer_billing_address_line2 && <p>{quote.customer_billing_address_line2}</p>}
                  {quote.customer_billing_city && (
                    <p>{quote.customer_billing_city}, {quote.customer_billing_state} {quote.customer_billing_zip}</p>
                  )}
                  {quote.customer_billing_phone && <p>{quote.customer_billing_phone}</p>}
                  {quote.customer_billing_email && <p className="text-blue-600">{quote.customer_billing_email}</p>}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-3">Customer Shipping</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  {quote.customer_shipping_name && <p>{quote.customer_shipping_name}</p>}
                  {quote.customer_shipping_contact && <p>{quote.customer_shipping_contact}</p>}
                  {quote.customer_shipping_address_line1 && <p>{quote.customer_shipping_address_line1}</p>}
                  {quote.customer_shipping_address_line2 && <p>{quote.customer_shipping_address_line2}</p>}
                  {quote.customer_shipping_city && (
                    <p>{quote.customer_shipping_city}, {quote.customer_shipping_state} {quote.customer_shipping_zip}</p>
                  )}
                </div>
              </div>
            </div>

            {items.length > 0 && (
              <div className="mb-6 overflow-x-auto">
                <table className="w-full border border-gray-300 text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-2 py-2 text-left">Item #</th>
                      <th className="border border-gray-300 px-2 py-2 text-left">Color</th>
                      <th className="border border-gray-300 px-2 py-2 text-left">Description</th>
                      <th className="border border-gray-300 px-1 py-2">YXS</th>
                      <th className="border border-gray-300 px-1 py-2">YS</th>
                      <th className="border border-gray-300 px-1 py-2">YM</th>
                      <th className="border border-gray-300 px-1 py-2">YL</th>
                      <th className="border border-gray-300 px-1 py-2">YXL</th>
                      <th className="border border-gray-300 px-1 py-2">XS</th>
                      <th className="border border-gray-300 px-1 py-2">S</th>
                      <th className="border border-gray-300 px-1 py-2">M</th>
                      <th className="border border-gray-300 px-1 py-2">L</th>
                      <th className="border border-gray-300 px-1 py-2">XL</th>
                      <th className="border border-gray-300 px-1 py-2">2XL</th>
                      <th className="border border-gray-300 px-1 py-2">3XL</th>
                      <th className="border border-gray-300 px-2 py-2">Qty</th>
                      <th className="border border-gray-300 px-2 py-2">Price</th>
                      <th className="border border-gray-300 px-2 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-300 px-2 py-2">{item.item_number}</td>
                        <td className="border border-gray-300 px-2 py-2">{item.color}</td>
                        <td className="border border-gray-300 px-2 py-2">{item.description}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_yxs || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_ys || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_ym || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_yl || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_yxl || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_xs || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_s || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_m || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_l || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_xl || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_2xl || ''}</td>
                        <td className="border border-gray-300 px-1 py-2 text-center">{item.qty_3xl || ''}</td>
                        <td className="border border-gray-300 px-2 py-2 text-center">{item.total_quantity}</td>
                        <td className="border border-gray-300 px-2 py-2 text-right">${item.unit_price.toFixed(2)}</td>
                        <td className="border border-gray-300 px-2 py-2 text-right">${item.total_price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {imprints.length > 0 && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                {imprints.map((imprint, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded">
                    <h4 className="font-bold text-sm text-gray-900 mb-2">IMPRINT #{imprint.imprint_number}</h4>
                    <p className="text-xs text-gray-700 mb-1">
                      {imprint.decoration_method} • {imprint.num_colors} Color
                    </p>
                    <p className="text-xs text-gray-700 font-medium">{imprint.location}</p>
                    {imprint.description && <p className="text-xs text-gray-600 mt-1">{imprint.description}</p>}
                  </div>
                ))}
              </div>
            )}

            {fees.length > 0 && (
              <div className="mb-6">
                <table className="w-full border border-gray-300 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-3 py-2 text-left">Fee</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Description</th>
                      <th className="border border-gray-300 px-3 py-2 text-center">Qty</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Amount</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fees.map((fee, idx) => (
                      <tr key={idx}>
                        <td className="border border-gray-300 px-3 py-2">{fee.fee_name}</td>
                        <td className="border border-gray-300 px-3 py-2">{fee.description}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">{fee.quantity}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">${fee.unit_amount.toFixed(2)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">${fee.total_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <div className="w-80 bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Total Quantity</span>
                  <span className="font-medium">{items.reduce((sum, item) => sum + item.total_quantity, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Item Total</span>
                  <span className="font-medium">${quote.item_total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Fees Total</span>
                  <span className="font-medium">${quote.fees_total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-700">Sub Total</span>
                  <span className="font-medium">${quote.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Tax</span>
                  <span className="font-medium">${quote.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t-2 border-gray-400 pt-2">
                  <span className="font-bold text-gray-900">Total Due</span>
                  <span className="font-bold text-gray-900 text-lg">${quote.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Paid</span>
                  <span className="font-medium">${quote.paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Outstanding</span>
                  <span className="font-medium">${quote.outstanding.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-300 text-xs text-gray-600 space-y-3">
              <p>
                <strong>Payment Terms:</strong> Unless you have a billing account set up or are ordering through a PO system,
                a 50% down payment is due before blank goods are ordered, and the remaining 50% balance is due at pickup.
                All orders must be signed for at pickup, and signing off on your order confirms you have received the correct
                products, quantities, colors and sizes.
              </p>
              <p>
                <strong>Artwork Proofs:</strong> All orders must have customer approval on artwork before production can begin.
                Once final approval has been made, we will proceed with production. No refunds, returns or reprints due to
                approving artwork with incorrect spelling, placement or colors.
              </p>
              <p>
                <strong>Ink/Thread Colors:</strong> We use standard, stock ink and thread colors that we order from our suppliers.
                The colors you see on your proof are considered stock colors. If you have specific colors that you need, please
                provide us with a Pantone Color, a HEX value, or CMYK/RGB value to work from.
              </p>
              <p className="font-medium">This quote is good for 15 days.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
