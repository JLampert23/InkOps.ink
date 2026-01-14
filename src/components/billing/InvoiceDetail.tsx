import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  User,
  XCircle,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { invoiceDetailService, InvoiceDetail as InvoiceDetailType } from '../../services/invoice-detail-service';
import { billingService } from '../../services/billing-service';
import { stripeService } from '../../services/stripe-service';
import { generateInvoicePDF } from '../../utils/invoice-pdf-export';
import { supabase } from '../../lib/supabase-client';
import { ManualPaymentModal } from './ManualPaymentModal';

interface InvoiceDetailProps {
  invoiceId: string;
  onBack: () => void;
}

export function InvoiceDetail({ invoiceId, onBack }: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<InvoiceDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creatingStripeInvoice, setCreatingStripeInvoice] = useState(false);
  const [stripeInvoiceUrl, setStripeInvoiceUrl] = useState<string | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [mockupsExpanded, setMockupsExpanded] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [sendMethod, setSendMethod] = useState<'email' | 'sms' | 'both'>('email');
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadInvoice();
    loadSettings();
  }, [invoiceId]);

  const loadSettings = async () => {
    try {
      const { data } = await supabase.from('company_settings').select('twilio_enabled').maybeSingle();
      if (data) {
        setTwilioEnabled(data.twilio_enabled || false);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) {
          setUserRole(profile.role);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoiceDetailService.getInvoiceDetail(invoiceId);
      if (!data) {
        setError('Invoice not found');
      } else {
        console.log('Invoice Data:', data);
        console.log('Line Items:', data.lineItems);
        console.log('Fees:', data.fees);
        console.log('Raw Data:', data.rawData);
        setInvoice(data);
        setCustomerPhone(data.contact.phone);
      }
    } catch (err) {
      setError('Failed to load invoice');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLockInvoice = async () => {
    if (!invoice || invoice.isFinanciallyLocked) return;

    if (!confirm('Are you sure you want to lock this invoice? Locked invoices cannot be modified without unlocking them first.')) {
      return;
    }

    setUnlocking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('printavo_invoices')
        .update({
          is_financially_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: user.email,
        })
        .eq('id', invoice.id);

      if (error) throw error;

      console.log(`Invoice ${invoice.invoiceNumber} locked by ${user.email}`);

      await loadInvoice();
      alert('Invoice locked successfully!');
    } catch (err) {
      console.error('Error locking invoice:', err);
      alert(err instanceof Error ? err.message : 'Failed to lock invoice');
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockInvoice = async () => {
    if (!invoice || !invoice.isFinanciallyLocked) return;

    const pin = prompt('Please enter your unlock PIN:');
    if (!pin) return;

    setUnlocking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unlock-invoice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          pin: pin,
        }),
      });

      const result = await response.json();

      console.log('Unlock response:', { status: response.status, result });

      if (!response.ok) {
        const errorMsg = result.error || result.message || 'Failed to unlock invoice';
        console.error('Unlock failed:', errorMsg, result);
        throw new Error(errorMsg);
      }

      await loadInvoice();
      alert('Invoice unlocked successfully!');
    } catch (err) {
      console.error('Error unlocking invoice:', err);
      alert(err instanceof Error ? err.message : 'Failed to unlock invoice');
    } finally {
      setUnlocking(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!invoice?.billingQueueId) return;
    setGeneratingLink(true);
    try {
      const url = await billingService.generatePaymentLink(invoice.billingQueueId);
      await navigator.clipboard.writeText(url);
      await loadInvoice();
      alert('Payment link generated and copied to clipboard!');
    } catch (err: any) {
      alert(err.message || 'Failed to generate payment link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCreateStripeInvoice = async () => {
    if (!invoice?.billingQueueId) return;
    setCreatingStripeInvoice(true);
    try {
      const url = await billingService.createStripeInvoice(invoice.billingQueueId);
      setStripeInvoiceUrl(url);
      await loadInvoice();
      alert('Stripe invoice created successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create Stripe invoice');
    } finally {
      setCreatingStripeInvoice(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!invoice?.billingQueueId) return;
    setSendingInvoice(true);
    try {
      const sendSMS = sendMethod === 'sms' || sendMethod === 'both';
      const result = await billingService.sendInvoiceEmail(invoice.billingQueueId, customMessage || undefined, sendSMS);

      await loadInvoice();
      setShowSendModal(false);
      setCustomMessage('');

      const results: string[] = [];
      if (result.emailSent) results.push('Email sent');
      if (result.smsSent) results.push('Text message sent');

      alert(`Invoice sent successfully! ${results.join(' and ')}`);
    } catch (err: any) {
      alert(err.message || 'Failed to send invoice');
    } finally {
      setSendingInvoice(false);
    }
  };

  const handleMarkAsPaid = () => {
    if (!invoice) return;
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);
    await loadInvoice();
    alert('Payment recorded successfully!');
  };

  const handleSync = async () => {
    if (!invoice) return;
    setSyncing(true);
    try {
      await invoiceDetailService.syncInvoice(invoice.printavoInvoiceId);
      await loadInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to sync invoice');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invoice?.stripePaymentLink?.url) return;
    await navigator.clipboard.writeText(invoice.stripePaymentLink.url);
    alert('Payment link copied to clipboard!');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string, color: string | null) => {
    return (
      <span
        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
        style={{
          backgroundColor: color ? `${color}20` : '#E5E7EB',
          color: color || '#374151',
          border: `1px solid ${color || '#D1D5DB'}`,
        }}
      >
        {status}
      </span>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const config: Record<string, { label: string; color: string; bgColor: string; Icon: any }> = {
      unpaid: { label: 'Unpaid', color: '#CA8A04', bgColor: '#FEF9C3', Icon: Clock },
      processing: { label: 'Processing', color: '#2563EB', bgColor: '#DBEAFE', Icon: RefreshCw },
      paid: { label: 'Paid', color: '#16A34A', bgColor: '#DCFCE7', Icon: CheckCircle },
      failed: { label: 'Failed', color: '#DC2626', bgColor: '#FEE2E2', Icon: XCircle },
      not_in_queue: { label: 'Not in Queue', color: '#6B7280', bgColor: '#F3F4F6', Icon: AlertCircle },
    };

    const c = config[status] || config.unpaid;
    const { Icon } = c;

    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
        style={{ backgroundColor: c.bgColor, color: c.color }}
      >
        <Icon className="w-3.5 h-3.5" />
        {c.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{error || 'Invoice not found'}</h3>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Billing Queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Sticky Header */}
      <div className="bg-white sticky top-0 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900 truncate">
                  Invoice #{invoice.visualId}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(invoice.status, invoice.statusColor)}
                  {getPaymentStatusBadge(invoice.billingQueueStatus)}
                  {invoice.isFinanciallyLocked && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full border border-yellow-200">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Financially Locked</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">
                Printavo ID: {invoice.printavoInvoiceId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            {userRole === 'admin' && (
              invoice.isFinanciallyLocked ? (
                <button
                  onClick={handleUnlockInvoice}
                  disabled={unlocking}
                  className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm text-white bg-yellow-600 border border-yellow-700 rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <AlertCircle className={`w-4 h-4 ${unlocking ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{unlocking ? 'Unlocking...' : 'Unlock'}</span>
                </button>
              ) : (
                <button
                  onClick={handleLockInvoice}
                  disabled={unlocking}
                  className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <AlertCircle className={`w-4 h-4 ${unlocking ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{unlocking ? 'Locking...' : 'Lock'}</span>
                </button>
              )
            )}
            <button
              onClick={() => invoice && generateInvoicePDF(invoice)}
              className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download PDF</span>
            </button>
            <a
              href={`https://www.printavo.com/invoices/${invoice.printavoInvoiceId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden lg:inline">View in Printavo</span>
              <span className="lg:hidden hidden sm:inline">Printavo</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Left Column - Invoice Details */}
        <div className="lg:col-span-8 space-y-4 lg:space-y-6">
          {/* Customer & Invoice Meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {/* Customer Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                Customer Information
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Customer Name</p>
                  <p className="font-medium text-gray-900">{invoice.contact.name || 'N/A'}</p>
                </div>
                {invoice.contact.company && (
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      Company
                    </p>
                    <p className="font-medium text-gray-900">{invoice.contact.company}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </p>
                  <a
                    href={`mailto:${invoice.contact.email}`}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    {invoice.contact.email || 'N/A'}
                  </a>
                </div>
                {invoice.contact.phone && (
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      Phone
                    </p>
                    <a
                      href={`tel:${invoice.contact.phone}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {invoice.contact.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Metadata */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Invoice Details
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Invoice Date
                    </p>
                    <p className="font-medium text-gray-900">{formatDate(invoice.invoiceDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Payment Due
                    </p>
                    <p className="font-medium text-gray-900">{formatDate(invoice.dueDate)}</p>
                  </div>
                </div>
                {invoice.productionDueDate && (
                  <div>
                    <p className="text-sm text-gray-500">Production Due</p>
                    <p className="font-medium text-gray-900">{formatDate(invoice.productionDueDate)}</p>
                  </div>
                )}
                {invoice.customerPO && (
                  <div>
                    <p className="text-sm text-gray-500">Customer PO</p>
                    <p className="font-medium text-gray-900">{invoice.customerPO}</p>
                  </div>
                )}
                {invoice.sentAt && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-500">Invoice Sent</p>
                    <p className="font-medium text-green-600 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {formatDateTime(invoice.sentAt)} via {invoice.sentMethod}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Addresses */}
          {(invoiceDetailService.hasAddress(invoice.billingAddress) || invoiceDetailService.hasAddress(invoice.shippingAddress)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              {invoiceDetailService.hasAddress(invoice.billingAddress) && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    Billing Address
                  </h3>
                  <p className="text-gray-700 whitespace-pre-line">
                    {invoiceDetailService.formatAddress(invoice.billingAddress)}
                  </p>
                </div>
              )}
              {invoiceDetailService.hasAddress(invoice.shippingAddress) && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    Shipping Address
                  </h3>
                  <p className="text-gray-700 whitespace-pre-line">
                    {invoiceDetailService.formatAddress(invoice.shippingAddress)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Line Items Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Style
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Color
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sizes
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.lineItems.length > 0 ? (
                    invoice.lineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <span className="font-medium">{item.style}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.color}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                          <span className="line-clamp-2" title={item.description}>
                            {item.description}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                            {item.sizes}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                          ${item.totalPrice.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No line items available
                      </td>
                    </tr>
                  )}
                  {invoice.fees.length > 0 && (
                    <>
                      <tr className="bg-gray-100">
                        <td colSpan={7} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Fees & Additional Charges
                        </td>
                      </tr>
                      {invoice.fees.map((fee) => (
                        <tr key={fee.id} className="hover:bg-gray-50 bg-gray-50/50">
                          <td colSpan={4} className="px-4 py-3 text-sm text-gray-900">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{fee.name}</span>
                              {fee.taxable && (
                                <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                                  Taxable
                                </span>
                              )}
                            </div>
                            {fee.description && fee.description !== fee.name && (
                              <p className="text-xs text-gray-500 mt-0.5">{fee.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 text-right">
                            1
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            ${fee.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                            ${fee.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-500">
                      Line Items Subtotal
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                      ${invoice.subtotal.toFixed(2)}
                    </td>
                  </tr>
                  {invoice.feesTotal > 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-500">
                        Fees Total
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                        ${invoice.feesTotal.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  {invoice.discounts > 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-500">
                        Discounts
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-green-600">
                        -${invoice.discounts.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-500">
                      Tax
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                      ${invoice.tax.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={6} className="px-6 py-4 text-right text-base font-bold text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-4 text-right text-base font-bold text-gray-900">
                      ${invoice.total.toFixed(2)}
                    </td>
                  </tr>
                  {invoice.amountPaid > 0 && (
                    <>
                      <tr>
                        <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-500">
                          Amount Paid
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-medium text-green-600">
                          -${invoice.amountPaid.toFixed(2)}
                        </td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td colSpan={6} className="px-6 py-4 text-right text-base font-bold text-blue-900">
                          Balance Due
                        </td>
                        <td className="px-6 py-4 text-right text-base font-bold text-blue-900">
                          ${invoice.amountOutstanding.toFixed(2)}
                        </td>
                      </tr>
                    </>
                  )}
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes Section - Collapsible */}
          {(invoice.notes || invoice.internalNotes) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => setNotesExpanded(!notesExpanded)}
                className="w-full px-6 py-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                  Notes
                </h2>
                {notesExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {notesExpanded && (
                <div className="p-6 space-y-4">
                  {invoice.notes && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Customer Notes</p>
                      <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                        {invoice.notes}
                      </p>
                    </div>
                  )}
                  {invoice.internalNotes && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Internal Notes</p>
                      <p className="text-gray-700 whitespace-pre-wrap bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        {invoice.internalNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mockups Section - Collapsible */}
          {invoice.mockups.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <button
                onClick={() => setMockupsExpanded(!mockupsExpanded)}
                className="w-full px-6 py-4 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                  Mockups & Attachments ({invoice.mockups.length})
                </h2>
                {mockupsExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {mockupsExpanded && (
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {invoice.mockups.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square bg-gray-100 rounded-lg overflow-hidden hover:opacity-80 transition-opacity border border-gray-200"
                      >
                        <img
                          src={url}
                          alt={`Mockup ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Payment & Actions */}
        <div className="lg:col-span-4 space-y-4 lg:space-y-6">
          {/* Actions Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-3">
              {invoice.billingQueueId && (
                <>
                  <button
                    onClick={handleGenerateLink}
                    disabled={generatingLink || !!invoice.stripePaymentLink}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingLink ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LinkIcon className="w-4 h-4" />
                    )}
                    {invoice.stripePaymentLink ? 'Payment Link Created' : 'Generate Payment Link'}
                  </button>

                  <button
                    onClick={handleCreateStripeInvoice}
                    disabled={creatingStripeInvoice || !!invoice.stripeInvoice}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingStripeInvoice ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <DollarSign className="w-4 h-4" />
                    )}
                    {invoice.stripeInvoice ? 'Stripe Invoice Created' : 'Create Stripe Invoice'}
                  </button>

                  <button
                    onClick={() => setShowSendModal(true)}
                    disabled={sendingInvoice || invoice.billingQueueStatus === 'paid'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Send Invoice to Customer
                  </button>

                  <button
                    onClick={handleMarkAsPaid}
                    disabled={invoice.billingQueueStatus === 'paid' || invoice.amountOutstanding <= 0}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Record Manual Payment
                  </button>
                </>
              )}

              {!invoice.billingQueueId && (
                <div className="text-center py-4 text-gray-500">
                  <p className="text-sm">This invoice is not in the billing queue.</p>
                  <p className="text-xs mt-1">Add it to the queue to enable billing actions.</p>
                </div>
              )}
            </div>
          </div>

          {/* Stripe Payment Link */}
          {invoice.stripePaymentLink && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400" />
                Stripe Payment Link
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-blue-900">Payment link active</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={invoice.stripePaymentLink.url}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={invoice.stripePaymentLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Open link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Stripe Invoice */}
          {invoice.stripeInvoice && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-gray-400" />
                Stripe Invoice
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-purple-900 block">Invoice Created</span>
                    <span className="text-xs text-purple-700">Minimum payment: ${invoice.stripeInvoice.minimumDueAmount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Total Amount</p>
                    <p className="font-semibold text-gray-900">${invoice.stripeInvoice.totalAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount Paid</p>
                    <p className="font-semibold text-green-600">${invoice.stripeInvoice.amountPaid.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Remaining</p>
                    <p className="font-semibold text-gray-900">${invoice.stripeInvoice.amountRemaining.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <p className="font-semibold text-gray-900 capitalize">{invoice.stripeInvoice.status}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <a
                    href={invoice.stripeInvoice.hostedInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Invoice
                  </a>
                  {invoice.stripeInvoice.invoicePdfUrl && (
                    <a
                      href={invoice.stripeInvoice.invoicePdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors text-sm"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-400" />
              Payment Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Invoice Total</span>
                <span className="font-semibold text-gray-900">${invoice.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-semibold text-green-600">${invoice.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-t border-gray-200">
                <span className="font-medium text-gray-900">Balance Due</span>
                <span className={`text-xl font-bold ${invoice.amountOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${invoice.amountOutstanding.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h2>

            {/* Stripe Payments */}
            {invoice.stripePayments.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  Stripe Payments
                </p>
                <div className="space-y-2">
                  {invoice.stripePayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">${payment.amount.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(payment.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          payment.status === 'succeeded' ? 'bg-green-100 text-green-800' :
                          payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {payment.status}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{payment.paymentMethod}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Payments */}
            {invoice.manualPayments.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  Manual Payments
                </p>
                <div className="space-y-2">
                  {invoice.manualPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-start justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900">${payment.amount.toFixed(2)}</p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            {payment.paymentMethod || payment.paymentType}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{formatDateTime(payment.paymentDate)}</p>
                        {payment.checkNumber && (
                          <p className="text-xs text-gray-600 mt-1">Check #{payment.checkNumber}</p>
                        )}
                        {payment.notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">{payment.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Printavo Payments */}
            {invoice.printavoPayments.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Printavo Payments</p>
                <div className="space-y-2">
                  {invoice.printavoPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">${payment.amount.toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{formatDateTime(payment.paymentDate)}</p>
                      </div>
                      {payment.paymentMethod && (
                        <span className="text-xs text-gray-500">{payment.paymentMethod}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invoice.stripePayments.length === 0 && invoice.printavoPayments.length === 0 && invoice.manualPayments.length === 0 && (
              <p className="text-center text-gray-500 py-4">No payments recorded</p>
            )}
          </div>

          {/* Communication Log */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gray-400" />
              Communication Log
            </h2>
            {invoice.communicationLogs.length > 0 || invoice.smsLogs.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {invoice.communicationLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900">{log.subject}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 ml-6">{log.recipient}</p>
                    <p className="text-xs text-gray-400 mt-1 ml-6">{formatDateTime(log.sentAt)}</p>
                  </div>
                ))}
                {invoice.smsLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-900">SMS Message</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.deliveryStatus === 'sent' || log.deliveryStatus === 'delivered'
                          ? 'bg-green-100 text-green-700'
                          : log.deliveryStatus === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {log.deliveryStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 ml-6">{log.phoneNumber}</p>
                    <p className="text-xs text-gray-500 mt-1 ml-6 italic">{log.messageBody}</p>
                    {log.errorMessage && (
                      <p className="text-xs text-red-600 mt-1 ml-6">Error: {log.errorMessage}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1 ml-6">{formatDateTime(log.sentAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No communications sent</p>
            )}
          </div>
        </div>
      </div>

      {/* Send Invoice Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Send Invoice</h3>
              <button
                onClick={() => {
                  setShowSendModal(false);
                  setCustomMessage('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Information
                </label>
                <div className="space-y-1 text-sm">
                  {invoice.contact.email && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span>{invoice.contact.email}</span>
                    </div>
                  )}
                  {customerPhone && twilioEnabled && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{customerPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {twilioEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Send Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSendMethod('email')}
                      className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 transition-colors ${
                        sendMethod === 'email'
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      disabled={!invoice.contact.email}
                    >
                      <Mail className="w-4 h-4" />
                      <span className="text-xs font-medium">Email</span>
                    </button>
                    <button
                      onClick={() => setSendMethod('sms')}
                      className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 transition-colors ${
                        sendMethod === 'sms'
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      disabled={!customerPhone}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-xs font-medium">Text</span>
                    </button>
                    <button
                      onClick={() => setSendMethod('both')}
                      className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 transition-colors ${
                        sendMethod === 'both'
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      disabled={!invoice.contact.email || !customerPhone}
                    >
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <MessageSquare className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-medium">Both</span>
                    </button>
                  </div>
                  {(!invoice.contact.email || !customerPhone) && (
                    <p className="text-xs text-amber-600 mt-2">
                      {!invoice.contact.email && !customerPhone && 'Email and phone number are required'}
                      {!invoice.contact.email && customerPhone && 'Email is required for email sending'}
                      {invoice.contact.email && !customerPhone && 'Phone number is required for SMS sending'}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Message (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  placeholder="Add a personal message to include..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSendModal(false);
                  setCustomMessage('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInvoice}
                disabled={
                  sendingInvoice ||
                  (sendMethod === 'email' && !invoice.contact.email) ||
                  (sendMethod === 'sms' && !customerPhone) ||
                  (sendMethod === 'both' && (!invoice.contact.email || !customerPhone))
                }
                className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                  sendMethod === 'email'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : sendMethod === 'sms'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {sendingInvoice ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : sendMethod === 'email' ? (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Email
                  </>
                ) : sendMethod === 'sms' ? (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    Send Text
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Both
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {showPaymentModal && invoice && (
        <ManualPaymentModal
          invoiceId={invoice.id}
          invoiceNumber={invoice.visualId}
          invoiceTotal={invoice.total}
          invoiceBalance={invoice.amountOutstanding}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
