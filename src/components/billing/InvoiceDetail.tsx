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
  Package,
  Phone,
  Printer,
  RefreshCw,
  RotateCcw,
  Send,
  User,
  XCircle,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Lock,
  Unlock,
  Truck,
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
  onNavigateToCustomer?: (searchTerm: string, customerEmail: string) => void;
}

function getCarrierTrackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  if (!trackingNumber) return null;
  const carrierLower = (carrier || '').toLowerCase();

  if (carrierLower.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('usps')) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes('dhl')) {
    return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(trackingNumber)}`;
  }
  return null;
}

export function InvoiceDetail({ invoiceId, onBack, onNavigateToCustomer }: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<InvoiceDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
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
  const [reverting, setReverting] = useState(false);
  const [shippingWithShipStation, setShippingWithShipStation] = useState(false);
  const [showShipConfirm, setShowShipConfirm] = useState(false);
  const [showShippingAddressModal, setShowShippingAddressModal] = useState(false);
  const [shippingAddressForm, setShippingAddressForm] = useState({
    shipping_line1: '',
    shipping_line2: '',
    shipping_city: '',
    shipping_state: '',
    shipping_zip: '',
    shipping_country: 'US',
  });
  const [savingAddress, setSavingAddress] = useState(false);
  const [labelUrls, setLabelUrls] = useState<Array<{ label_data: string; tracking_number: string; package_index: number }>>([]);
  const [companySettings, setCompanySettings] = useState<{
    company_name: string | null;
    company_address: string | null;
    company_phone: string | null;
    company_email: string | null;
    company_website: string | null;
    invoice_terms: string | null;
  } | null>(null);
  const [numPackages, setNumPackages] = useState(1);
  const [packages, setPackages] = useState<Array<{
    weight_oz: number;
    length: number;
    width: number;
    height: number;
  }>>([{ weight_oz: 16, length: 12, width: 9, height: 3 }]);

  useEffect(() => {
    loadInvoice();
    loadSettings();
  }, [invoiceId]);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('twilio_enabled, company_name, company_address, company_phone, company_email, company_website, invoice_terms')
        .maybeSingle();
      if (data) {
        setTwilioEnabled(data.twilio_enabled || false);
        setCompanySettings({
          company_name: data.company_name,
          company_address: data.company_address,
          company_phone: data.company_phone,
          company_email: data.company_email,
          company_website: data.company_website,
          invoice_terms: data.invoice_terms,
        });
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

        if (data.shippingLabelUrl) {
          setLabelUrl(data.shippingLabelUrl);
        } else if (data.rawData?.shipping_status === 'label_created') {
          const { data: labelData } = await supabase
            .from('shipping_labels')
            .select('label_url')
            .eq('invoice_id', invoiceId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (labelData?.label_url) {
            setLabelUrl(labelData.label_url);
          }
        }
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

  const handleCopyLink = async () => {
    if (!invoice?.stripePaymentLink?.url) return;
    await navigator.clipboard.writeText(invoice.stripePaymentLink.url);
    alert('Payment link copied to clipboard!');
  };

  const handleRevertInvoice = async () => {
    if (!invoice?.billingQueueId) return;

    const confirmed = confirm(
      'Are you sure you want to revert this invoice?\n\n' +
      'This will:\n' +
      '- Void the Stripe invoice (if exists)\n' +
      '- Clear the payment link\n' +
      '- Allow you to create a new invoice or payment link\n' +
      '- Reset the sent status\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    setReverting(true);
    try {
      await billingService.revertInvoiceToUnsent(invoice.billingQueueId);
      alert('Invoice reverted successfully! You can now create a new payment link or invoice.');
      await loadInvoice();
    } catch (err: any) {
      alert(err.message || 'Failed to revert invoice');
    } finally {
      setReverting(false);
    }
  };

  const handleSaveShippingAddress = async () => {
    if (!invoice) return;
    setSavingAddress(true);

    try {
      const { error } = await supabase
        .from('printavo_invoices')
        .update(shippingAddressForm)
        .eq('id', invoice.id);

      if (error) throw error;

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession) {
          throw new Error('Session expired. Please refresh the page and try again.');
        }
      }

      const currentSession = (await supabase.auth.getSession()).data.session;
      if (!currentSession) throw new Error('Not authenticated');

      const requestBody: { invoice_id: string; packages?: typeof packages } = {
        invoice_id: invoice.id,
        packages: packages,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ship-invoice`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentSession.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.status === 401) {
        const { error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) {
          throw new Error('Your session has expired. Please refresh the page and log in again.');
        }
        throw new Error('Authentication failed. Please try again.');
      }

      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`Server error: ${responseText.substring(0, 200)}`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to create shipping label');
      }

      if (result.labels && result.labels.length > 0) {
        setLabelUrls(result.labels);
      } else if (result.label_url) {
        setLabelUrls([{ label_data: result.label_url, tracking_number: result.tracking_number, package_index: 0 }]);
      }

      setShowShippingAddressModal(false);
      await loadInvoice();
      alert('Shipping label(s) created successfully');
    } catch (err: any) {
      console.error('Error creating shipping label:', err);
      alert(err.message || 'Failed to create shipping label');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleNumPackagesChange = (num: number) => {
    const clampedNum = Math.max(1, Math.min(20, num));
    setNumPackages(clampedNum);

    const newPackages = [...packages];
    while (newPackages.length < clampedNum) {
      newPackages.push({ weight_oz: 16, length: 12, width: 9, height: 3 });
    }
    while (newPackages.length > clampedNum) {
      newPackages.pop();
    }
    setPackages(newPackages);
  };

  const handlePackageChange = (index: number, field: keyof typeof packages[0], value: number) => {
    const newPackages = [...packages];
    newPackages[index] = { ...newPackages[index], [field]: value };
    setPackages(newPackages);
  };

  const handleShipWithShipStation = async () => {
    if (!invoice) return;
    setShowShipConfirm(false);
    setShippingWithShipStation(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const requestBody: { invoice_id: string; packages?: typeof packages } = {
        invoice_id: invoice.id,
      };

      if (numPackages > 1) {
        requestBody.packages = packages;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ship-invoice`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      console.log('ShipStation response:', result);

      if (!result.success) {
        console.error('ShipStation error:', result);
        throw new Error(result.error || 'Failed to create shipping label');
      }

      if (result.labels && result.labels.length > 0) {
        setLabelUrls(result.labels);
        const trackingNumbers = result.tracking_numbers?.join(', ') || '';
        alert(`${result.package_count} shipping label(s) created! Tracking #: ${trackingNumbers}`);
      } else if (result.label_url) {
        setLabelUrls([{ label_data: result.label_url, tracking_number: result.tracking_number, package_index: 0 }]);
        alert(`Shipping label created! Tracking #: ${result.tracking_number}`);
      }
      await loadInvoice();
    } catch (err: any) {
      console.error('ShipStation error:', err);
      alert(err.message || 'Failed to create shipping label');
    } finally {
      setShippingWithShipStation(false);
    }
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
          <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{error || 'Invoice not found'}</h3>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-500 hover:text-blue-800 dark:hover:text-blue-400"
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
      <div className="bg-white dark:bg-slate-800 sticky top-0 z-10 -mx-3 sm:-mx-4 px-3 sm:px-4 py-4 border-b border-gray-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">
                  Invoice #{invoice.visualId}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(invoice.status, invoice.statusColor)}
                  {(userRole === 'admin' || userRole === 'super_admin') && (
                    invoice.isFinanciallyLocked ? (
                      <button
                        onClick={handleUnlockInvoice}
                        disabled={unlocking}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full border border-red-200 hover:bg-red-200 transition-colors disabled:opacity-50"
                        title="Click to unlock invoice"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{unlocking ? 'Unlocking...' : 'Locked'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleLockInvoice}
                        disabled={unlocking}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full border border-green-200 hover:bg-green-200 transition-colors disabled:opacity-50"
                        title="Click to lock invoice"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>{unlocking ? 'Locking...' : 'Unlocked'}</span>
                      </button>
                    )
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                  Printavo ID: {invoice.printavoInvoiceId}
                </p>
                {invoice.rawData?.shipping_status && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                      invoice.rawData.shipping_status === 'sent_to_shipstation'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400'
                    }`}
                  >
                    <Truck className="w-3 h-3" />
                    {invoice.rawData.shipping_status === 'sent_to_shipstation' ? 'Order Created' : 'Not Sent'}
                  </span>
                )}
                {!invoice.rawData?.shipping_status && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400">
                    <Truck className="w-3 h-3" />
                    Not Sent
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
            {invoice.statusStage !== 'draft' &&
              (!invoice.rawData?.shipping_status ||
                invoice.rawData?.shipping_status === 'not_sent' ||
                invoice.rawData?.shipping_status === 'sent_to_shipstation') &&
              labelUrls.length === 0 && invoice.shippingLabels.length === 0 && (
              <button
                onClick={() => {
                  const hasShippingAddress = invoice.shippingAddress.line1 || invoice.shippingAddress.city;

                  const hasRequiredFields =
                    invoice.shippingAddress.line1 &&
                    invoice.shippingAddress.city &&
                    invoice.shippingAddress.state &&
                    invoice.shippingAddress.zip;

                  if (hasShippingAddress && hasRequiredFields) {
                    setShowShipConfirm(true);
                  } else {
                    setShippingAddressForm({
                      shipping_line1: invoice.shippingAddress.line1 || invoice.billingAddress.line1 || '',
                      shipping_line2: invoice.shippingAddress.line2 || invoice.billingAddress.line2 || '',
                      shipping_city: invoice.shippingAddress.city || invoice.billingAddress.city || '',
                      shipping_state: invoice.shippingAddress.state || invoice.billingAddress.state || '',
                      shipping_zip: invoice.shippingAddress.zip || invoice.billingAddress.zip || '',
                      shipping_country: invoice.shippingAddress.country || 'US',
                    });
                    setShowShippingAddressModal(true);
                  }
                }}
                disabled={shippingWithShipStation}
                className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm text-white bg-blue-600 dark:bg-blue-700 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {shippingWithShipStation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Truck className="w-4 h-4" />
                )}
                <span className="hidden lg:inline">Ship with ShipStation</span>
                <span className="lg:hidden hidden sm:inline">Ship</span>
              </button>
            )}
            {(invoice.shippingLabels.length > 0 || labelUrls.length > 0) && (
              <>
                {(labelUrls.length > 0 ? labelUrls : invoice.shippingLabels.map(l => ({
                  label_data: l.labelUrl || '',
                  tracking_number: l.trackingNumber || '',
                  package_index: 0
                }))).map((label, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const url = label.label_data;
                      if (url.startsWith('data:application/pdf;base64,')) {
                        const base64Data = url.replace('data:application/pdf;base64,', '');
                        const byteCharacters = atob(base64Data);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                          byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: 'application/pdf' });
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank');
                      } else if (url) {
                        window.open(url, '_blank');
                      }
                    }}
                    className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors whitespace-nowrap"
                    title={label.tracking_number ? `Tracking: ${label.tracking_number}` : undefined}
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden lg:inline">
                      {(labelUrls.length > 1 || invoice.shippingLabels.length > 1) ? `Label ${idx + 1}` : 'Print Label'}
                    </span>
                    <span className="lg:hidden hidden sm:inline">
                      {(labelUrls.length > 1 || invoice.shippingLabels.length > 1) ? `#${idx + 1}` : 'Label'}
                    </span>
                  </button>
                ))}
              </>
            )}
            <button
              onClick={() => invoice && generateInvoicePDF(invoice, {
                companyName: companySettings?.company_name || undefined,
                companyAddress: companySettings?.company_address || undefined,
                companyPhone: companySettings?.company_phone || undefined,
                companyEmail: companySettings?.company_email || undefined,
                companyWebsite: companySettings?.company_website || undefined,
                invoiceTerms: companySettings?.invoice_terms || undefined,
              })}
              className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download PDF</span>
            </button>
            <a
              href={`https://www.printavo.com/invoices/${invoice.printavoInvoiceId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 lg:px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors whitespace-nowrap"
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
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                Customer Information
              </h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customer Name</p>
                  {onNavigateToCustomer ? (
                    <button
                      onClick={() => onNavigateToCustomer(invoice.contact.company || invoice.contact.name, invoice.contact.email)}
                      className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left p-0 border-0 bg-transparent cursor-pointer"
                    >
                      {invoice.contact.name || 'N/A'}
                    </button>
                  ) : (
                    <p className="font-medium text-gray-900 dark:text-white">{invoice.contact.name || 'N/A'}</p>
                  )}
                </div>
                {invoice.contact.company && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      Company
                    </p>
                    {onNavigateToCustomer ? (
                      <button
                        onClick={() => onNavigateToCustomer(invoice.contact.company || invoice.contact.name, invoice.contact.email)}
                        className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left p-0 border-0 bg-transparent cursor-pointer"
                      >
                        {invoice.contact.company}
                      </button>
                    ) : (
                      <p className="font-medium text-gray-900 dark:text-white">{invoice.contact.company}</p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </p>
                  <a
                    href={`mailto:${invoice.contact.email}`}
                    className="font-medium text-blue-600 dark:text-blue-500 hover:text-blue-800 dark:hover:text-blue-400"
                  >
                    {invoice.contact.email || 'N/A'}
                  </a>
                </div>
                {invoice.contact.phone && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      Phone
                    </p>
                    <a
                      href={`tel:${invoice.contact.phone}`}
                      className="font-medium text-blue-600 dark:text-blue-500 hover:text-blue-800 dark:hover:text-blue-400"
                    >
                      {invoice.contact.phone}
                    </a>
                  </div>
                )}
                {invoiceDetailService.hasAddress(invoice.billingAddress) && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      Address
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white whitespace-pre-line">
                      {invoiceDetailService.formatAddress(invoice.billingAddress)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Metadata */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                Invoice Details
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Invoice Date
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(invoice.invoiceDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Payment Due
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(invoice.dueDate)}</p>
                  </div>
                </div>
                {invoice.productionDueDate && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Production Due</p>
                    <p className="font-medium text-gray-900 dark:text-white">{formatDate(invoice.productionDueDate)}</p>
                  </div>
                )}
                {invoice.customerPO && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Customer PO</p>
                    <p className="font-medium text-gray-900 dark:text-white">{invoice.customerPO}</p>
                  </div>
                )}
                {invoice.sentAt && (
                  <div className="pt-2 border-t border-gray-100 dark:border-slate-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Invoice Sent</p>
                    <p className="font-medium text-green-600 dark:text-green-500 flex items-center gap-1">
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
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    Billing Address
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                    {invoiceDetailService.formatAddress(invoice.billingAddress)}
                  </p>
                </div>
              )}
              {invoiceDetailService.hasAddress(invoice.shippingAddress) && (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    Shipping Address
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                    {invoiceDetailService.formatAddress(invoice.shippingAddress)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Line Items Table */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Style
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Color
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Sizes
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {invoice.lineItems.length > 0 ? (
                    invoice.lineItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          <span className="font-medium">{item.style}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {item.color}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                          <span className="line-clamp-2" title={item.description}>
                            {item.description}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          <span className="text-xs font-mono bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
                            {item.sizes}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right font-medium">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
                          ${item.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">
                          ${item.totalPrice.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No line items available
                      </td>
                    </tr>
                  )}
                  {invoice.fees.length > 0 && (
                    <>
                      <tr className="bg-gray-100 dark:bg-slate-900">
                        <td colSpan={7} className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                          Fees & Additional Charges
                        </td>
                      </tr>
                      {invoice.fees.map((fee) => (
                        <tr key={fee.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                          <td colSpan={4} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{fee.name}</span>
                              {fee.taxable && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                  Taxable
                                </span>
                              )}
                            </div>
                            {fee.description && fee.description !== fee.name && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fee.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-right">
                            1
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">
                            ${fee.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">
                            ${fee.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-slate-900">
                  <tr>
                    <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                      Line Items Subtotal
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                      ${invoice.subtotal.toFixed(2)}
                    </td>
                  </tr>
                  {invoice.feesTotal > 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                        Fees Total
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                        ${invoice.feesTotal.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  {invoice.discounts > 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                        Discounts
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium text-green-600 dark:text-green-500">
                        -${invoice.discounts.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                      Tax
                    </td>
                    <td className="px-6 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                      ${invoice.tax.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-gray-300 dark:border-slate-600">
                    <td colSpan={6} className="px-6 py-4 text-right text-base font-bold text-gray-900 dark:text-white">
                      Total
                    </td>
                    <td className="px-6 py-4 text-right text-base font-bold text-gray-900 dark:text-white">
                      ${invoice.total.toFixed(2)}
                    </td>
                  </tr>
                  {invoice.amountPaid > 0 && (
                    <>
                      <tr>
                        <td colSpan={6} className="px-6 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                          Amount Paid
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-medium text-green-600 dark:text-green-500">
                          -${invoice.amountPaid.toFixed(2)}
                        </td>
                      </tr>
                      <tr className="bg-blue-50 dark:bg-blue-900/20">
                        <td colSpan={6} className="px-6 py-4 text-right text-base font-bold text-blue-900 dark:text-blue-400">
                          Balance Due
                        </td>
                        <td className="px-6 py-4 text-right text-base font-bold text-blue-900 dark:text-blue-400">
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
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setNotesExpanded(!notesExpanded)}
                className="w-full px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  Notes
                </h2>
                {notesExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                )}
              </button>
              {notesExpanded && (
                <div className="p-6 space-y-4">
                  {invoice.notes && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Customer Notes</p>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-slate-900 p-4 rounded-lg">
                        {invoice.notes}
                      </p>
                    </div>
                  )}
                  {invoice.internalNotes && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Internal Notes</p>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
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
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setMockupsExpanded(!mockupsExpanded)}
                className="w-full px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  Mockups & Attachments ({invoice.mockups.length})
                </h2>
                {mockupsExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
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
                        className="block aspect-square bg-gray-100 dark:bg-slate-900 rounded-lg overflow-hidden hover:opacity-80 transition-opacity border border-gray-200 dark:border-slate-700"
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
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
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

                  {(invoice.stripePaymentLink || invoice.stripeInvoice) && (
                    <button
                      onClick={handleRevertInvoice}
                      disabled={reverting || (invoice.amountPaid > 0)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Revert invoice to unsent state"
                    >
                      {reverting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      Revert
                    </button>
                  )}
                </>
              )}

              {!invoice.billingQueueId && (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  <p className="text-sm">This invoice is not in the billing queue.</p>
                  <p className="text-xs mt-1">Add it to the queue to enable billing actions.</p>
                </div>
              )}
            </div>
          </div>

          {/* Tracking Information */}
          {invoice.shippingLabels && invoice.shippingLabels.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                Tracking Information
              </h2>
              <div className="space-y-3">
                {invoice.shippingLabels.map((label, index) => {
                  const trackingUrl = getCarrierTrackingUrl(label.carrier, label.trackingNumber);
                  return (
                    <div key={label.id} className="p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                      {invoice.shippingLabels.length > 1 && (
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                          Package {index + 1}:
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Package className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        {trackingUrl ? (
                          <a
                            href={trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-mono"
                          >
                            {label.trackingNumber}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                            {label.trackingNumber || 'N/A'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stripe Payment Link */}
          {invoice.stripePaymentLink && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                Stripe Payment Link
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-blue-900 dark:text-blue-400">Payment link active</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={invoice.stripePaymentLink.url}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg truncate text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="p-2 text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={invoice.stripePaymentLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
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
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                Stripe Invoice
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-500 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-purple-900 dark:text-purple-400 block">Invoice Created</span>
                    <span className="text-xs text-purple-700 dark:text-purple-500">Minimum payment: ${invoice.stripeInvoice.minimumDueAmount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Total Amount</p>
                    <p className="font-semibold text-gray-900 dark:text-white">${invoice.stripeInvoice.totalAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Amount Paid</p>
                    <p className="font-semibold text-green-600 dark:text-green-500">${invoice.stripeInvoice.amountPaid.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Remaining</p>
                    <p className="font-semibold text-gray-900 dark:text-white">${invoice.stripeInvoice.amountRemaining.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Status</p>
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">{invoice.stripeInvoice.status}</p>
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
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              Payment Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 dark:text-gray-400">Invoice Total</span>
                <span className="font-semibold text-gray-900 dark:text-white">${invoice.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 dark:text-gray-400">Amount Paid</span>
                <span className="font-semibold text-green-600 dark:text-green-500">${invoice.amountPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-t border-gray-200 dark:border-slate-700">
                <span className="font-medium text-gray-900 dark:text-white">Balance Due</span>
                <span className={`text-xl font-bold ${invoice.amountOutstanding > 0 ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}>
                  ${invoice.amountOutstanding.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment History</h2>

            {/* Stripe Payments */}
            {invoice.stripePayments.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" />
                  Stripe Payments
                </p>
                <div className="space-y-2">
                  {invoice.stripePayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">${payment.amount.toFixed(2)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(payment.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          payment.status === 'succeeded' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400' :
                          payment.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400' :
                          'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                        }`}>
                          {payment.status}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{payment.paymentMethod}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Payments */}
            {invoice.manualPayments.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  Manual Payments
                </p>
                <div className="space-y-2">
                  {invoice.manualPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-start justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                    >
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">${payment.amount.toFixed(2)}</p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400">
                            {payment.paymentMethod || payment.paymentType}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{formatDateTime(payment.paymentDate)}</p>
                        {payment.checkNumber && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Check #{payment.checkNumber}</p>
                        )}
                        {payment.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{payment.notes}</p>
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
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Printavo Payments</p>
                <div className="space-y-2">
                  {invoice.printavoPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">${payment.amount.toFixed(2)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(payment.paymentDate)}</p>
                      </div>
                      {payment.paymentMethod && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{payment.paymentMethod}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invoice.stripePayments.length === 0 && invoice.printavoPayments.length === 0 && invoice.manualPayments.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">No payments recorded</p>
            )}
          </div>

          {/* Communication Log */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              Communication Log
            </h2>
            {invoice.communicationLogs.length > 0 || invoice.smsLogs.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {invoice.communicationLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{log.subject}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.status === 'sent' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 ml-6">{log.recipient}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-6">{formatDateTime(log.sentAt)}</p>
                  </div>
                ))}
                {invoice.smsLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-green-600 dark:text-green-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">SMS Message</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.deliveryStatus === 'sent' || log.deliveryStatus === 'delivered'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                          : log.deliveryStatus === 'failed'
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                          : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {log.deliveryStatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 ml-6">{log.phoneNumber}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6 italic">{log.messageBody}</p>
                    {log.errorMessage && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 ml-6">Error: {log.errorMessage}</p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-6">{formatDateTime(log.sentAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">No communications sent</p>
            )}
          </div>
        </div>
      </div>

      {/* Send Invoice Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Send Invoice</h3>
              <button
                onClick={() => {
                  setShowSendModal(false);
                  setCustomMessage('');
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Recipient Information
                </label>
                <div className="space-y-1 text-sm">
                  {invoice.contact.email && (
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <span>{invoice.contact.email}</span>
                    </div>
                  )}
                  {customerPhone && twilioEnabled && (
                    <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                      <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <span>{customerPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {twilioEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Send Method
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setSendMethod('email')}
                      className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 transition-colors ${
                        sendMethod === 'email'
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
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
                          ? 'border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
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
                          ? 'border-purple-600 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                          : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
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
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                      {!invoice.contact.email && !customerPhone && 'Email and phone number are required'}
                      {!invoice.contact.email && customerPhone && 'Email is required for email sending'}
                      {invoice.contact.email && !customerPhone && 'Phone number is required for SMS sending'}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Message (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  placeholder="Add a personal message to include..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-blue-500 dark:focus:border-blue-600"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSendModal(false);
                  setCustomMessage('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
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
          customerId={invoice.customerId || undefined}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Shipping Address Modal */}
      {showShippingAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Shipping Address</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Shipping address is required to create a shipping label
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Street Address Line 1 *
                </label>
                <input
                  type="text"
                  value={shippingAddressForm.shipping_line1}
                  onChange={(e) =>
                    setShippingAddressForm({ ...shippingAddressForm, shipping_line1: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  placeholder="123 Main St"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Street Address Line 2
                </label>
                <input
                  type="text"
                  value={shippingAddressForm.shipping_line2}
                  onChange={(e) =>
                    setShippingAddressForm({ ...shippingAddressForm, shipping_line2: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  placeholder="Apt, Suite, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    value={shippingAddressForm.shipping_city}
                    onChange={(e) =>
                      setShippingAddressForm({ ...shippingAddressForm, shipping_city: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    value={shippingAddressForm.shipping_state}
                    onChange={(e) =>
                      setShippingAddressForm({ ...shippingAddressForm, shipping_state: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    placeholder="CA"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    value={shippingAddressForm.shipping_zip}
                    onChange={(e) =>
                      setShippingAddressForm({ ...shippingAddressForm, shipping_zip: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    placeholder="12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Country
                  </label>
                  <input
                    type="text"
                    value={shippingAddressForm.shipping_country}
                    onChange={(e) =>
                      setShippingAddressForm({ ...shippingAddressForm, shipping_country: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    placeholder="US"
                  />
                </div>
              </div>

              {/* Shipping Packages */}
              <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  Shipping Packages
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Number of Packages
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={numPackages}
                      onChange={(e) => handleNumPackagesChange(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-4 max-h-60 overflow-y-auto">
                    {packages.map((pkg, index) => (
                      <div
                        key={index}
                        className="p-4 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700"
                      >
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                          Package {index + 1}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Weight (oz)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={pkg.weight_oz}
                              onChange={(e) =>
                                handlePackageChange(index, 'weight_oz', parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Length (in)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={pkg.length}
                              onChange={(e) =>
                                handlePackageChange(index, 'length', parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Width (in)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={pkg.width}
                              onChange={(e) =>
                                handlePackageChange(index, 'width', parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Height (in)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={pkg.height}
                              onChange={(e) =>
                                handlePackageChange(index, 'height', parseFloat(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {numPackages > 1 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Multi-package shipment: {numPackages} packages will be created with ShipStation
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowShippingAddressModal(false)}
                disabled={savingAddress}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveShippingAddress}
                disabled={
                  savingAddress ||
                  !shippingAddressForm.shipping_line1 ||
                  !shippingAddressForm.shipping_city ||
                  !shippingAddressForm.shipping_state ||
                  !shippingAddressForm.shipping_zip
                }
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {savingAddress ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Buying Labels...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Buy Labels
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ship with ShipStation Confirmation Modal */}
      {showShipConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ship with ShipStation</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300">
                Create a shipping label for this invoice using ShipStation?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This will create an order in ShipStation (if needed) and generate a shipping label with tracking number.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowShipConfirm(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShipWithShipStation}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Truck className="w-4 h-4" />
                Create Label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
