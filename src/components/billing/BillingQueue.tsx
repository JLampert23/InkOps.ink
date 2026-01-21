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
} from 'lucide-react';
import { billingService, BillingQueueItem } from '../../services/billing-service';
import { invoiceDetailService } from '../../services/invoice-detail-service';
import { generateInvoicePDF } from '../../utils/invoice-pdf-export';

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

  useEffect(() => {
    loadQueue();
  }, []);

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
    if (selectedItems.size === queueItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(queueItems.map(item => item.id)));
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
      generateInvoicePDF(invoiceDetail);
    } catch (error: any) {
      alert(error.message || 'Failed to generate PDF');
    } finally {
      setDownloadingPDF(null);
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusConfig = {
      unpaid: { label: 'Unpaid', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      processing: { label: 'Processing', color: 'bg-blue-100 text-blue-800', icon: RefreshCw },
      paid: { label: 'Paid', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: XCircle },
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

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-500 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading billing queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Billing Queue</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Invoices ready for billing ({queueItems.length} total)
          </p>
        </div>
      </div>

      {selectedItems.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
              {selectedItems.size} invoice(s) selected
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateLinks}
                disabled={generatingLinks}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <LinkIcon className="w-4 h-4" />
                Generate Links
              </button>
              <button
                onClick={handleCreateStripeInvoices}
                disabled={creatingStripeInvoices}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-green-300 dark:border-green-600 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                <DollarSign className="w-4 h-4" />
                Create Stripe Invoices
              </button>
              <button
                onClick={handleSendInvoices}
                disabled={sendingInvoices}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send Invoices
              </button>
            </div>
          </div>
        </div>
      )}

      {queueItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No invoices in queue</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Use the "Sync from Printavo" button in the sidebar to populate the billing queue
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === queueItems.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
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
              {queueItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => handleToggleSelect(item.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => onViewInvoice?.(item.printavoInvoiceId)}
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer"
                    >
                      {item.printavoVisualId}
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
                        <span className="inline-flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Link Created
                        </span>
                      )}
                      {item.stripeInvoiceId && (
                        <span className="inline-flex items-center gap-1 text-xs text-purple-700">
                          <DollarSign className="w-3 h-3" />
                          Stripe Invoice
                        </span>
                      )}
                      {item.sentAt && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-700">
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
                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
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
      )}
    </div>
  );
}
