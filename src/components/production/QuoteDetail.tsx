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
  Plus,
  Pencil,
} from 'lucide-react';
import { format } from 'date-fns';
import { ManageImprintsModal } from './ManageImprintsModal';

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

interface Proof {
  id: string;
  proof_number: string;
  line_item_id: string;
  imprint_id: string | null;
  group_label: string | null;
  garment_image_url: string | null;
  composite_image_url: string | null;
  garment_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  selected_colors?: Array<{ name: string; hex: string }>;
}

export default function QuoteDetail({ quoteId, onBack, onEdit }: QuoteDetailProps) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [quoteImprints, setQuoteImprints] = useState<QuoteImprint[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showManageImprints, setShowManageImprints] = useState(false);
  const [selectedGroupLabel, setSelectedGroupLabel] = useState<string>('');
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedProofImage, setSelectedProofImage] = useState<string>('');

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

      const { data: proofsData, error: proofsError } = await supabase
        .from('proofs')
        .select('id, proof_number, line_item_id, imprint_id, group_label, garment_image_url, composite_image_url, garment_name, status, created_at, updated_at, selected_colors')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false });

      if (!proofsError) {
        setProofs(proofsData || []);
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
        {/* Customer Info and Quote Details */}
        <div className="grid grid-cols-3 gap-6 p-8 border-b border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800">
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
              {quote.customer_email && (
                <p className="text-blue-600 dark:text-blue-400 mt-1">
                  <a href={`mailto:${quote.customer_email}`} className="hover:underline">{quote.customer_email}</a>
                </p>
              )}
              {quote.customer_phone && <p className="text-gray-700 dark:text-gray-300">{quote.customer_phone}</p>}
              {quote.bill_phone && <p className="text-gray-700 dark:text-gray-300">{quote.bill_phone}</p>}
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

          {/* Quote Details */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-3 text-sm">Quote Details</h3>
            <div className="text-sm space-y-2">
              {quote.po_number && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">PO #: </span>
                  <span className="text-gray-900 dark:text-white font-medium">{quote.po_number}</span>
                </div>
              )}
              {quote.delivery_method && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Delivery: </span>
                  <span className="text-gray-900 dark:text-white font-medium">{quote.delivery_method}</span>
                </div>
              )}
              {quote.customer_due_date && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Customer Due: </span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {format(new Date(quote.customer_due_date), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
              {quote.invoice_date && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Invoice Date: </span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {format(new Date(quote.invoice_date), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
              {quote.payment_due_date && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Payment Due: </span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {format(new Date(quote.payment_due_date), 'MMM d, yyyy')}
                  </span>
                </div>
              )}
              {quote.terms && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Terms: </span>
                  <span className="text-gray-900 dark:text-white font-medium">{quote.terms}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            {/* Only show main thead when no groups have labels */}
            {!itemGroups.some(([label]) => label) && (
              <thead className="bg-gray-100 dark:bg-slate-700/50 border-b-2 border-gray-300 dark:border-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Item #</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">Color</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-white min-w-[250px]">Description</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">YXS</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">YS</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">YM</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">YL</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">YXL</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">XS</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">S</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">M</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">L</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">XL</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">2XL</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">3XL</th>
                  <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">4XL</th>
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
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">YXS</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">YS</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">YM</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">YL</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">YXL</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">XS</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">S</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">M</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">L</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">XL</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">2XL</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">3XL</th>
                      <th className="px-2 py-3 text-center font-semibold text-gray-900 dark:text-white text-sm">4XL</th>
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
                      <td className="px-4 py-4 text-gray-700 dark:text-gray-300 font-mono text-base">
                        {item.item_number || '-'}
                      </td>
                      <td className="px-4 py-4 text-gray-700 dark:text-gray-300 text-base">
                        {item.color || '-'}
                      </td>
                      <td className="px-4 py-4 text-gray-900 dark:text-white text-base">
                        {item.description}
                        {item.notes && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">{item.notes}</p>
                        )}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_yxs || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_ys || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_ym || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_yl || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_yxl || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_xs || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_s || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_m || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_l || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_xl || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_2xl || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_3xl || ''}
                      </td>
                      <td className="px-2 py-4 text-center text-gray-700 dark:text-gray-300 text-sm">
                        {item.qty_4xl || ''}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-900 dark:text-white font-semibold text-base">
                        {itemQty}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700 dark:text-gray-300 text-base">
                        ${item.unit_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-900 dark:text-white font-semibold text-base">
                        ${item.total_price.toFixed(2)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
                  {/* List imprints for this group */}
                  <tr>
                    <td colSpan={18} className="px-4 py-2 bg-gray-50 dark:bg-slate-800/50">
                      <div className="space-y-3">
                        {/* List imprints for this group */}
                        {(() => {
                          // If there's only one group, show all imprints
                          const groupImprints = itemGroups.length === 1
                            ? quoteImprints
                            : quoteImprints.filter(imp =>
                                (imp as any).group_label === groupLabel ||
                                ((imp as any).group_label === null && quoteImprints.filter(i => (i as any).group_label === null).length > 0)
                              );
                          if (groupImprints.length === 0) return null;

                          const garmentItem = groupItems.find(li => li.line_type === 'garment');
                          const firstLineItem = garmentItem || groupItems[0];

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {groupImprints.filter((imprint) => {
                                const matchingProof = proofs.find(proof =>
                                  proof.imprint_id === imprint.id ||
                                  (proof.group_label === groupLabel && proof.imprint_id === null)
                                );
                                return matchingProof && (
                                  (matchingProof.selected_colors && matchingProof.selected_colors.length > 0) ||
                                  matchingProof.composite_image_url ||
                                  matchingProof.garment_image_url
                                );
                              }).map((imprint, idx) => {
                                const matchingProof = proofs.find(proof =>
                                  proof.imprint_id === imprint.id ||
                                  (proof.group_label === groupLabel && proof.imprint_id === null)
                                );

                                return (
                                  <div
                                    key={imprint.id}
                                    className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg p-3"
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                                        {quote.quote_number}-{String(idx + 1).padStart(2, '0')}
                                      </span>
                                      <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                                        {imprint.type_of_work}
                                      </span>
                                    </div>
                                    <div className="flex items-start justify-between mb-1">
                                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {imprint.location}
                                      </div>
                                      {matchingProof?.selected_colors && matchingProof.selected_colors.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap justify-end ml-2">
                                          {matchingProof.selected_colors.map((color, colorIdx) => {
                                            const colorHex = typeof color === 'string' ? '#cccccc' : (color.hex || '#cccccc');
                                            const colorName = typeof color === 'string' ? color : (color.name || 'Unknown');
                                            return (
                                              <div
                                                key={colorIdx}
                                                className="w-4 h-4 rounded border border-gray-400 dark:border-gray-500 shadow-sm"
                                                style={{ backgroundColor: colorHex }}
                                                title={colorName}
                                              />
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    {imprint.details && (
                                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                        {imprint.details}
                                      </div>
                                    )}

                                    {matchingProof && (matchingProof.composite_image_url || matchingProof.garment_image_url) && (
                                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                                        <div className="flex items-center justify-end mb-2">
                                          <button
                                            onClick={() => {
                                              setSelectedGroupLabel(groupLabel);
                                              setShowManageImprints(true);
                                            }}
                                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded border border-blue-200 dark:border-blue-800 transition-colors"
                                            title="Edit Proof"
                                          >
                                            <Pencil className="w-3 h-3" />
                                            Edit
                                          </button>
                                        </div>
                                        <img
                                          src={matchingProof.composite_image_url || matchingProof.garment_image_url!}
                                          alt={matchingProof.garment_name || 'Proof'}
                                          className="w-full h-48 object-contain rounded border border-gray-200 dark:border-slate-600 cursor-pointer hover:border-blue-500 transition-all bg-white dark:bg-slate-800"
                                          onClick={() => {
                                            setSelectedProofImage(matchingProof.composite_image_url || matchingProof.garment_image_url!);
                                            setShowProofModal(true);
                                          }}
                                        />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{matchingProof.proof_number}</p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Fees Section */}
        {fees.length > 0 && (
          <div className="px-8 py-6 border-t border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800">
            <div className="flex justify-end">
              <div className="w-1/2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Additional Fees</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-slate-700/50 border-b border-gray-300 dark:border-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white text-sm">Fee</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white text-sm">Description</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-900 dark:text-white text-sm">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white text-sm">Amount</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white text-sm">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fees.map((fee) => {
                        const feeName = fee.description.includes(' - ') ? fee.description.split(' - ')[0] : fee.description;
                        const feeDescription = fee.description.includes(' - ') ? fee.description.split(' - ').slice(1).join(' - ') : '';

                        return (
                          <tr key={fee.id} className="border-b border-gray-200 dark:border-slate-700">
                            <td className="px-3 py-2 text-gray-900 dark:text-white text-sm">
                              {feeName}
                            </td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 text-sm">
                              {feeDescription || '-'}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300 text-sm">
                              {(fee as any).quantity || 1}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 text-sm">
                              ${fee.unit_price.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-900 dark:text-white font-semibold text-sm">
                              ${fee.total_price.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

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
            {/* Right: Totals */}
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

        {/* Invoice Creation Date */}
        <div className="p-8 border-t border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Created: <span className="font-medium text-gray-900 dark:text-white">
              {quote.created_date ? format(new Date(quote.created_date), 'MMMM d, yyyy') : format(new Date(quote.created_at), 'MMMM d, yyyy')}
            </span>
          </div>
        </div>
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

      <ManageImprintsModal
        isOpen={showManageImprints}
        onClose={() => {
          setShowManageImprints(false);
          setSelectedGroupLabel('');
          loadQuoteDetails();
        }}
        quoteId={quoteId}
        initialGroupLabel={selectedGroupLabel}
        quote={quote}
        lineItems={lineItems}
      />

      {showProofModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProofModal(false)}
        >
          <div
            className="relative max-w-6xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => setShowProofModal(false)}
                className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
              >
                <XCircle className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
            <div className="p-4 max-h-[90vh] overflow-auto">
              <img
                src={selectedProofImage}
                alt="Proof/Mockup"
                className="w-full h-auto object-contain"
                style={{ maxHeight: 'calc(90vh - 2rem)' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
