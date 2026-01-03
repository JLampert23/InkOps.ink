import { useState, useMemo, Fragment, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, Calendar, FileDown, ExternalLink, Filter } from 'lucide-react';
import { Invoice } from '../types/printavo';
import { getOpenInvoices, calculateDaysOutstanding } from '../utils/aging-calculations';
import { format } from 'date-fns';
import { exportToCSV, CSVColumn } from '../utils/csv-export';
import { exportToPDF, PDFColumn } from '../utils/pdf-export';
import { getPrintavoInvoiceUrl } from '../utils/printavo-links';
import { supabase } from '../lib/supabase-client';

interface OpenInvoicesProps {
  invoices: Invoice[];
}

type SortField = 'dueDate' | 'balance' | 'customer' | 'daysOutstanding' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export function OpenInvoices({ invoices }: OpenInvoicesProps) {
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);

  useEffect(() => {
    loadStatusPreferences();
  }, []);

  const loadStatusPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('selected_invoice_statuses')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.selected_invoice_statuses && data.selected_invoice_statuses.length > 0) {
        setAvailableStatuses(data.selected_invoice_statuses);
      }
    } catch (err) {
      // Silent fail - will use default behavior
    }
  };

  const statusFilteredInvoices = useMemo(() => {
    if (selectedStatus === 'all') return invoices;
    return invoices.filter(inv => inv.status?.name === selectedStatus);
  }, [invoices, selectedStatus]);

  const openInvoices = useMemo(() => getOpenInvoices(statusFilteredInvoices), [statusFilteredInvoices]);

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = openInvoices;

    if (searchTerm) {
      filtered = filtered.filter(invoice => {
        const customerName = (invoice.contact?.customer?.companyName || invoice.contact?.fullName || '').toLowerCase();
        const visualId = (invoice.visualId || '').toLowerCase();
        return customerName.includes(searchTerm.toLowerCase()) || visualId.includes(searchTerm.toLowerCase());
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortField) {
        case 'dueDate':
          aValue = a.dueAt ? new Date(a.dueAt).getTime() : 0;
          bValue = b.dueAt ? new Date(b.dueAt).getTime() : 0;
          break;
        case 'balance':
          aValue = a.amountOutstanding || 0;
          bValue = b.amountOutstanding || 0;
          break;
        case 'customer':
          aValue = (a.contact?.customer?.companyName || a.contact?.fullName || '').toLowerCase();
          bValue = (b.contact?.customer?.companyName || b.contact?.fullName || '').toLowerCase();
          break;
        case 'daysOutstanding':
          aValue = calculateDaysOutstanding(a.createdAt);
          bValue = calculateDaysOutstanding(b.createdAt);
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return sorted;
  }, [openInvoices, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const totalBalance = filteredAndSortedInvoices.reduce((sum, inv) => sum + (inv.amountOutstanding || 0), 0);

  const handleExportCSV = () => {
    const columns: CSVColumn[] = [
      { header: 'Customer', key: 'customer' },
      { header: 'Invoice #', key: 'invoiceNumber' },
      { header: 'Created Date', key: 'createdDate' },
      { header: 'Due Date', key: 'dueDate' },
      { header: 'Total', key: 'total' },
      { header: 'Paid', key: 'paid' },
      { header: 'Balance Due', key: 'balance' },
      { header: 'Days Outstanding', key: 'daysOut' },
    ];

    const exportData = filteredAndSortedInvoices.map(invoice => ({
      customer: invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown',
      invoiceNumber: invoice.visualId || invoice.id.slice(0, 8),
      createdDate: format(new Date(invoice.createdAt), 'MM/dd/yyyy'),
      dueDate: invoice.dueAt ? format(new Date(invoice.dueAt), 'MM/dd/yyyy') : '-',
      total: `$${(invoice.total || 0).toFixed(2)}`,
      paid: `$${(invoice.amountPaid || 0).toFixed(2)}`,
      balance: `$${(invoice.amountOutstanding || 0).toFixed(2)}`,
      daysOut: calculateDaysOutstanding(invoice.createdAt).toString(),
    }));

    const statusSuffix = selectedStatus !== 'all' ? `-${selectedStatus.replace(/[^a-zA-Z0-9]/g, '-')}` : '';
    exportToCSV(exportData, columns, `open-invoices${statusSuffix}-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handleExportPDF = () => {
    const columns: PDFColumn[] = [
      { header: 'Customer', dataKey: 'customer' },
      { header: 'Invoice #', dataKey: 'invoiceNumber' },
      { header: 'Created', dataKey: 'createdDate' },
      { header: 'Due Date', dataKey: 'dueDate' },
      { header: 'Total', dataKey: 'total' },
      { header: 'Paid', dataKey: 'paid' },
      { header: 'Balance Due', dataKey: 'balance' },
      { header: 'Days', dataKey: 'daysOut' },
    ];

    const exportData = filteredAndSortedInvoices.map(invoice => ({
      customer: invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown',
      invoiceNumber: invoice.visualId || invoice.id.slice(0, 8),
      createdDate: format(new Date(invoice.createdAt), 'MM/dd/yyyy'),
      dueDate: invoice.dueAt ? format(new Date(invoice.dueAt), 'MM/dd/yyyy') : '-',
      total: `$${(invoice.total || 0).toFixed(2)}`,
      paid: `$${(invoice.amountPaid || 0).toFixed(2)}`,
      balance: `$${(invoice.amountOutstanding || 0).toFixed(2)}`,
      daysOut: calculateDaysOutstanding(invoice.createdAt).toString(),
    }));

    const statusSuffix = selectedStatus !== 'all' ? `-${selectedStatus.replace(/[^a-zA-Z0-9]/g, '-')}` : '';
    const statusText = selectedStatus !== 'all' ? ` • Status: ${selectedStatus}` : '';
    const totalPaid = filteredAndSortedInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
    const totalInvoiced = filteredAndSortedInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    exportToPDF({
      title: 'Open Invoices Report',
      subtitle: `${format(new Date(), 'MMMM d, yyyy')}${statusText}`,
      filename: `open-invoices${statusSuffix}-${format(new Date(), 'yyyy-MM-dd')}`,
      columns,
      data: exportData,
      orientation: 'landscape',
      summary: [
        { label: 'Total Open Invoices', value: filteredAndSortedInvoices.length.toString() },
        { label: 'Total Invoiced', value: `$${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
        { label: 'Total Paid', value: `$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
        { label: 'Balance Outstanding', value: `$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}` }
      ]
    });
  };

  return (
    <div className="space-y-6">
      {openInvoices.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900">No Unpaid Invoices</h3>
              <p className="text-blue-700 mt-1">
                Great news! All {invoices.length} invoices in your account have been paid in full.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Open Invoices</h2>
            <p className="text-gray-600 mt-1">
              {filteredAndSortedInvoices.length} open invoices · ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding
              {selectedStatus !== 'all' && <span className="text-blue-600"> · Filtered by status</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {availableStatuses.length > 0 ? (
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  {availableStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                Configure status filters in Account Settings
              </div>
            )}
            <button
              onClick={handleExportCSV}
              disabled={filteredAndSortedInvoices.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              <span className="font-medium">Export CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={filteredAndSortedInvoices.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              <span className="font-medium">Export PDF</span>
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer or invoice number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('customer')}>
                  <div className="flex items-center gap-1">
                    Customer
                    <SortIcon field="customer" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center gap-1">
                    Created
                    <SortIcon field="createdAt" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('dueDate')}>
                  <div className="flex items-center gap-1">
                    Due Date
                    <SortIcon field="dueDate" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('balance')}>
                  <div className="flex items-center justify-end gap-1">
                    Balance Due
                    <SortIcon field="balance" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('daysOutstanding')}>
                  <div className="flex items-center justify-center gap-1">
                    Days Out
                    <SortIcon field="daysOutstanding" />
                  </div>
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedInvoices.map(invoice => {
                const isExpanded = expandedInvoice === invoice.id;
                const daysOutstanding = calculateDaysOutstanding(invoice.createdAt);
                const lineItems = invoice.lineItemGroups?.edges?.flatMap(group =>
                  group.node.lineItems.edges.map(item => item.node)
                ) || [];
                const payments = invoice.transactions?.edges?.map(edge => edge.node) || [];
                const fees = invoice.fees?.edges?.map(edge => edge.node) || [];

                return (
                  <Fragment key={invoice.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <a
                          href={getPrintavoInvoiceUrl(invoice.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                        >
                          {invoice.visualId || invoice.id.slice(0, 8)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {format(new Date(invoice.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {invoice.dueAt ? format(new Date(invoice.dueAt), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        ${(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right">
                        ${(invoice.amountPaid || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-red-600 text-right">
                        ${(invoice.amountOutstanding || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          daysOutstanding > 90 ? 'bg-red-100 text-red-800' :
                          daysOutstanding > 60 ? 'bg-orange-100 text-orange-800' :
                          daysOutstanding > 30 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {daysOutstanding}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button
                          onClick={() => setExpandedInvoice(isExpanded ? null : invoice.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="px-4 py-4 bg-gray-50">
                          <div className="grid grid-cols-3 gap-6">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2">Line Items</h4>
                              {lineItems.length > 0 ? (
                                <div className="space-y-1">
                                  {lineItems.map(item => (
                                    <div key={item.id} className="flex justify-between text-sm">
                                      <span className="text-gray-600">{item.description} (x{item.items})</span>
                                      <span className="text-gray-900">${((item.price || 0) * item.items).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No line items</p>
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2">Payments</h4>
                              {payments.length > 0 ? (
                                <div className="space-y-1">
                                  {payments.map(payment => (
                                    <div key={payment.id} className="flex justify-between text-sm">
                                      <span className="text-gray-600">
                                        {payment.transactionDate ? format(new Date(payment.transactionDate), 'MMM d, yyyy') : 'N/A'}
                                      </span>
                                      <span className="text-green-600">${payment.amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No payments</p>
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-2">Fees</h4>
                              {fees.length > 0 ? (
                                <div className="space-y-1">
                                  {fees.map(fee => (
                                    <div key={fee.id} className="flex justify-between text-sm">
                                      <span className="text-gray-600">{fee.description || 'Fee'}</span>
                                      <span className="text-gray-900">${fee.amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500">No fees</p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredAndSortedInvoices.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No open invoices found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
