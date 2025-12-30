import { useState, useMemo } from 'react';
import { Search, User, DollarSign, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import { Invoice } from '../types/printavo';
import { formatCurrency, calculateCustomerLifetimeValue, calculateCustomerOutstandingBalance } from '../utils/financial-aggregations';
import { format, parseISO } from 'date-fns';
import { getPrintavoInvoiceUrl } from '../utils/printavo-links';

interface CustomerProfile {
  id: string;
  name: string;
  email?: string;
  invoices: Invoice[];
  lifetimeValue: number;
  outstandingBalance: number;
  totalInvoices: number;
}

interface CustomerProfilesProps {
  invoices: Invoice[];
  loading?: boolean;
}

export function CustomerProfiles({ invoices, loading }: CustomerProfilesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'ltv' | 'balance'>('ltv');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const customerProfiles = useMemo(() => {
    const customersMap = new Map<string, CustomerProfile>();

    invoices.forEach(invoice => {
      if (!invoice.contact?.customer) return;

      const customerId = invoice.contact.customer.id;
      const customerName = invoice.contact.customer.companyName || invoice.contact.fullName;

      if (!customersMap.has(customerId)) {
        customersMap.set(customerId, {
          id: customerId,
          name: customerName,
          email: invoice.contact.email,
          invoices: [],
          lifetimeValue: 0,
          outstandingBalance: 0,
          totalInvoices: 0,
        });
      }

      const profile = customersMap.get(customerId)!;
      profile.invoices.push(invoice);
    });

    customersMap.forEach((profile) => {
      profile.lifetimeValue = calculateCustomerLifetimeValue(profile.invoices);
      profile.outstandingBalance = calculateCustomerOutstandingBalance(profile.invoices);
      profile.totalInvoices = profile.invoices.length;
    });

    return Array.from(customersMap.values());
  }, [invoices]);

  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = customerProfiles.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'ltv') {
        comparison = a.lifetimeValue - b.lifetimeValue;
      } else if (sortBy === 'balance') {
        comparison = a.outstandingBalance - b.outstandingBalance;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [customerProfiles, searchTerm, sortBy, sortOrder]);

  const selectedCustomer = useMemo(() => {
    return customerProfiles.find(c => c.id === selectedCustomerId);
  }, [customerProfiles, selectedCustomerId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading customer data...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 mb-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ltv">Sort by LTV</option>
              <option value="balance">Sort by Balance</option>
              <option value="name">Sort by Name</option>
            </select>
            <button
              onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
          {filteredAndSortedCustomers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No customers found
            </div>
          ) : (
            filteredAndSortedCustomers.map(customer => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomerId(customer.id)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                  selectedCustomerId === customer.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{customer.name}</div>
                    {customer.email && (
                      <div className="text-sm text-gray-500 truncate">{customer.email}</div>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>{customer.totalInvoices} invoices</span>
                      <span>{formatCurrency(customer.lifetimeValue)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selectedCustomer ? (
          <CustomerDetail customer={selectedCustomer} />
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Select a customer to view their financial profile
          </div>
        )}
      </div>
    </div>
  );
}

interface CustomerDetailProps {
  customer: CustomerProfile;
}

function CustomerDetail({ customer }: CustomerDetailProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
            {customer.email && (
              <p className="text-gray-500 mt-1">{customer.email}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-600 font-medium">Lifetime Value</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(customer.lifetimeValue)}
            </div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-orange-600 font-medium">Outstanding</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(customer.outstandingBalance)}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Invoices</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {customer.totalInvoices}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-600 font-medium">Estimates</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {customer.totalEstimates}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Invoice History</h3>
        </div>
        <div className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
          {customer.invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No invoices found
            </div>
          ) : (
            customer.invoices.map(invoice => {
              const totalPaid = invoice.payments?.edges.reduce((sum, edge) => sum + edge.node.amount, 0) || 0;
              const balance = invoice.total - totalPaid;

              return (
                <div key={invoice.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <a
                        href={getPrintavoInvoiceUrl(invoice.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {invoice.visualId || invoice.id}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <div className="text-sm text-gray-500">
                        {format(parseISO(invoice.createdAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Total: {formatCurrency(invoice.total)}</span>
                    {balance > 0 && (
                      <span className="text-orange-600">Balance: {formatCurrency(balance)}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
