import { useState, useEffect } from 'react';
import { PortalLayout } from './PortalLayout';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { supabase } from '../../lib/supabase-client';
import { FileText, Download, CreditCard, Eye, Loader2 } from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { portalAnalyticsService } from '../../services/portal-analytics-service';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  total: number;
  balance: number;
  status_stage: string;
  customer_name: string;
  customer_email: string;
}

export function PortalInvoices() {
  const { user } = useCustomerPortal();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (user) {
      loadInvoices();
    }
  }, [user]);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('printavo_invoices')
        .select('id, invoice_number, invoice_date, due_date, total, balance, status_stage, customer_name, customer_email')
        .eq('company_id', user!.company_id)
        .eq('customer_email', user!.email)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);

    if (user?.company_id && user?.customer_id) {
      await portalAnalyticsService.trackEvent({
        companyId: user.company_id,
        customerId: user.customer_id,
        eventType: 'invoice_viewed',
        resourceType: 'invoice',
        resourceId: invoice.id
      });
    }
  };

  const handlePayInvoice = (invoice: Invoice) => {
    setPaymentInvoice(invoice);
  };

  if (loading) {
    return (
      <PortalLayout activeTab="invoices">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </PortalLayout>
    );
  }

  if (selectedInvoice) {
    return (
      <PortalLayout activeTab="invoices">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Invoice {selectedInvoice.invoice_number}
            </h2>
            <button
              onClick={() => setSelectedInvoice(null)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Back to Invoices
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Invoice Date</p>
                <p className="text-base font-medium text-gray-900">
                  {new Date(selectedInvoice.invoice_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Due Date</p>
                <p className="text-base font-medium text-gray-900">
                  {selectedInvoice.due_date
                    ? new Date(selectedInvoice.due_date).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-base font-medium text-gray-900">
                  ${selectedInvoice.total.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Balance Due</p>
                <p className="text-base font-medium text-gray-900">
                  ${selectedInvoice.balance.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedInvoice.status_stage)}`}>
                  {selectedInvoice.status_stage}
                </span>
              </div>
            </div>

            {selectedInvoice.balance > 0 && selectedInvoice.status_stage !== 'paid' && (
              <div className="flex gap-3">
                <button
                  onClick={() => handlePayInvoice(selectedInvoice)}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <CreditCard className="w-5 h-5" />
                  Pay Invoice
                </button>
                <button
                  className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout activeTab="invoices">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Your Invoices</h1>
        </div>

        {invoices.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
            <p className="text-gray-600">You don't have any invoices yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {new Date(invoice.invoice_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {invoice.due_date
                          ? new Date(invoice.due_date).toLocaleDateString()
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${invoice.total.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ${invoice.balance.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status_stage)}`}>
                        {invoice.status_stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="View Invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {invoice.balance > 0 && invoice.status_stage !== 'paid' && (
                          <button
                            onClick={() => handlePayInvoice(invoice)}
                            className="text-green-600 hover:text-green-700 p-1"
                            title="Pay Invoice"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paymentInvoice && user && (
        <PaymentModal
          invoiceId={paymentInvoice.id}
          invoiceNumber={paymentInvoice.invoice_number}
          amount={paymentInvoice.balance}
          companyId={user.company_id}
          onClose={() => setPaymentInvoice(null)}
          onSuccess={() => {
            setPaymentInvoice(null);
            loadInvoices();
          }}
        />
      )}
    </PortalLayout>
  );
}
