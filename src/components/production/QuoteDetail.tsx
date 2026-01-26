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
import { format } from 'date-fns';

interface QuoteDetailProps {
  quoteId: string;
  onBack: () => void;
  onEdit: () => void;
}

interface Quote {
  id: string;
  quote_number: string;
  nickname?: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  customer_company: string;
  customer_phone: string;
  bill_company?: string;
  bill_name?: string;
  bill_address_1?: string;
  bill_address_2?: string;
  bill_city?: string;
  bill_state?: string;
  bill_zip?: string;
  bill_phone?: string;
  bill_email?: string;
  ship_company?: string;
  ship_name?: string;
  ship_address_1?: string;
  ship_address_2?: string;
  ship_city?: string;
  ship_state?: string;
  ship_zip?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  discount_type?: string;
  total: number;
  status: string;
  valid_until: string | null;
  created_at: string;
  created_date?: string;
  customer_due_date?: string;
  production_due_date?: string;
  sent_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  converted_at?: string | null;
  customer_notes: string | null;
  notes: string | null;
  production_notes?: string | null;
  delivery_method: string | null;
  po_number: string | null;
  terms: string | null;
  payment_due_date: string | null;
  invoice_date: string | null;
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
  line_type: string;
  item_number?: string;
  description: string;
  unit_price: number;
  total_price: number;
  color?: string;
  notes?: string;
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

interface QuoteImprint {
  id: string;
  location: string;
  type_of_work: string;
  details?: string;
  matrix?: string;
  column_number?: string;
  pricing_matrix_column?: string;
  thread_ink_color?: string;
  mockups?: any[];
}

export default function QuoteDetail({ quoteId, onBack, onEdit }: QuoteDetailProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [quoteImprints, setQuoteImprints] = useState<QuoteImprint[]>([]);
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
    try {
      setLoading(true);
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

      // If quote has customer_id, fetch customer zip codes
      if (quoteData.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('billing_zip, shipping_zip')
          .eq('id', quoteData.customer_id)
          .maybeSingle();

        if (customerData) {
          // Merge customer zip codes into quote if quote doesn't have them
          if (!quoteData.bill_zip && customerData.billing_zip) {
            quoteData.bill_zip = customerData.billing_zip;
          }
          if (!quoteData.ship_zip && customerData.shipping_zip) {
            quoteData.ship_zip = customerData.shipping_zip;
          }
        }
      }

      setQuote(quoteData);

      const { data: itemsData, error: itemsError } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at');

      if (itemsError) throw itemsError;
      setLineItems(itemsData || []);

      const { data: imprintsData, error: imprintsError } = await supabase
        .from('quote_imprints')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order');

      if (!imprintsError) {
        setQuoteImprints(imprintsData || []);
      }
    } catch (error) {
      console.error('Error loading quote:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendApproval = async () => {
    try {
      setSending(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-actions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_approval',
          quote_id: quoteId,
          expires_in_days: expiresInDays,
          single_use: singleUse,
          auto_approve_after_days: autoApproveAfterDays,
          auto_convert_on_approval: autoConvertOnApproval,
        }),
      });

      if (!response.ok) throw new Error('Failed to send approval');

      alert('Quote sent for approval!');
      setShowSendModal(false);
      loadQuoteDetails();
    } catch (error) {
      console.error('Error sending approval:', error);
      alert('Failed to send approval');
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'expired': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'converted': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
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

  // Group items by group_label
  const groupedItems = items.reduce((acc, item) => {
    const groupLabel = (item as any).group_label || '';
    if (!acc[groupLabel]) {
      acc[groupLabel] = [];
    }
    acc[groupLabel].push(item);
    return acc;
  }, {} as Record<string, LineItem[]>);

  const itemGroups = Object.entries(groupedItems);

  const totalQty = items.reduce((sum, item) => {
    return sum + (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) + (item.qty_yl || 0) +
           (item.qty_yxl || 0) + (item.qty_xs || 0) + (item.qty_s || 0) + (item.qty_m || 0) +
           (item.qty_l || 0) + (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) + (item.qty_4xl || 0);
  }, 0);

  const feesTotal = fees.reduce((sum, fee) => sum + fee.total_price, 0);

  return (
    <div className="space-y-6">
      {/* Header Bar with Actions */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quote.quote_number}</h1>
            {quote.nickname && (
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-0.5">{quote.nickname}</p>
            )}
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(quote.status)}`}>
            {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(quote.status === 'draft' || quote.status === 'sent') && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Edit className="w-4 h-4" />
              Edit Quote
            </button>
          )}
          {quote.status === 'draft' && (
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
              Send to Customer
            </button>
          )}
        </div>
      </div>

      {/* Traditional Invoice Layout */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        {/* Header Section - Logo, Company Info, Key Dates */}
        <div className="p-8 border-b border-gray-300 dark:border-slate-600">
          <div className="flex items-start justify-between gap-8">
            {/* Left: Company Logo and Info */}
            <div className="flex items-start gap-6 flex-1">
              {quote.company_logo_url && (
                <img
                  src={quote.company_logo_url}
                  alt={quote.company_name || 'Company Logo'}
                  className="h-24 w-auto object-contain"
                />
              )}
              <div className="text-sm">
                {quote.company_name && (
                  <p className="font-bold text-lg text-gray-900 dark:text-white mb-2">{quote.company_name}</p>
                )}
                {quote.company_address && <p className="text-gray-700 dark:text-gray-300">{quote.company_address}</p>}
                {quote.company_city && (
                  <p className="text-gray-700 dark:text-gray-300">
                    {quote.company_city}, {quote.company_state} {quote.company_zip}
                  </p>
                )}
                {quote.company_phone && <p className="text-gray-700 dark:text-gray-300 mt-1">{quote.company_phone}</p>}
                {quote.company_website && (
                  <p className="text-blue-600 dark:text-blue-400 mt-1">
                    <a href={quote.company_website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {quote.company_website}
                    </a>
                  </p>
                )}
                {quote.company_email && (
                  <p className="text-blue-600 dark:text-blue-400">
                    <a href={`mailto:${quote.company_email}`} className="hover:underline">
                      {quote.company_email}
                    </a>
                  </p>
                )}
              </div>
            </div>

            {/* Right: Key Dates and Totals */}
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6 min-w-[320px]">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Created</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {quote.created_date ? format(new Date(quote.created_date), 'MMMM d, yyyy') : format(new Date(quote.created_at), 'MMMM d, yyyy')}
                  </span>
                </div>
                {quote.customer_due_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Customer Due Date</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {format(new Date(quote.customer_due_date), 'MMMM d, yyyy')}
                    </span>
                  </div>
                )}
                {quote.invoice_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Invoice Date</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {format(new Date(quote.invoice_date), 'MMMM d, yyyy')}
                    </span>
                  </div>
                )}
                {quote.payment_due_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Payment Due Date</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {format(new Date(quote.payment_due_date), 'MMMM d, yyyy')}
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-300 dark:border-slate-600 pt-2 mt-3">
                  <div className="flex justify-between text-base">
                    <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                    <span className="font-bold text-gray-900 dark:text-white">${quote.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base mt-1">
                    <span className="font-semibold text-gray-900 dark:text-white">Outstanding</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">${quote.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Billing and Shipping */}
        <div className="grid grid-cols-2 gap-8 p-8 border-b border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
          {/* Customer Billing */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Customer Billing</h3>
            <div className="text-sm space-y-0.5">
              {quote.bill_company && <p className="font-semibold text-gray-900 dark:text-white">{quote.bill_company}</p>}
              {quote.bill_name && <p className="text-gray-700 dark:text-gray-300">{quote.bill_name}</p>}
              {quote.bill_address_1 && <p className="text-gray-700 dark:text-gray-300">{quote.bill_address_1}</p>}
              {quote.bill_address_2 && <p className="text-gray-700 dark:text-gray-300">{quote.bill_address_2}</p>}
              {quote.bill_city && (
                <p className="text-gray-700 dark:text-gray-300">
                  {quote.bill_city}, {quote.bill_state} {quote.bill_zip}
                </p>
              )}
              {quote.bill_phone && <p className="text-gray-700 dark:text-gray-300 mt-1">{quote.bill_phone}</p>}
              {quote.bill_email && (
                <p className="text-blue-600 dark:text-blue-400">
                  <a href={`mailto:${quote.bill_email}`} className="hover:underline">{quote.bill_email}</a>
                </p>
              )}
              {!quote.bill_company && !quote.bill_name && !quote.bill_address_1 && (
                <p className="text-gray-500 dark:text-gray-400 italic">No billing address provided</p>
              )}
            </div>
          </div>

          {/* Customer Shipping */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Customer Shipping</h3>
            <div className="text-sm space-y-0.5">
              {quote.ship_company && <p className="font-semibold text-gray-900 dark:text-white">{quote.ship_company}</p>}
              {quote.ship_name && <p className="text-gray-700 dark:text-gray-300">{quote.ship_name}</p>}
              {quote.ship_address_1 && <p className="text-gray-700 dark:text-gray-300">{quote.ship_address_1}</p>}
              {quote.ship_address_2 && <p className="text-gray-700 dark:text-gray-300">{quote.ship_address_2}</p>}
              {quote.ship_city && (
                <p className="text-gray-700 dark:text-gray-300">
                  {quote.ship_city}, {quote.ship_state} {quote.ship_zip}
                </p>
              )}
              {!quote.ship_company && !quote.ship_name && !quote.ship_address_1 && (
                <p className="text-gray-500 dark:text-gray-400 italic">No shipping address provided</p>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Only show main thead when no groups have labels */}
            {!itemGroups.some(([label]) => label) && (
              <thead className="bg-gray-100 dark:bg-slate-700/50 border-b-2 border-gray-300 dark:border-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Item #</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Color</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white min-w-[250px]">Description</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">YXS</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">YS</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">YM</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">YL</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">YXL</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">XS</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">S</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">M</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">L</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">XL</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">2XL</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">3XL</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">4XL</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">Total</th>
                </tr>
              </thead>
            )}
            <tbody>
              {itemGroups.map(([groupLabel, groupItems], groupIdx) => (
                <React.Fragment key={`group-${groupIdx}`}>
                  {/* Spacer between groups */}
                  {groupIdx > 0 && (
                    <tr>
                      <td colSpan={18} className="h-4 bg-transparent"></td>
                    </tr>
                  )}
                  {/* Group header */}
                  {groupLabel && (
                    <tr className="bg-gray-100 dark:bg-slate-800 border-t-2 border-b-2 border-gray-300 dark:border-slate-600">
                      <td colSpan={18} className="px-4 py-3">
                        <div className="font-semibold text-gray-900 dark:text-white text-base">
                          {groupLabel}
                        </div>
                      </td>
                    </tr>
                  )}
                  {/* Show column headers for all groups when any group has a label */}
                  {itemGroups.some(([label]) => label) && (
                    <tr className="bg-gray-100 dark:bg-slate-700/50 border-b-2 border-gray-300 dark:border-slate-600">
                      <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Item #</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Color</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white min-w-[250px]">Description</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">YXS</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">YS</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">YM</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">YL</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">YXL</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">XS</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">S</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">M</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">L</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">XL</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">2XL</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">3XL</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-xs">4XL</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Qty</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">Price</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">Total</th>
                    </tr>
                  )}
                  {/* Group items */}
                  {groupItems.map((item) => {
                    const itemQty = (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
                                   (item.qty_yl || 0) + (item.qty_yxl || 0) + (item.qty_xs || 0) +
                                   (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) +
                                   (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
                                   (item.qty_4xl || 0);

                    return (
                      <React.Fragment key={item.id}>
                        <tr className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-4 text-gray-700 dark:text-gray-300 font-mono text-xs">
                        {item.item_number || '-'}
                      </td>
                      <td className="px-4 py-4 text-gray-700 dark:text-gray-300">
                        {item.color || '-'}
                      </td>
                      <td className="px-4 py-4 text-gray-900 dark:text-white">
                        {item.description}
                        {item.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{item.notes}</p>
                        )}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_yxs || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_ys || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_ym || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_yl || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_yxl || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_xs || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_s || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_m || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_l || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_xl || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_2xl || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_3xl || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-xs">
                        {item.qty_4xl || ''}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-900 dark:text-white font-semibold">
                        {itemQty}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700 dark:text-gray-300">
                        ${item.unit_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-900 dark:text-white font-semibold">
                        ${item.total_price.toFixed(2)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
                  {/* Imprint blocks under this group */}
                  {quoteImprints.length > 0 && (
                    <tr>
                      <td colSpan={18} className="px-4 py-2">
                        <div className="space-y-2">
                          {quoteImprints.map((imprint) => (
                            <div
                              key={imprint.id}
                              className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                      Imprint
                                    </span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      {imprint.location}
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                                      {imprint.type_of_work}
                                    </span>
                                    {imprint.thread_ink_color && (
                                      <span className="text-xs text-gray-600 dark:text-gray-400">
                                        Color: {imprint.thread_ink_color}
                                      </span>
                                    )}
                                    {imprint.pricing_matrix_column && (
                                      <span className="text-xs text-gray-600 dark:text-gray-400">
                                        {imprint.matrix} - {imprint.pricing_matrix_column}
                                      </span>
                                    )}
                                  </div>
                                  {imprint.details && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 ml-16">
                                      {imprint.details}
                                    </p>
                                  )}
                                </div>
                                <button
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
                                  onClick={() => {
                                    console.log('Open proof for imprint:', imprint.id);
                                  }}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Proof
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Imprints Section */}
        {imprints.length > 0 && (
          <div className="p-8 border-t border-gray-300 dark:border-slate-600">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {imprints.map((imprint, idx) => (
                <div key={imprint.id} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-6 border border-gray-200 dark:border-slate-600">
                  <h4 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">
                    IMPRINT #{quote.quote_number}-{idx + 1}
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {imprint.description}
                  </p>
                  {imprint.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">
                      {imprint.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals Summary */}
        <div className="p-8 border-t border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
          <div className="flex justify-end">
            <div className="w-80 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Total Quantity</span>
                <span className="text-gray-900 dark:text-white">{totalQty}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Item Total</span>
                <span className="text-gray-900 dark:text-white">${quote.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Fees Total</span>
                <span className="text-gray-900 dark:text-white">${feesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Sub Total</span>
                <span className="text-gray-900 dark:text-white">${quote.subtotal.toFixed(2)}</span>
              </div>
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-red-600 dark:text-red-400">
                  <span className="font-semibold">Discount</span>
                  <span>-${quote.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Tax</span>
                <span className="text-gray-900 dark:text-white">${quote.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t-2 border-gray-300 dark:border-slate-600 text-base">
                <span className="font-bold text-gray-900 dark:text-white">Total Due</span>
                <span className="font-bold text-gray-900 dark:text-white">${quote.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">Paid</span>
                <span className="text-gray-900 dark:text-white">$0.00</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="font-bold text-gray-900 dark:text-white">Outstanding</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">${quote.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms and Conditions */}
        {quote.terms && (
          <div className="p-8 border-t border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800">
            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
              <p className="whitespace-pre-wrap">{quote.terms}</p>
            </div>
          </div>
        )}
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Send Quote for Approval
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expires in (Days)
                </label>
                <input
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  min="1"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="singleUse"
                  checked={singleUse}
                  onChange={(e) => setSingleUse(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="singleUse" className="text-sm text-gray-700 dark:text-gray-300">
                  Single-use link
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Auto-Approve After (Days)
                </label>
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
                <input
                  type="checkbox"
                  id="autoConvert"
                  checked={autoConvertOnApproval}
                  onChange={(e) => setAutoConvertOnApproval(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="autoConvert" className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-convert when approved
                </label>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowSendModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendApproval}
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
