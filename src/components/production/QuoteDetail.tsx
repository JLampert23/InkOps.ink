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
  Mail,
  Phone,
  Building,
  Calendar,
  DollarSign,
  Package,
  Palette,
  MapPin,
  User,
  FileCheck,
  Truck,
  CreditCard,
  StickyNote,
  Tag,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  placement?: string | null;
  ink_colors?: string | null;
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
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load quote');
      }

      const data = await response.json();
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
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'expired': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'converted': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const exportToPDF = () => {
    if (!quote) return;
    alert('PDF export functionality available - use Preview to export formatted quote');
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

  return (
    <div className="space-y-6">
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
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Created {format(new Date(quote.created_at), 'MMM d, yyyy')}
            </p>
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
          {quote.status === 'approved' && (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Convert to Job
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Quote Overview */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5" />
                Quote Details
              </h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Quote Number</label>
                <p className="font-semibold text-gray-900 dark:text-white mt-1">{quote.quote_number}</p>
              </div>
              {quote.nickname && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Job Title</label>
                  <p className="font-semibold text-gray-900 dark:text-white mt-1">{quote.nickname}</p>
                </div>
              )}
              {quote.po_number && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">PO Number</label>
                  <p className="font-semibold text-gray-900 dark:text-white mt-1">{quote.po_number}</p>
                </div>
              )}
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Status</label>
                <p className="font-semibold text-gray-900 dark:text-white mt-1 capitalize">{quote.status}</p>
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Delivery Method</label>
                <p className="font-semibold text-gray-900 dark:text-white mt-1">{quote.delivery_method || 'PICK-UP'}</p>
              </div>
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Payment Terms</label>
                <p className="font-semibold text-gray-900 dark:text-white mt-1">{quote.terms || 'Net 30'}</p>
              </div>
            </div>
          </div>

          {/* Important Dates */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Important Dates
              </h2>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Created</label>
                <p className="font-semibold text-gray-900 dark:text-white mt-1">
                  {format(new Date(quote.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              {quote.valid_until && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Valid Until</label>
                  <p className="font-semibold text-gray-900 dark:text-white mt-1">
                    {format(new Date(quote.valid_until), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {quote.customer_due_date && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Customer Due Date</label>
                  <p className="font-semibold text-gray-900 dark:text-white mt-1">
                    {format(new Date(quote.customer_due_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {quote.production_due_date && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Production Due</label>
                  <p className="font-semibold text-gray-900 dark:text-white mt-1">
                    {format(new Date(quote.production_due_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {quote.invoice_date && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Invoice Date</label>
                  <p className="font-semibold text-gray-900 dark:text-white mt-1">
                    {format(new Date(quote.invoice_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {quote.payment_due_date && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Payment Due</label>
                  <p className="font-semibold text-gray-900 dark:text-white mt-1">
                    {format(new Date(quote.payment_due_date), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {quote.sent_at && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Sent</label>
                  <p className="font-semibold text-gray-900 dark:text-white mt-1">
                    {format(new Date(quote.sent_at), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {quote.approved_at && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Approved</label>
                  <p className="font-semibold text-green-600 dark:text-green-400 mt-1">
                    {format(new Date(quote.approved_at), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {quote.rejected_at && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Rejected</label>
                  <p className="font-semibold text-red-600 dark:text-red-400 mt-1">
                    {format(new Date(quote.rejected_at), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
              {quote.converted_at && (
                <div>
                  <label className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Converted</label>
                  <p className="font-semibold text-teal-600 dark:text-teal-400 mt-1">
                    {format(new Date(quote.converted_at), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Billing Address */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Billing Address
              </h2>
            </div>
            <div className="p-6 text-sm space-y-1">
              {quote.bill_company && <p className="font-semibold text-gray-900 dark:text-white">{quote.bill_company}</p>}
              {quote.bill_name && <p className="text-gray-700 dark:text-gray-300">{quote.bill_name}</p>}
              {quote.bill_address_1 && <p className="text-gray-700 dark:text-gray-300">{quote.bill_address_1}</p>}
              {quote.bill_address_2 && <p className="text-gray-700 dark:text-gray-300">{quote.bill_address_2}</p>}
              {quote.bill_city && (
                <p className="text-gray-700 dark:text-gray-300">
                  {quote.bill_city}, {quote.bill_state} {quote.bill_zip}
                </p>
              )}
              {quote.bill_phone && (
                <p className="text-gray-700 dark:text-gray-300 flex items-center gap-2 mt-2">
                  <Phone className="w-3 h-3" />
                  <a href={`tel:${quote.bill_phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                    {quote.bill_phone}
                  </a>
                </p>
              )}
              {quote.bill_email && (
                <p className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Mail className="w-3 h-3" />
                  <a href={`mailto:${quote.bill_email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                    {quote.bill_email}
                  </a>
                </p>
              )}
              {!quote.bill_company && !quote.bill_name && !quote.bill_address_1 && (
                <p className="text-gray-500 dark:text-gray-400 italic">No billing address provided</p>
              )}
            </div>
          </div>

          {/* Customer Shipping Address */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Shipping Address
              </h2>
            </div>
            <div className="p-6 text-sm space-y-1">
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

          {/* Line Items */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Line Items
                </h2>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {totalQty} total units
                </div>
              </div>
            </div>
            <div className="p-6">
              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const itemQty = (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
                                   (item.qty_yl || 0) + (item.qty_yxl || 0) + (item.qty_xs || 0) +
                                   (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) +
                                   (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
                                   (item.qty_4xl || 0);
                    return (
                      <div key={idx} className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {item.item_number && (
                                <span className="px-2 py-0.5 bg-gray-200 dark:bg-slate-600 rounded text-xs font-mono text-gray-700 dark:text-gray-300">
                                  {item.item_number}
                                </span>
                              )}
                              {item.color && (
                                <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                  <Palette className="w-3 h-3" />
                                  {item.color}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-gray-900 dark:text-white">{item.description}</p>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-lg font-semibold text-gray-900 dark:text-white">
                              ${item.total_price.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {itemQty} × ${item.unit_price.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          {item.qty_yxs ? <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">YXS: {item.qty_yxs}</span> : null}
                          {item.qty_ys ? <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">YS: {item.qty_ys}</span> : null}
                          {item.qty_ym ? <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">YM: {item.qty_ym}</span> : null}
                          {item.qty_yl ? <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">YL: {item.qty_yl}</span> : null}
                          {item.qty_yxl ? <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">YXL: {item.qty_yxl}</span> : null}
                          {item.qty_xs ? <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded">XS: {item.qty_xs}</span> : null}
                          {item.qty_s ? <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded">S: {item.qty_s}</span> : null}
                          {item.qty_m ? <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded">M: {item.qty_m}</span> : null}
                          {item.qty_l ? <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded">L: {item.qty_l}</span> : null}
                          {item.qty_xl ? <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded">XL: {item.qty_xl}</span> : null}
                          {item.qty_2xl ? <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 rounded">2XL: {item.qty_2xl}</span> : null}
                          {item.qty_3xl ? <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 rounded">3XL: {item.qty_3xl}</span> : null}
                          {item.qty_4xl ? <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 rounded">4XL: {item.qty_4xl}</span> : null}
                        </div>

                        {item.notes && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic">{item.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No line items</p>
              )}
            </div>
          </div>

          {/* Imprints & Decorations */}
          {imprints.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Imprints & Decorations
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {imprints.map((imprint, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600">
                    <div className="flex items-start gap-4">
                      {imprint.artwork_url && (
                        <img
                          src={imprint.artwork_url}
                          alt="Artwork"
                          className="w-24 h-24 object-contain border border-gray-300 dark:border-slate-600 rounded bg-white"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          Imprint #{imprint.imprint_number || `${idx + 1}`}
                        </h3>
                        {imprint.decoration_method && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                            <span className="font-medium">Method:</span> {imprint.decoration_method}
                          </p>
                        )}
                        {imprint.decoration_location && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                            <span className="font-medium">Location:</span> {imprint.decoration_location}
                          </p>
                        )}
                        {imprint.placement && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                            <span className="font-medium">Placement:</span> {imprint.placement}
                          </p>
                        )}
                        {imprint.ink_colors && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                            <span className="font-medium">Ink/Thread Colors:</span> {imprint.ink_colors}
                          </p>
                        )}
                        {imprint.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{imprint.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Fees */}
          {fees.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Additional Fees
                </h2>
              </div>
              <div className="p-6 space-y-2">
                {fees.map((fee, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{fee.description}</p>
                      {fee.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{fee.notes}</p>}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 dark:text-white">${fee.total_price.toFixed(2)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {fee.quantity || 1} × ${fee.unit_price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {(quote.customer_notes || quote.notes || quote.production_notes) && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <StickyNote className="w-5 h-5" />
                  Notes
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {quote.customer_notes && (
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Customer Notes</label>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{quote.customer_notes}</p>
                  </div>
                )}
                {quote.notes && (
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Internal Notes</label>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{quote.notes}</p>
                  </div>
                )}
                {quote.production_notes && (
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Production Notes</label>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{quote.production_notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Quote Total */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Quote Total
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">${quote.subtotal.toFixed(2)}</span>
              </div>
              {quote.discount_amount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Discount {quote.discount_type === '%' ? `(${quote.discount_amount}%)` : ''}
                  </span>
                  <span className="font-medium text-green-600">-${quote.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Tax ({(quote.tax_rate * 100).toFixed(2)}%)</span>
                <span className="font-medium text-gray-900 dark:text-white">${quote.tax_amount.toFixed(2)}</span>
              </div>
              <div className="pt-3 border-t border-gray-200 dark:border-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">${quote.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Information
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Building className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{quote.customer_name}</p>
                  {quote.customer_company && (
                    <p className="text-gray-600 dark:text-gray-400">{quote.customer_company}</p>
                  )}
                </div>
              </div>
              {quote.customer_email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${quote.customer_email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                    {quote.customer_email}
                  </a>
                </div>
              )}
              {quote.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${quote.customer_phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                    {quote.customer_phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Company Information */}
          {quote.company_name && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Building className="w-5 h-5" />
                Company Information
              </h2>
              <div className="space-y-2 text-sm">
                {quote.company_logo_url && (
                  <img src={quote.company_logo_url} alt="Company Logo" className="h-12 mb-2" />
                )}
                <p className="font-medium text-gray-900 dark:text-white">{quote.company_name}</p>
                {quote.company_address && <p className="text-gray-700 dark:text-gray-300">{quote.company_address}</p>}
                {quote.company_city && (
                  <p className="text-gray-700 dark:text-gray-300">
                    {quote.company_city}, {quote.company_state} {quote.company_zip}
                  </p>
                )}
                {quote.company_phone && (
                  <p className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Phone className="w-3 h-3" />
                    {quote.company_phone}
                  </p>
                )}
                {quote.company_email && (
                  <p className="text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    {quote.company_email}
                  </p>
                )}
                {quote.company_website && (
                  <p className="text-blue-600 dark:text-blue-400">
                    {quote.company_website}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Links */}
      {approvals.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Approval Links</h2>
          <div className="space-y-3">
            {approvals.map((approval) => (
              <div key={approval.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {approval.is_used ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-blue-500" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {approval.is_used ? 'Used' : 'Active'}
                    </span>
                    {approval.expires_at && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Expires {format(new Date(approval.expires_at), 'MMM d, yyyy')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => copyApprovalLink(approval.approval_token)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </button>
                </div>
                {approval.responses?.map((response) => (
                  <div
                    key={response.id}
                    className={`p-3 rounded-lg ${response.approved ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {response.approved ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {response.approved ? 'Approved' : 'Rejected'} by {response.approver_name}
                      </span>
                    </div>
                    {response.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 ml-6">{response.notes}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                      {format(new Date(response.responded_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Approval Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Send Approval Link</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expires In (Days)
                </label>
                <input
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 30)}
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
