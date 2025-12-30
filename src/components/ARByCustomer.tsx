import { useMemo, useState } from 'react';
import { DollarSign, ChevronDown, ChevronUp, ChevronRight, ExternalLink } from 'lucide-react';
import { Invoice } from '../types/printavo';
import { calculateCustomerAging, getOpenInvoices } from '../utils/aging-calculations';
import { format } from 'date-fns';
import { getPrintavoInvoiceUrl } from '../utils/printavo-links';

interface ARByCustomerProps {
  invoices: Invoice[];
}

type SortField = 'customer' | 'total' | 'count' | 'average' | 'oldest';
type SortDirection = 'asc' | 'desc';

export function ARByCustomer({ invoices }: ARByCustomerProps) {
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const customerAging = useMemo(() => calculateCustomerAging(invoices), [invoices]);
  const openInvoices = useMemo(() => getOpenInvoices(invoices), [invoices]);

  const sortedCustomers = useMemo(() => {
    const sorted = [...customerAging].sort((a, b) => {
      let aValue: number | string = 0;
      let bValue: number | string = 0;

      switch (sortField) {
        case 'customer':
          aValue = a.customerName.toLowerCase();
          bValue = b.customerName.toLowerCase();
          break;
        case 'total':
          aValue = a.total;
          bValue = b.total;
          break;
        case 'count':
          aValue = a.invoiceCount;
          bValue = b.invoiceCount;
          break;
        case 'average':
          aValue = a.averageInvoiceAge;
          bValue = b.averageInvoiceAge;
          break;
        case 'oldest':
          aValue = a.oldestInvoiceAge;
          bValue = b.oldestInvoiceAge;
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
  }, [customerAging, sortField, sortDirection]);

  const getCustomerInvoices = (customerId: string) => {
    return openInvoices.filter(inv => {
      const invoiceCustomerId = inv.contact?.customer?.id || inv.contact?.id || 'unknown';
      return invoiceCustomerId === customerId;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleCustomer = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  const calculateInvoiceAge = (invoiceDate: string) => {
    const created = new Date(invoiceDate);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Accounts Receivable by Customer</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('customer')}
                >
                  <div className="flex items-center gap-1">
                    Customer
                    <SortIcon field="customer" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Total Outstanding
                    <SortIcon field="total" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('count')}
                >
                  <div className="flex items-center justify-center gap-1">
                    # Invoices
                    <SortIcon field="count" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('average')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Avg Age (days)
                    <SortIcon field="average" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('oldest')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Oldest (days)
                    <SortIcon field="oldest" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedCustomers.map(customer => {
                const isExpanded = expandedCustomers.has(customer.customerId);
                const customerInvoices = getCustomerInvoices(customer.customerId);

                return (
                  <>
                    <tr
                      key={customer.customerId}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleCustomer(customer.customerId)}
                    >
                      <td className="px-4 py-3 text-sm">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {customer.customerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        ${customer.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600">
                        {customer.invoiceCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          customer.averageInvoiceAge > 60 ? 'bg-red-100 text-red-800' :
                          customer.averageInvoiceAge > 30 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {customer.averageInvoiceAge}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          customer.oldestInvoiceAge > 90 ? 'bg-red-100 text-red-800' :
                          customer.oldestInvoiceAge > 60 ? 'bg-orange-100 text-orange-800' :
                          customer.oldestInvoiceAge > 30 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {customer.oldestInvoiceAge}
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 bg-gray-50">
                          <div className="ml-8">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Open Invoices</h4>
                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                              <table className="w-full">
                                <thead className="bg-gray-100 border-b border-gray-200">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Invoice #</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Date</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Total</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Outstanding</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-600">Age (days)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {customerInvoices.map(invoice => {
                                    const age = calculateInvoiceAge(invoice.createdAt);
                                    return (
                                      <tr key={invoice.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-sm">
                                          <a
                                            href={getPrintavoInvoiceUrl(invoice.id)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                          >
                                            {invoice.visualId}
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-600">
                                          {format(new Date(invoice.createdAt), 'MMM d, yyyy')}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right text-gray-900">
                                          ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">
                                          ${(invoice.amountOutstanding || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-center">
                                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                            age > 90 ? 'bg-red-100 text-red-800' :
                                            age > 60 ? 'bg-orange-100 text-orange-800' :
                                            age > 30 ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-green-100 text-green-800'
                                          }`}>
                                            {age}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {sortedCustomers.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts receivable</h3>
            <p className="text-gray-600">All invoices are paid in full</p>
          </div>
        )}
      </div>
    </div>
  );
}
