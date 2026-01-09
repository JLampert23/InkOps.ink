import { useState, useEffect } from 'react';
import { Users, Download, Search, ChevronRight, Mail, Phone, DollarSign, Loader2, FileText, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format } from 'date-fns';

interface Customer {
  customer_name: string;
  email: string;
  phone: string;
  total_invoices: number;
  total_billed: number;
  total_paid: number;
  outstanding_balance: number;
}

interface CustomerDetail {
  invoice_number: string;
  invoice_date: string;
  total: number;
  amount_paid: number;
  status: string;
}

export default function CustomersReport() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const { data: invoices, error } = await supabase
        .from('printavo_invoices')
        .select('*');

      if (error) throw error;

      const customerMap = new Map<string, Customer>();

      (invoices || []).forEach((inv: any) => {
        const customerName = inv.customer_name;
        const total = parseFloat(inv.total || 0);
        const paid = parseFloat(inv.amount_paid || 0);
        const outstanding = total - paid;

        if (!customerMap.has(customerName)) {
          customerMap.set(customerName, {
            customer_name: customerName,
            email: inv.customer_email || '',
            phone: inv.customer_phone || '',
            total_invoices: 0,
            total_billed: 0,
            total_paid: 0,
            outstanding_balance: 0,
          });
        }

        const customer = customerMap.get(customerName)!;
        customer.total_invoices += 1;
        customer.total_billed += total;
        customer.total_paid += paid;
        customer.outstanding_balance += outstanding;
      });

      const customerList = Array.from(customerMap.values()).sort((a, b) =>
        b.total_billed - a.total_billed
      );

      setCustomers(customerList);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerDetails = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from('printavo_invoices')
        .select('*')
        .eq('customer_name', customer.customer_name)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      const details: CustomerDetail[] = (data || []).map((inv: any) => ({
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        total: parseFloat(inv.total || 0),
        amount_paid: parseFloat(inv.amount_paid || 0),
        status: inv.status,
      }));

      setCustomerInvoices(details);
    } catch (error) {
      console.error('Error loading customer details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ['Customer Name', 'Email', 'Phone', 'Total Invoices', 'Total Billed', 'Total Paid', 'Outstanding Balance'];
    const rows = customers.map(cust => [
      cust.customer_name,
      cust.email,
      cust.phone,
      cust.total_invoices,
      cust.total_billed.toFixed(2),
      cust.total_paid.toFixed(2),
      cust.outstanding_balance.toFixed(2),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Customers</span>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {customers.length}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Billed</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${customers.reduce((sum, c) => sum + c.total_billed, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Paid</span>
            <CreditCard className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${customers.reduce((sum, c) => sum + c.total_paid, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Outstanding</span>
            <FileText className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${customers.reduce((sum, c) => sum + c.outstanding_balance, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Search and Export */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customers List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Customers ({filteredCustomers.length})</h3>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
            {filteredCustomers.map((customer) => (
              <button
                key={customer.customer_name}
                onClick={() => loadCustomerDetails(customer)}
                className={`w-full px-6 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${
                  selectedCustomer?.customer_name === customer.customer_name ? 'bg-green-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{customer.customer_name}</h4>
                    <div className="mt-1 space-y-1">
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          {customer.email}
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          {customer.phone}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span className="text-gray-600">{customer.total_invoices} invoices</span>
                      <span className="font-semibold text-gray-900">
                        ${customer.total_billed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {customer.outstanding_balance > 0 && (
                        <span className="text-orange-600 font-medium">
                          ${customer.outstanding_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} due
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                </div>
              </button>
            ))}

            {filteredCustomers.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Customers Found</h3>
                <p className="text-gray-600">Try adjusting your search.</p>
              </div>
            )}
          </div>
        </div>

        {/* Customer Details */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {selectedCustomer ? (
            <>
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">{selectedCustomer.customer_name}</h3>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Billed:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      ${selectedCustomer.total_billed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Paid:</span>
                    <span className="ml-2 font-semibold text-green-600">
                      ${selectedCustomer.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Outstanding:</span>
                    <span className="ml-2 font-semibold text-orange-600">
                      ${selectedCustomer.outstanding_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Invoices:</span>
                    <span className="ml-2 font-semibold text-gray-900">{selectedCustomer.total_invoices}</span>
                  </div>
                </div>
              </div>

              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                </div>
              ) : (
                <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {customerInvoices.map((inv) => (
                        <tr key={inv.invoice_number} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {format(new Date(inv.invoice_date), 'MMM dd, yyyy')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            ${inv.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              inv.status === 'Paid' ? 'bg-green-100 text-green-800' :
                              inv.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Customer</h3>
                <p className="text-gray-600">Click on a customer to view their details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
