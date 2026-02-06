import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Mail,
  Printer,
  FileText,
  Calendar,
  DollarSign,
  User,
  Building,
  Phone,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import {
  InvoiceService,
  InvoiceWithDetails,
} from '../../services/invoice-service';
import { useNotification } from '../../contexts/NotificationContext';

interface InvoiceDetailModalProps {
  invoiceId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export function InvoiceDetailModal({
  invoiceId,
  onClose,
  onRefresh,
}: InvoiceDetailModalProps) {
  const { showNotification } = useNotification();
  const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const { data, error } = await InvoiceService.getInvoiceById(invoiceId);
      if (data && !error) {
        setInvoice(data);
        setEmailAddress(data.customer_email || '');
        setEmailSubject(
          `Invoice ${data.invoice_number} from ${data.company_info?.company_name || 'Your Company'}`
        );
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      showNotification('Failed to load invoice', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      await InvoiceService.downloadInvoicePDF(
        invoiceId,
        `invoice-${invoice?.invoice_number}.pdf`
      );
      showNotification('Invoice PDF downloaded', 'success');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showNotification('Failed to download PDF', 'error');
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress) {
      showNotification('Please enter a recipient email address', 'error');
      return;
    }

    setSendingEmail(true);
    try {
      const result = await InvoiceService.emailInvoice(
        invoiceId,
        emailAddress,
        emailSubject,
        emailMessage
      );

      if (result.success) {
        showNotification('Invoice sent successfully', 'success');
        setEmailModalOpen(false);
        onRefresh?.();
      } else {
        showNotification(result.error || 'Failed to send invoice', 'error');
      }
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      showNotification(error.message || 'Failed to send invoice', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const getStatusColor = (status_stage: string) => {
    switch (status_stage) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <p className="text-gray-600">Invoice not found</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {invoice.invoice_number}
                </h2>
                <p className="text-sm text-gray-500">Invoice Details</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download PDF"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={() => setEmailModalOpen(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Email Invoice"
              >
                <Mail className="h-5 w-5" />
              </button>
              <button
                onClick={handleDownloadPDF}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Print"
              >
                <Printer className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Status and Dates */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    invoice.status_stage
                  )}`}
                >
                  {invoice.status_stage.toUpperCase()}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Invoice Date</p>
                <div className="flex items-center gap-2 text-gray-900 font-medium">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {formatDate(invoice.invoice_date)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Due Date</p>
                <div className="flex items-center gap-2 text-gray-900 font-medium">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  {invoice.due_date ? formatDate(invoice.due_date) : 'N/A'}
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Bill To
              </h3>
              <div className="space-y-2">
                {invoice.customer_company && (
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <p className="font-medium text-gray-900">
                      {invoice.customer_company}
                    </p>
                  </div>
                )}
                {invoice.customer_name && (
                  <p className="text-gray-700">{invoice.customer_name}</p>
                )}
                {invoice.customer_address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                    <div>
                      <p className="text-gray-700">{invoice.customer_address}</p>
                      {(invoice.customer_city ||
                        invoice.customer_state ||
                        invoice.customer_zip) && (
                        <p className="text-gray-700">
                          {[
                            invoice.customer_city,
                            invoice.customer_state,
                            invoice.customer_zip,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {invoice.customer_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <p className="text-gray-700">{invoice.customer_phone}</p>
                  </div>
                )}
                {invoice.customer_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <p className="text-gray-700">{invoice.customer_email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            {invoice.line_items && invoice.line_items.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Invoice Items
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                          Description
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                          Tax
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoice.line_items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm text-gray-900">
                                {item.description}
                              </p>
                              {item.style_number && (
                                <p className="text-xs text-gray-500">
                                  {item.style_number}
                                  {item.color && ` - ${item.color}`}
                                </p>
                              )}
                              {item.sizes &&
                                Object.keys(item.sizes).length > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {Object.entries(item.sizes)
                                      .map(([size, qty]) => `${size}: ${qty}`)
                                      .join(', ')}
                                  </p>
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-900">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900">
                            ${item.unit_price.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900">
                            ${item.tax_amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            ${item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>${invoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-700">
                  <span>Tax</span>
                  <span>${invoice.tax.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-300">
                  <span>Total</span>
                  <span>${invoice.total.toFixed(2)}</span>
                </div>
                {invoice.amount_paid > 0 && (
                  <>
                    <div className="flex items-center justify-between text-gray-700 pt-2">
                      <span>Amount Paid</span>
                      <span className="text-green-600">
                        -${invoice.amount_paid.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-lg font-bold text-red-600">
                      <span>Balance Due</span>
                      <span>${invoice.amount_outstanding.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Work Order Link */}
            {invoice.raw_data?.work_order_number && (
              <div className="mt-6 bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Linked Work Order
                    </p>
                    <p className="font-medium text-gray-900">
                      {invoice.raw_data.work_order_number}
                    </p>
                  </div>
                  <button className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                    View Work Order
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => setEmailModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Send Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                Send Invoice via Email
              </h3>
              <button
                onClick={() => setEmailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="customer@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Message (Optional)
                </label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave blank to use default message"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setEmailModalOpen(false)}
                disabled={sendingEmail}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
