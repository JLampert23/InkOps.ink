import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { ArrowLeft, CreditCard as Edit, Send, CheckCircle, XCircle, Copy, Clock, FileText, Loader2, RefreshCw, Download, Plus, Pencil, X } from 'lucide-react';
import { format } from 'date-fns';
import { ManageImprintsModal } from './ManageImprintsModal';
import { SendQuoteModal } from './SendQuoteModal';
import { generateQuotePDF, QuotePDFData } from '../../utils/quote-pdf-export';
import { useNotification } from '../../contexts/NotificationContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';

function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

interface QuoteDetailProps {
  quoteId: string;
  onBack: () => void;
  onEdit: () => void;
}

interface Quote {
  id: string;
  quote_number: string;
  nickname?: string;
  company_id?: string;
  customer_id?: string;
  contact_id?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  customer_name: string;
  customer_email: string;
  customer_company: string;
  customer_phone: string;
  was_reopened?: boolean;
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
  followup_count?: number;
  last_followup_sent_at?: string | null;
  next_followup_due_at?: string | null;
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
  group_label?: string | null;
  imprint_number?: string;
  num_colors?: number;
  description?: string;
  artwork_description?: string;
  artwork_url?: string;
  artwork_images?: string[];
  garment_images?: Array<{ url: string; view: string }>;
}

interface CompanySettings {
  company_name: string | null;
  company_address: string | null;
  company_city: string | null;
  company_state: string | null;
  company_zip: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_website: string | null;
  company_logo_primary_url: string | null;
  company_logo_secondary_url: string | null;
}

export default function QuoteDetail({ quoteId, onBack, onEdit }: QuoteDetailProps) {
  const { showNotification } = useNotification();
  const { confirm } = useConfirmation();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [quoteImprints, setQuoteImprints] = useState<QuoteImprint[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showManageImprints, setShowManageImprints] = useState(false);
  const [selectedGroupLabel, setSelectedGroupLabel] = useState<string>('');
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedProofImage, setSelectedProofImage] = useState<string>('');
  const [reopening, setReopening] = useState(false);
  const [approving, setApproving] = useState(false);
  const [sendingFollowup, setSendingFollowup] = useState(false);

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

      // If quote has customer_id, fetch customer details if billing info is missing
      if (quoteData.customer_id) {
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', quoteData.customer_id)
          .maybeSingle();

        if (customerData) {
          // Populate billing info from customer if quote doesn't have it
          if (!quoteData.bill_company && !quoteData.bill_address_1) {
            quoteData.bill_company = customerData.company_name;
            quoteData.bill_name = customerData.contact_name;
            quoteData.bill_address_1 = customerData.billing_address_line1;
            quoteData.bill_address_2 = customerData.billing_address_line2;
            quoteData.bill_city = customerData.billing_city;
            quoteData.bill_state = customerData.billing_state;
            quoteData.bill_zip = customerData.billing_zip;
            quoteData.bill_email = customerData.email;
            quoteData.bill_phone = customerData.phone;
          }

          // Populate shipping info from customer if quote doesn't have it
          if (!quoteData.ship_company && !quoteData.ship_address_1) {
            quoteData.ship_company = customerData.company_name;
            quoteData.ship_name = customerData.contact_name;
            quoteData.ship_address_1 = customerData.shipping_address_line1;
            quoteData.ship_address_2 = customerData.shipping_address_line2;
            quoteData.ship_city = customerData.shipping_city;
            quoteData.ship_state = customerData.shipping_state;
            quoteData.ship_zip = customerData.shipping_zip;
          }

          // Merge zip codes if still missing
          if (!quoteData.bill_zip && customerData.billing_zip) {
            quoteData.bill_zip = customerData.billing_zip;
          }
          if (!quoteData.ship_zip && customerData.shipping_zip) {
            quoteData.ship_zip = customerData.shipping_zip;
          }
        }
      }

      // If quote has contact_id, fetch contact details and override billing contact info
      if (quoteData.contact_id) {
        const { data: contactData } = await supabase
          .from('customer_contacts')
          .select('*')
          .eq('id', quoteData.contact_id)
          .maybeSingle();

        if (contactData) {
          // Add contact info to quote data for display
          quoteData.contact_name = contactData.name;
          quoteData.contact_email = contactData.email;
          quoteData.contact_phone = contactData.phone;

          // Override billing contact information with selected contact
          // Keep company name and address from customer, but use selected contact's personal details
          quoteData.bill_name = contactData.name;
          quoteData.bill_email = contactData.email;
          quoteData.bill_phone = contactData.phone;
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

      console.log('QuoteDetail: Imprints fetch result:', { imprintsData, imprintsError });

      if (!imprintsError) {
        setQuoteImprints(imprintsData || []);
      } else {
        console.error('QuoteDetail: Error fetching imprints:', imprintsError);
      }

      const companyIdToUse = quoteData.company_id;
      console.log('QuoteDetail: Fetching company settings for company_id:', companyIdToUse);

      if (companyIdToUse) {
        const { data: settings, error: settingsError } = await supabase
          .from('company_settings')
          .select(`
            company_name,
            company_address,
            company_city,
            company_state,
            company_zip,
            company_phone,
            company_email,
            company_website,
            company_logo_primary_url,
            company_logo_secondary_url,
            quote_terms
          `)
          .eq('id', companyIdToUse)
          .maybeSingle();

        console.log('QuoteDetail: Company settings result:', { settings, settingsError });
        setCompanySettings(settings);
      } else {
        console.log('QuoteDetail: No company_id found on quote');
      }
    } catch (error) {
      console.error('Error loading quote:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQuote = async () => {
    if (!quote) return;

    console.log('QuoteDetail: handleDownloadQuote called');
    console.log('QuoteDetail: quote company_logo_url:', quote.company_logo_url);
    console.log('QuoteDetail: companySettings:', companySettings);

    const quotePDFData: QuotePDFData = {
      ...quote,
      company_name: quote.company_name || companySettings?.company_name || null,
      company_address: quote.company_address || companySettings?.company_address || null,
      company_city: quote.company_city || companySettings?.company_city || null,
      company_state: quote.company_state || companySettings?.company_state || null,
      company_zip: quote.company_zip || companySettings?.company_zip || null,
      company_phone: quote.company_phone || companySettings?.company_phone || null,
      company_email: quote.company_email || companySettings?.company_email || null,
      company_website: quote.company_website || companySettings?.company_website || null,
      company_logo_url: quote.company_logo_url || companySettings?.company_logo_primary_url || companySettings?.company_logo_secondary_url || null,
      company_logo_secondary_url: companySettings?.company_logo_secondary_url || null,
      quote_terms: (companySettings as any)?.quote_terms || null,
      line_items: lineItems,
      imprints: quoteImprints.map(imprint => ({
        id: imprint.id,
        type_of_work: imprint.type_of_work,
        location: imprint.location,
        num_colors: imprint.num_colors,
        description: imprint.description || '',
        details: imprint.details,
        artwork_description: imprint.artwork_description,
        thread_ink_color: imprint.thread_ink_color,
        artwork_url: imprint.artwork_url,
        artwork_images: imprint.artwork_images,
        mockups: imprint.mockups,
        group_label: imprint.group_label,
      })),
    };

    try {
      await generateQuotePDF(quotePDFData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const handleSendFollowup = async () => {
    if (!quote) return;

    const confirmed = await confirm(
      'Send Follow-Up Email',
      `Send a follow-up email to ${quote.customer_name || quote.customer_email}? This will count toward the maximum follow-up attempts for this quote.`
    );

    if (!confirmed) return;

    setSendingFollowup(true);
    try {
      // Queue the follow-up in automation queue
      const { error: queueError } = await supabase
        .from('automation_queue')
        .insert({
          company_id: quote.company_id,
          trigger_type: 'quote_followup',
          trigger_data: {
            quote_id: quote.id,
            quote_number: quote.quote_number,
            customer_id: quote.customer_id,
            contact_id: quote.contact_id,
            followup_number: (quote.followup_count || 0) + 1,
          },
          status: 'pending',
          scheduled_for: new Date().toISOString(),
          attempts: 0,
          max_attempts: 3,
        });

      if (queueError) throw queueError;

      // Update the quote with follow-up info
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          followup_count: (quote.followup_count || 0) + 1,
          last_followup_sent_at: new Date().toISOString(),
        })
        .eq('id', quote.id);

      if (updateError) throw updateError;

      // Log the manual follow-up
      await supabase
        .from('quote_activity_log')
        .insert({
          company_id: quote.company_id,
          quote_id: quote.id,
          action: 'manual_followup',
          meta: {
            followup_number: (quote.followup_count || 0) + 1,
            recipient_email: quote.customer_email,
          },
          performed_at: new Date().toISOString(),
        });

      showNotification('success', 'Follow-Up Sent', 'The follow-up email has been queued and will be sent shortly.');

      // Reload quote details to show updated count
      await loadQuoteDetails();
    } catch (error) {
      console.error('Error sending follow-up:', error);
      showNotification('error', 'Error', error instanceof Error ? error.message : 'Failed to send follow-up email');
    } finally {
      setSendingFollowup(false);
    }
  };

  const handleReopenQuote = async () => {
    if (!quote) return;

    setReopening(true);
    try {
      const { error } = await supabase
        .from('quotes')
        .update({
          status: 'draft',
          was_reopened: true,
          approved_at: null
        })
        .eq('id', quoteId);

      if (error) throw error;

      await supabase
        .from('quote_activity_log')
        .insert({
          quote_id: quoteId,
          company_id: quote.company_id,
          action: 'reopened',
          performed_by_name: 'User',
          meta: { previous_status: 'approved' }
        });

      showNotification('Quote reopened for editing', 'success');
      loadQuoteDetails();
      onEdit();
    } catch (error) {
      console.error('Error reopening quote:', error);
      showNotification('Failed to reopen quote', 'error');
    } finally {
      setReopening(false);
    }
  };

  const handleApproveQuote = async () => {
    if (!quote) return;

    const confirmed = await confirm({
      title: `Approve ${quote.quote_number}?`,
      message: `This will:\n- Create a Work Order\n- Create an Invoice\n- Push garment requirements to the purchase report\n- Trigger all approval automations`,
      confirmLabel: 'Approve Quote',
      cancelLabel: 'Cancel',
      variant: 'success',
    });

    if (!confirmed) return;

    setApproving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[APPROVE] Session check:', {
        hasSession: !!session,
        userId: session?.user?.id,
        hasAccessToken: !!session?.access_token,
        tokenPrefix: session?.access_token?.substring(0, 20)
      });
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quote-actions/${quoteId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            approver_name: 'Manual Approval',
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve quote');
      }

      const result = await response.json();
      showNotification(
        `Quote approved! Work Order ${result.work_order.work_order_number} and Invoice ${result.invoice.invoice_number} created.`,
        'success'
      );
      loadQuoteDetails();
    } catch (error: any) {
      console.error('Error approving quote:', error);
      showNotification(error.message || 'Failed to approve quote', 'error');
    } finally {
      setApproving(false);
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
        <div className="flex items-center gap-1.5">
          {(quote.status === 'draft' || quote.status === 'sent') && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-3 h-3" />
              Edit Quote
            </button>
          )}
          {quote.status === 'approved' && (
            <button
              onClick={handleReopenQuote}
              disabled={reopening}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {reopening ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Pencil className="w-3 h-3" />
              )}
              Edit Quote
            </button>
          )}
          {quote.status !== 'approved' && (
            <button
              onClick={handleApproveQuote}
              disabled={approving}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {approving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle className="w-3 h-3" />
              )}
              Approve Quote
            </button>
          )}
          <button
            onClick={handleDownloadQuote}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors"
          >
            <Download className="w-3 h-3" />
            Download PDF
          </button>
          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <Send className="w-3 h-3" />
            {quote.status === 'draft' ? 'Send to Customer' : 'Resend'}
          </button>
          {(quote.status === 'sent' || quote.status === 'pending') && (
            <button
              onClick={handleSendFollowup}
              disabled={sendingFollowup}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Follow-up count: ${quote.followup_count || 0}`}
            >
              {sendingFollowup ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  Send Follow-Up {quote.followup_count ? `(${quote.followup_count})` : ''}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Reopened Banner */}
      {quote.was_reopened && quote.status === 'draft' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">
            This quote has been reopened for editing.
          </p>
        </div>
      )}

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
              {quote.contact_name && quote.contact_name !== quote.bill_name && (
                <p className="text-gray-600 dark:text-gray-400 text-xs italic">Contact: {quote.contact_name}</p>
              )}
              {quote.bill_address_1 && <p className="text-gray-700 dark:text-gray-300">{quote.bill_address_1}</p>}
              {quote.bill_address_2 && <p className="text-gray-700 dark:text-gray-300">{quote.bill_address_2}</p>}
              {quote.bill_city && (
                <p className="text-gray-700 dark:text-gray-300">
                  {quote.bill_city}, {quote.bill_state} {quote.bill_zip}
                </p>
              )}
              {(quote.contact_email || quote.bill_email || quote.customer_email) && (
                <p className="text-blue-600 dark:text-blue-400 mt-1">
                  <a href={`mailto:${quote.contact_email || quote.bill_email || quote.customer_email}`} className="hover:underline">
                    {quote.contact_email || quote.bill_email || quote.customer_email}
                  </a>
                </p>
              )}
              {(quote.contact_phone || quote.bill_phone || quote.customer_phone) && (
                <p className="text-gray-700 dark:text-gray-300">{quote.contact_phone || quote.bill_phone || quote.customer_phone}</p>
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
                  <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Items</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white min-w-[120px] bg-blue-50 dark:bg-blue-900/20">Unit Price</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white min-w-[120px] bg-green-50 dark:bg-green-900/20">Line Total</th>
                </tr>
              </thead>
            )}
            <tbody>
              {itemGroups.map(([groupLabel, groupItems], groupIdx) => (
                <React.Fragment key={`group-${groupIdx}`}>
                  {/* Spacer between groups */}
                  {groupIdx > 0 && (
                    <tr>
                      <td colSpan={20} className="h-4 bg-transparent"></td>
                    </tr>
                  )}
                  {/* Group header */}
                  {groupLabel && (
                    <tr className="bg-gray-100 dark:bg-slate-800 border-t-2 border-b-2 border-gray-300 dark:border-slate-600">
                      <td colSpan={20} className="px-4 py-3">
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
                      <th className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-white">Items</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white min-w-[120px] bg-blue-50 dark:bg-blue-900/20">Unit Price</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white min-w-[120px] bg-green-50 dark:bg-green-900/20">Line Total</th>
                    </tr>
                  )}
                  {/* Group items */}
                  {groupItems.map((item) => {
                    const sizeQty = (item.qty_yxs || 0) + (item.qty_ys || 0) + (item.qty_ym || 0) +
                                   (item.qty_yl || 0) + (item.qty_yxl || 0) + (item.qty_xs || 0) +
                                   (item.qty_s || 0) + (item.qty_m || 0) + (item.qty_l || 0) +
                                   (item.qty_xl || 0) + (item.qty_2xl || 0) + (item.qty_3xl || 0) +
                                   (item.qty_4xl || 0);
                    const totalItems = sizeQty > 0 ? sizeQty : ((item as any).quantity || 0);

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
                        {decodeHtmlEntities(item.description)}
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
                      <td className="px-4 py-4 text-center text-gray-700 dark:text-gray-300 text-base">
                        {sizeQty === 0 ? ((item as any).quantity || '') : ''}
                      </td>
                      <td className="px-4 py-4 text-center text-gray-900 dark:text-white font-bold text-base text-blue-600 dark:text-blue-400">
                        {totalItems}
                      </td>
                      <td className="px-4 py-4 text-right text-gray-900 dark:text-white font-semibold text-base bg-blue-50/50 dark:bg-blue-900/10">
                        ${item.unit_price.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-right text-green-700 dark:text-green-400 font-bold text-base bg-green-50/50 dark:bg-green-900/10">
                        ${item.total_price.toFixed(2)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
                  {/* List imprints for this group */}
                  <tr>
                    <td colSpan={20} className="px-4 py-2 bg-gray-50 dark:bg-slate-800/50">
                      <div className="space-y-3">
                        {/* List imprints for this group */}
                        {(() => {
                          // Filter imprints to match this group's label
                          const normalizeLabel = (label: string | null | undefined) => label || '';
                          const normalizedGroupLabel = normalizeLabel(groupLabel);

                          let groupImprints;
                          // If there's only one group with an empty label, show all imprints
                          if (itemGroups.length === 1 && !groupLabel) {
                            groupImprints = quoteImprints;
                          } else {
                            // Otherwise, filter by exact group_label match
                            groupImprints = quoteImprints.filter(imp => {
                              const imprintLabel = normalizeLabel((imp as any).group_label);
                              return imprintLabel === normalizedGroupLabel;
                            });
                          }

                          console.log('QuoteDetail: Imprints display check:', {
                            groupLabel,
                            itemGroupsLength: itemGroups.length,
                            allImprints: quoteImprints.length,
                            groupImprints: groupImprints.length,
                            groupImprintsData: groupImprints
                          });

                          if (groupImprints.length === 0) return null;

                          const garmentItem = groupItems.find(li => li.line_type === 'garment');
                          const firstLineItem = garmentItem || groupItems[0];

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {groupImprints.map((imprint, idx) => {
                                const hasMockups = imprint.mockups && imprint.mockups.length > 0;

                                return (
                                  <div
                                    key={imprint.id}
                                    className="bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg p-4"
                                  >
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                                        {quote.quote_number.replace(/^QTE-/, '')}-{String(idx + 1).padStart(2, '0')}
                                      </span>
                                      <span className="text-sm font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                                        {imprint.type_of_work}
                                      </span>
                                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                                        {imprint.location}
                                      </span>
                                    </div>
                                    {imprint.details && (
                                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                        {imprint.details}
                                      </div>
                                    )}

                                    {(() => {
                                      const artworkImages = imprint.artwork_images && Array.isArray(imprint.artwork_images)
                                        ? imprint.artwork_images
                                        : imprint.artwork_url
                                          ? [imprint.artwork_url]
                                          : [];

                                      if (artworkImages.length === 0) return null;

                                      return (
                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                            Art Files {artworkImages.length > 1 && `(${artworkImages.length} variations)`}:
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {artworkImages.map((url: string, imgIdx: number) => (
                                              <div key={imgIdx} className="aspect-square">
                                                <img
                                                  src={url}
                                                  alt={`Artwork ${imgIdx + 1}`}
                                                  className="w-full h-full object-contain rounded border-2 border-gray-300 dark:border-slate-600 cursor-pointer hover:border-blue-500 transition-all bg-white dark:bg-slate-800 shadow-sm"
                                                  onClick={() => {
                                                    setSelectedProofImage(url);
                                                    setShowProofModal(true);
                                                  }}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {imprint.garment_images && imprint.garment_images.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                          Garment Images:
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                          {imprint.garment_images
                                            .filter((img) => img?.url)
                                            .map((img, imgIdx) => (
                                              <div key={`garment-${imgIdx}`} className="aspect-square">
                                                <div className="relative w-full h-full">
                                                  <img
                                                    src={img.url}
                                                    alt={`Garment ${img.view || 'view'}`}
                                                    className="w-full h-full object-contain rounded border-2 border-gray-300 dark:border-slate-600 cursor-pointer hover:border-blue-500 transition-all bg-white dark:bg-slate-800 shadow-sm"
                                                    onClick={() => {
                                                      setSelectedProofImage(img.url);
                                                      setShowProofModal(true);
                                                    }}
                                                  />
                                                  {img.view && (
                                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs py-1 px-2 text-center rounded-b capitalize">
                                                      {img.view}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                        </div>
                                      </div>
                                    )}

                                    {hasMockups && (
                                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                          Mockups:
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                          {imprint.mockups.map((mockup: any, mockupIdx: number) => {
                                            const mockupUrl = typeof mockup === 'string' ? mockup : mockup?.url;
                                            if (!mockupUrl) return null;

                                            return (
                                              <div key={`mockup-${mockupIdx}`} className="aspect-square">
                                                <img
                                                  src={mockupUrl}
                                                  alt={`Mockup ${mockupIdx + 1}`}
                                                  className="w-full h-full object-contain rounded border border-gray-200 dark:border-slate-600 cursor-pointer hover:border-blue-500 transition-all bg-white dark:bg-slate-800"
                                                  onClick={() => {
                                                    setSelectedProofImage(mockupUrl);
                                                    setShowProofModal(true);
                                                  }}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
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

      {/* Send Quote Modal */}
      {showSendModal && quote && (
        <SendQuoteModal
          quoteId={quoteId}
          quoteNumber={quote.quote_number}
          customerName={quote.customer_name}
          customerEmail={quote.contact_email || quote.bill_email || quote.customer_email || ''}
          totalAmount={quote.total || 0}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => {
            setShowSendModal(false);
            loadQuoteDetails();
          }}
        />
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
