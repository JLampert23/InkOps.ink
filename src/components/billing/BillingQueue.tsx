import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Send,
  Link as LinkIcon,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Copy,
  AlertCircle,
  DollarSign,
  Download,
  Loader2,
  FileText,
  Filter,
  Package,
} from 'lucide-react';
import { billingService, BillingQueueItem } from '../../services/billing-service';
import { invoiceDetailService } from '../../services/invoice-detail-service';
import { generateInvoicePDF } from '../../utils/invoice-pdf-export';
import { supabase } from '../../lib/supabase-client';

interface BillingQueueProps {
  onSendInvoice?: (item: BillingQueueItem) => void;
  onViewInvoice?: (printavoInvoiceId: string) => void;
}

export function BillingQueue({ onSendInvoice, onViewInvoice }: BillingQueueProps) {
  const [queueItems, setQueueItems] = useState<BillingQueueItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generatingLinks, setGeneratingLinks] = useState(false);
  const [sendingInvoices, setSendingInvoices] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);
  const [creatingStripeInvoices, setCreatingStripeInvoices] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [companySettings, setCompanySettings] = useState<{
    company_name: string | null;
    company_address: string | null;
    company_city: string | null;
    company_state: string | null;
    company_zip: string | null;
    company_phone: string | null;
    company_email: string | null;
    company_website: string | null;
    company_logo_primary_url: string | null;
    invoice_terms: string | null;
  } | null>(null);

  useEffect(() => {
    loadQueue();
    loadCompanySettings();
  }, []);

  const loadCompanySettings = async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('company_name, company_address, company_city, company_state, company_zip, company_phone, company_email, company_website, company_logo_primary_url, invoice_terms')
        .maybeSingle();
      if (data) {
        setCompanySettings(data);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const loadQueue = async () => {
    setLoading(true);
    try {
      const items = await billingService.getBillingQueue();
      setQueueItems(items);
    } catch (error) {
      console.error('Error loading billing queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    const filtered = getFilteredItems();
    if (selectedItems.size === filtered.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filtered.map(item => item.id)));
    }
  };

  const handleGenerateLinks = async () => {
    if (selectedItems.size === 0) {
      alert('Please select at least one invoice');
      return;
    }

    setGeneratingLinks(true);
    try {
      const count = await billingService.bulkGeneratePaymentLinks(Array.from(selectedItems));
      alert(`Generated payment links for ${count} invoice(s)`);
      await loadQueue();
      setSelectedItems(new Set());
    } catch (error: any) {
      alert(error.message || 'Failed to generate payment links');
    } finally {
      setGeneratingLinks(false);
    }
  };

  const handleSendInvoices = async () => {
    if (selectedItems.size === 0) {
      alert('Please select at least one invoice');
      return;
    }

    setSendingInvoices(true);
    try {
      const count = await billingService.bulkSendInvoices(Array.from(selectedItems));
      alert(`Sent ${count} invoice(s) successfully`);
      await loadQueue();
      setSelectedItems(new Set());
    } catch (error: any) {
      alert(error.message || 'Failed to send invoices');
    } finally {
      setSendingInvoices(false);
    }
  };

  const handleCreateStripeInvoices = async () => {
    if (selectedItems.size === 0) {
      alert('Please select at least one invoice');
      return;
    }

    setCreatingStripeInvoices(true);
    try {
      const count = await billingService.bulkCreateStripeInvoices(Array.from(selectedItems));
      alert(`Created ${count} Stripe invoice(s) successfully`);
      await loadQueue();
      setSelectedItems(new Set());
    } catch (error: any) {
      alert(error.message || 'Failed to create Stripe invoices');
    } finally {
      setCreatingStripeInvoices(false);
    }
  };

  const handleCopyLink = async (item: BillingQueueItem) => {
    try {
      if (!item.stripePaymentLinkId) {
        await billingService.generatePaymentLink(item.id);
        await loadQueue();
        return;
      }

      const link = await billingService.generatePaymentLink(item.id);
      await navigator.clipboard.writeText(link);
      alert('Payment link copied to clipboard!');
    } catch (error: any) {
      alert(error.message || 'Failed to copy link');
    }
  };

  const handleDownloadPDF = async (item: BillingQueueItem) => {
    setDownloadingPDF(item.printavoInvoiceId);
    try {
      const invoiceDetail = await invoiceDetailService.getInvoiceDetail(item.printavoInvoiceId);
      if (!invoiceDetail) {
        alert('Failed to load invoice details');
        return;
      }
      await generateInvoicePDF(invoiceDetail, {
        companyName: companySettings?.company_name || undefined,
        companyAddress: companySettings?.company_address || undefined,
        companyCity: companySettings?.company_city || undefined,
        companyState: companySettings?.company_state || undefined,
        companyZip: companySettings?.company_zip || undefined,
        companyPhone: companySettings?.company_phone || undefined,
        companyEmail: companySettings?.company_email || undefined,
        companyWebsite: companySettings?.company_website || undefined,
        companyLogoUrl: companySettings?.company_logo_primary_url || undefined,
        invoiceTerms: companySettings?.invoice_terms || undefined,
      });
    } catch (error: any) {
      alert(error.message || 'Failed to generate PDF');
    } finally {
      setDownloadingPDF(null);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig = {
      unpaid: { label: 'Unpaid', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400', icon: Clock },
      processing: { label: 'Processing', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400', icon: RefreshCw },
      paid: { label: 'Paid', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400', icon: CheckCircle },
      failed: { label: 'Failed', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400', icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unpaid;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getFilteredItems = () => {
    if (statusFilter === 'all') return queueItems;
    if (statusFilter === 'ready') return queueItems.filter(item => !item.sentAt && !item.stripePaymentLinkId);
    if (statusFilter === 'link-created') return queueItems.filter(item => item.stripePaymentLinkId);
    if (statusFilter === 'sent') return queueItems.filter(item => item.sentAt);
    return queueItems;
  };

  const filteredItems = getFilteredItems();
  const totalAmount = filteredItems.reduce((sum, item) => sum + item.invoiceTotal, 0);
  const readyToSend = queueItems.filter(item => !item.sentAt).length;
  const withLinks = queueItems.filter(item => item.stripePaymentLinkId).length;
  const alreadySent = queueItems.filter(item => item.sentAt).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-orange-600 dark:text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total in Queue</span>
            <Package className="w-5 h-5 text-orange-600 dark:text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {filteredItems.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ready to Send</span>
            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {readyToSend}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Awaiting delivery</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Links Created</span>
            <LinkIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {withLinks}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Payment links ready</div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Already Sent</span>
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {alreadySent}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Delivered to customers</div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 lg:p-6">
        <div className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-600"
              >
                <option value="all">All Invoices</option>
                <option value="ready">Ready to Send</option>
                <option value="link-created">Links Created</option>
                <option value="sent">Already Sent</option>
              </select>
            </div>

            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <span className="text-sm font-medium text-orange-900 dark:text-orange-300">
                  {selectedItems.size} selected
                </span>
              </div>
            )}
          </div>

          {/* Bulk Actions Row */}
          {selectedItems.size > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={handleGenerateLinks}
                disabled={generatingLinks}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <LinkIcon className="w-4 h-4" />
                Generate Links
              </button>
              <button
                onClick={handleCreateStripeInvoices}
                disabled={creatingStripeInvoices}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <DollarSign className="w-4 h-4" />
                Create Stripe Invoices
              </button>
              <button
                onClick={handleSendInvoices}
                disabled={sendingInvoices}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 dark:bg-orange-700 text-white rounded-lg hover:bg-orange-700 dark:hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send Invoices
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Invoices Table */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-12 text-center">
          <Package className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No invoices in queue</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {statusFilter !== 'all'
              ? 'No invoices match the selected filter'
              : 'No invoices are currently in the billing queue'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-orange-600 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Payment Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="w-4 h-4 text-orange-600 border-gray-300 dark:border-gray-600 rounded focus:ring-orange-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => onViewInvoice?.(item.printavoInvoiceId)}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                      >
                        {item.printavoInvoiceId}
                      </button>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.printavoStatus}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.customerName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.customerEmail}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {item.customerPhone || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {item.billingAddressLine1 ? (
                          <>
                            <div>{item.billingAddressLine1}</div>
                            {item.billingAddressLine2 && <div>{item.billingAddressLine2}</div>}
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {[item.billingCity, item.billingState, item.billingZip]
                                .filter(Boolean)
                                .join(', ')}
                            </div>
                          </>
                        ) : (
                          '-'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm font-medium text-gray-900 dark:text-gray-100">
                        <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-1" />
                        {item.invoiceTotal.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {item.stripePaymentLinkId && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                            <CheckCircle className="w-3 h-3" />
                            Link Created
                          </span>
                        )}
                        {item.stripeInvoiceId && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400">
                            <DollarSign className="w-3 h-3" />
                            Stripe Invoice
                          </span>
                        )}
                        {item.sentAt && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400">
                            <Mail className="w-3 h-3" />
                            Sent {new Date(item.sentAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPaymentStatusBadge(item.paymentStatus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleDownloadPDF(item)}
                        disabled={downloadingPDF === item.printavoInvoiceId}
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 disabled:opacity-50"
                        title="Download PDF"
                      >
                        {downloadingPDF === item.printavoInvoiceId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopyLink(item)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        title="Copy payment link"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onSendInvoice?.(item)}
                        className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300"
                        title="Send invoice"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
