import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Invoice, LineItem } from '../types/printavo';
import { formatCurrency } from '../utils/financial-aggregations';
import { format, parseISO } from 'date-fns';
import { getPrintavoInvoiceUrl } from '../utils/printavo-links';

interface InvoiceExplorerProps {
  invoices: Invoice[];
  loading?: boolean;
}

function getCustomerName(invoice: Invoice): string {
  return invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown';
}

function getCustomerEmail(invoice: Invoice): string {
  return invoice.contact?.email || '';
}

function getInvoiceNumber(invoice: Invoice): string {
  return invoice.visualId || invoice.id;
}

function flattenLineItems(invoice: Invoice): LineItem[] {
  const items: LineItem[] = [];
  invoice.lineItemGroups?.edges.forEach(groupEdge => {
    groupEdge.node.lineItems.edges.forEach(itemEdge => {
      items.push(itemEdge.node);
    });
  });
  return items;
}

export function InvoiceExplorer({ invoices, loading }: InvoiceExplorerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'total' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices.filter(invoice => {
      const matchesSearch =
        getInvoiceNumber(invoice).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCustomerName(invoice).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCustomerEmail(invoice).toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'total') {
        comparison = (a.total || 0) - (b.total || 0);
      } else if (sortBy === 'customer') {
        comparison = getCustomerName(a).localeCompare(getCustomerName(b));
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [invoices, searchTerm, sortBy, sortOrder]);

  const toggleInvoice = (invoiceId: string) => {
    setExpandedInvoices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId);
      } else {
        newSet.add(invoiceId);
      }
      return newSet;
    });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by invoice number, customer, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'total' | 'customer')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Sort by Date</option>
              <option value="total">Sort by Total</option>
              <option value="customer">Sort by Customer</option>
            </select>
            <button
              onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            Invoices ({filteredAndSortedInvoices.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-200">
          {filteredAndSortedInvoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No invoices found matching your criteria
            </div>
          ) : (
            filteredAndSortedInvoices.map(invoice => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                expanded={expandedInvoices.has(invoice.id)}
                onToggle={() => toggleInvoice(invoice.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface InvoiceRowProps {
  invoice: Invoice;
  expanded: boolean;
  onToggle: () => void;
}

function InvoiceRow({ invoice, expanded, onToggle }: InvoiceRowProps) {
  const totalPaid = invoice.amountPaid || 0;
  const balance = invoice.amountOutstanding || 0;
  const lineItems = flattenLineItems(invoice);

  return (
    <div className="hover:bg-gray-50">
      <div
        className="p-4 cursor-pointer flex items-center gap-4"
        onClick={onToggle}
      >
        <button className="text-gray-400 hover:text-gray-600">
          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <a
              href={getPrintavoInvoiceUrl(invoice.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {getInvoiceNumber(invoice)}
              <ExternalLink className="w-3 h-3" />
            </a>
            <div className="text-sm text-gray-500">
              {format(parseISO(invoice.createdAt), 'MMM d, yyyy')}
            </div>
          </div>
          <div>
            <div className="font-medium text-gray-900">{getCustomerName(invoice)}</div>
            <div className="text-sm text-gray-500">{getCustomerEmail(invoice)}</div>
          </div>
          <div>
            <div className="font-medium text-gray-900">{formatCurrency(invoice.total || 0)}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div>
            <div className="font-medium text-gray-900">{formatCurrency(balance)}</div>
            <div className="text-sm text-gray-500">Balance</div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 ml-9 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            {lineItems.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Line Items</h4>
                <div className="space-y-2">
                  {lineItems.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.name} (x{item.quantity})</span>
                      <span>{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invoice.transactions && invoice.transactions.edges.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Payments</h4>
                <div className="space-y-2">
                  {invoice.transactions.edges.map(edge => (
                    <div key={edge.node.id} className="flex justify-between text-sm">
                      <span>
                        {edge.node.transactionDate
                          ? format(parseISO(edge.node.transactionDate), 'MMM d, yyyy')
                          : 'Date unavailable'}
                      </span>
                      <span className="text-green-600">{formatCurrency(edge.node.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invoice.fees && invoice.fees.edges.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Fees</h4>
                <div className="space-y-2">
                  {invoice.fees.edges.map(edge => (
                    <div key={edge.node.id} className="flex justify-between text-sm">
                      <span>{edge.node.description || 'Fee'}</span>
                      <span>{formatCurrency(edge.node.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between text-sm mb-1">
                <span>Subtotal</span>
                <span>{formatCurrency(invoice.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>Tax</span>
                <span>{formatCurrency(invoice.salesTaxAmount || 0)}</span>
              </div>
              <div className="flex justify-between font-medium text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{formatCurrency(invoice.total || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
