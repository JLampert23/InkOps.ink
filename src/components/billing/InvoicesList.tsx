import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Mail,
  DollarSign,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { InvoiceService, Invoice } from '../../services/invoice-service';
import { InvoiceDetailModal } from './InvoiceDetailModal';

export function InvoicesList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );

  useEffect(() => {
    loadInvoices();
  }, [statusFilter]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await InvoiceService.getInvoices({
        status_stage: statusFilter || undefined,
      });

      if (data && !error) {
        setInvoices(data);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(searchLower) ||
      invoice.customer_name?.toLowerCase().includes(searchLower) ||
      invoice.customer_company?.toLowerCase().includes(searchLower)
    );
  });

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

  const isOverdue = (invoice: Invoice) => {
    if (!invoice.due_date || invoice.status_stage === 'paid') return false;
    return new Date(invoice.due_date) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
          <p className="text-gray-600 mt-1">
            Manage and track all customer invoices
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search invoices by number, customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Status</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {invoices.length}
              </p>
            </div>
            <FileText className="h-10 w-10 text-blue-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                $
                {invoices
                  .reduce((sum, inv) => sum + inv.amount_outstanding, 0)
                  .toFixed(2)}
              </p>
            </div>
            <DollarSign className="h-10 w-10 text-yellow-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Paid Invoices</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {invoices.filter((inv) => inv.status_stage === 'paid').length}
              </p>
            </div>
            <FileText className="h-10 w-10 text-green-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Overdue</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {invoices.filter(isOverdue).length}
              </p>
            </div>
            <AlertCircle className="h-10 w-10 text-red-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No invoices found
          </h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter
              ? 'Try adjusting your filters'
              : 'Invoices will appear here once created'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                  Due Date
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                  Total
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                  Balance
                </th>
                <th className="px-6 py-3 text-center text-sm font-medium text-gray-700">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedInvoiceId(invoice.id)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {invoice.invoice_number}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      {invoice.customer_company && (
                        <p className="font-medium text-gray-900">
                          {invoice.customer_company}
                        </p>
                      )}
                      <p className="text-sm text-gray-600">
                        {invoice.customer_name}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(invoice.invoice_date)}
                  </td>
                  <td className="px-6 py-4">
                    <div
                      className={`text-sm ${
                        isOverdue(invoice)
                          ? 'text-red-600 font-medium'
                          : 'text-gray-600'
                      }`}
                    >
                      {invoice.due_date ? formatDate(invoice.due_date) : 'N/A'}
                      {isOverdue(invoice) && (
                        <AlertCircle className="inline h-4 w-4 ml-1" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    ${invoice.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`font-medium ${
                        invoice.amount_outstanding > 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      ${invoice.amount_outstanding.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        invoice.status_stage
                      )}`}
                    >
                      {invoice.status_stage.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          InvoiceService.downloadInvoicePDF(
                            invoice.id,
                            `invoice-${invoice.invoice_number}.pdf`
                          );
                        }}
                        className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInvoiceId(invoice.id);
                        }}
                        className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                        title="View Details"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoiceId && (
        <InvoiceDetailModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onRefresh={loadInvoices}
        />
      )}
    </div>
  );
}
