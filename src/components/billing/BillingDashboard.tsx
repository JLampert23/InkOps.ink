import { useState } from 'react';
import { Receipt, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { BillingQueue } from './BillingQueue';
import { PaidInvoices } from './PaidInvoices';
import { SendInvoiceModal } from './SendInvoiceModal';
import { InvoiceDetail } from './InvoiceDetail';
import { BillingQueueItem } from '../../services/billing-service';

interface BillingDashboardProps {
  initialTab?: 'queue' | 'paid';
}

export function BillingDashboard({ initialTab = 'queue' }: BillingDashboardProps = {}) {
  const [activeTab, setActiveTab] = useState<'queue' | 'paid'>(initialTab);
  const [selectedInvoice, setSelectedInvoice] = useState<BillingQueueItem | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSendInvoice = (item: BillingQueueItem) => {
    setSelectedInvoice(item);
  };

  const handleCloseModal = () => {
    setSelectedInvoice(null);
  };

  const handleSuccess = () => {
    setSelectedInvoice(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleViewInvoice = (printavoInvoiceId: string) => {
    setViewingInvoiceId(printavoInvoiceId);
  };

  const handleBackToQueue = () => {
    setViewingInvoiceId(null);
  };

  if (viewingInvoiceId) {
    return (
      <InvoiceDetail
        invoiceId={viewingInvoiceId}
        onBack={handleBackToQueue}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing & Payments</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage invoices, send payment links, and track payments
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'queue'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Receipt className="w-5 h-5" />
              Billing Queue
            </button>
            <button
              onClick={() => setActiveTab('paid')}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'paid'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              Paid Invoices
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'queue' && (
            <BillingQueue key={`queue-${refreshKey}`} onSendInvoice={handleSendInvoice} onViewInvoice={handleViewInvoice} />
          )}
          {activeTab === 'paid' && <PaidInvoices key={`paid-${refreshKey}`} onViewInvoice={handleViewInvoice} />}
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-700 rounded-lg shadow-sm border border-blue-200 dark:border-slate-600 p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-400 mb-4">
          How the Billing Workflow Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-700/50 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">Sync Queue</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Pull invoices from Printavo based on your status filters
            </p>
          </div>

          <div className="bg-white dark:bg-slate-700/50 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">Send Invoices</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Generate Stripe payment links and email them to customers
            </p>
          </div>

          <div className="bg-white dark:bg-slate-700/50 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">Receive Payment</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Customers pay via Stripe, webhooks update status automatically
            </p>
          </div>

          <div className="bg-white dark:bg-slate-700/50 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                4
              </div>
              <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">Mark Complete</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Paid invoices move to archive with full payment history
            </p>
          </div>
        </div>
      </div>

      {selectedInvoice && (
        <SendInvoiceModal
          item={selectedInvoice}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
