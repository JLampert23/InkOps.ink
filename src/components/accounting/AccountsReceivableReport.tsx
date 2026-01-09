import { useState, useEffect } from 'react';
import { Calendar, Download, Filter, TrendingUp, DollarSign, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format } from 'date-fns';

interface Invoice {
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  total: number;
  amount_paid: number;
  balance_remaining: number;
  days_overdue: number;
  aging_bucket: '0-30' | '31-60' | '61-90' | '90+';
}

interface AgingBucket {
  bucket: string;
  count: number;
  total: number;
}

export default function AccountsReceivableReport() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [customers, setCustomers] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [dateRange, selectedCustomer, selectedStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('printavo_invoices')
        .select('*')
        .in('status', ['Unpaid', 'Partially Paid']);

      if (selectedCustomer !== 'all') {
        query = query.eq('customer_name', selectedCustomer);
      }

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      const processedInvoices: Invoice[] = (data || []).map((inv: any) => {
        const total = parseFloat(inv.total || 0);
        const amountPaid = parseFloat(inv.amount_paid || 0);
        const balanceRemaining = total - amountPaid;
        const dueDate = new Date(inv.due_date);
        const today = new Date();
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        let agingBucket: '0-30' | '31-60' | '61-90' | '90+' = '0-30';
        if (daysOverdue > 90) agingBucket = '90+';
        else if (daysOverdue > 60) agingBucket = '61-90';
        else if (daysOverdue > 30) agingBucket = '31-60';

        return {
          invoice_id: inv.invoice_id,
          invoice_number: inv.invoice_number,
          customer_name: inv.customer_name,
          invoice_date: inv.invoice_date,
          due_date: inv.due_date,
          total,
          amount_paid: amountPaid,
          balance_remaining: balanceRemaining,
          days_overdue: daysOverdue,
          aging_bucket: agingBucket,
        };
      });

      setInvoices(processedInvoices);

      const uniqueCustomers = Array.from(new Set(processedInvoices.map(inv => inv.customer_name)));
      setCustomers(uniqueCustomers.sort());
    } catch (error) {
      console.error('Error loading AR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAgingBuckets = (): AgingBucket[] => {
    const buckets = ['0-30', '31-60', '61-90', '90+'];
    return buckets.map(bucket => {
      const filtered = invoices.filter(inv => inv.aging_bucket === bucket);
      return {
        bucket,
        count: filtered.length,
        total: filtered.reduce((sum, inv) => sum + inv.balance_remaining, 0),
      };
    });
  };

  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.balance_remaining, 0);
  const agingBuckets = calculateAgingBuckets();

  const exportToCSV = () => {
    const headers = ['Invoice #', 'Customer', 'Invoice Date', 'Due Date', 'Total', 'Paid', 'Balance', 'Days Overdue', 'Aging Bucket'];
    const rows = invoices.map(inv => [
      inv.invoice_number,
      inv.customer_name,
      inv.invoice_date,
      inv.due_date,
      inv.total.toFixed(2),
      inv.amount_paid.toFixed(2),
      inv.balance_remaining.toFixed(2),
      inv.days_overdue,
      inv.aging_bucket,
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts-receivable-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Outstanding</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">{invoices.length} invoices</div>
        </div>

        {agingBuckets.map((bucket, index) => (
          <div key={bucket.bucket} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">{bucket.bucket} Days</span>
              <AlertCircle className={`w-5 h-5 ${index === 3 ? 'text-red-600' : index === 2 ? 'text-orange-600' : 'text-yellow-600'}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">
              ${bucket.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">{bucket.count} invoices</div>
          </div>
        ))}
      </div>

      {/* Filters and Export */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Customers</option>
            {customers.map(customer => (
              <option key={customer} value={customer}>{customer}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Statuses</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
          </select>

          <button
            onClick={exportToCSV}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aging</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.invoice_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {format(new Date(invoice.invoice_date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                    ${invoice.amount_paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                    ${invoice.balance_remaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      invoice.aging_bucket === '90+' ? 'bg-red-100 text-red-800' :
                      invoice.aging_bucket === '61-90' ? 'bg-orange-100 text-orange-800' :
                      invoice.aging_bucket === '31-60' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {invoice.aging_bucket}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {invoices.length === 0 && (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Outstanding Invoices</h3>
              <p className="text-gray-600">All invoices have been paid.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
