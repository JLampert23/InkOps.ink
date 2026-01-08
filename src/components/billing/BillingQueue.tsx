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
} from 'lucide-react';
import { billingService, BillingQueueItem } from '../../services/billing-service';

interface BillingQueueProps {
  onSendInvoice?: (item: BillingQueueItem) => void;
  onViewInvoice?: (printavoInvoiceId: string) => void;
}

export function BillingQueue({ onSendInvoice, onViewInvoice }: BillingQueueProps) {
  const [queueItems, setQueueItems] = useState<BillingQueueItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [generatingLinks, setGeneratingLinks] = useState(false);
  const [sendingInvoices, setSendingInvoices] = useState(false);

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

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus('Fetching latest data from Printavo...');
    try {
      setSyncStatus('Syncing invoices from Printavo API (this may take up to 90 seconds)...');
      await billingService.syncBillingQueue([]);
      setSyncStatus('Loading updated queue...');
      await loadQueue();
      setSyncStatus('');
      alert('Billing queue synced successfully!');
    } catch (error: any) {
      setSyncStatus('');
      alert(error.message || 'Failed to sync billing queue');
    } finally {
      setSyncing(false);
      setSyncStatus('');
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-600">Loading billing queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Billing Queue</h2>
          <p className="text-sm text-gray-600 mt-1">
            Invoices ready for billing ({queueItems.length} total)
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync from Printavo'}
        </button>
      </div>

      {syncing && syncStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">{syncStatus}</p>
            <p className="text-xs text-blue-700 mt-1">Please wait while we fetch the latest invoices from Printavo...</p>
          </div>
        </div>
      )}

      {selectedItems.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-blue-900">
              {selectedItems.size} invoice(s) selected
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateLinks}
                disabled={generatingLinks}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                <LinkIcon className="w-4 h-4" />
                Generate Links
              </button>
              <button
                onClick={handleSendInvoices}
                disabled={sendingInvoices}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Send Invoices
              </button>
            </div>
          </div>
        </div>
      )}

      {queueItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices in queue</h3>
          <p className="text-gray-600 mb-4">
            Sync from Printavo to populate the billing queue
          </p>
          <button
            onClick={handleSync}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Now
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === queueItems.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {queueItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => handleToggleSelect(item.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => onViewInvoice?.(item.printavoInvoiceId)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {item.printavoVisualId}
                    </button>
                    <div className="text-xs text-gray-500">
                      {item.printavoStatus}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {item.customerName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.customerEmail}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm font-medium text-gray-900">
                      <DollarSign className="w-4 h-4 text-gray-400 mr-1" />
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
                      onClick={() => handleCopyLink(item)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Copy payment link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onSendInvoice?.(item)}
                      className="text-green-600 hover:text-green-800"
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
