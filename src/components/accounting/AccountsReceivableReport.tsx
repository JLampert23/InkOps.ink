import { useState, useEffect } from 'react';
import { Calendar, Download, Filter, TrendingUp, DollarSign, AlertCircle, Loader2, FileText, FileSpreadsheet, Settings, Clock, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format } from 'date-fns';
import { InvoiceDetail } from '../billing/InvoiceDetail';
import ARReportBuilderModal from './ARReportBuilderModal';
import { exportARToPDF, exportARToCSV, downloadCSV, getDefaultARColumns } from '../../utils/ar-export';

interface Invoice {
  invoice_id: string;
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

interface AccountsReceivableReportProps {
  onNavigateToSettings?: (tab: string) => void;
}

export default function AccountsReceivableReport({ onNavigateToSettings }: AccountsReceivableReportProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedAgingBucket, setSelectedAgingBucket] = useState('all');
  const [customers, setCustomers] = useState<string[]>([]);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [companyName, setCompanyName] = useState('Company Name');

  useEffect(() => {
    loadData();
  }, [dateRange, selectedCustomer]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('company_name')
        .maybeSingle();

      if (settings?.company_name) {
        setCompanyName(settings.company_name);
      }

      let query = supabase
        .from('printavo_invoices')
        .select('*')
        .eq('status_stage', 'accounts_receivable')
        .gt('amount_outstanding', 0)
        .order('due_date', { ascending: true });

      if (selectedCustomer !== 'all') {
        query = query.eq('customer_name', selectedCustomer);
      }

      const { data, error } = await query;

      if (error) throw error;

      const processedInvoices: Invoice[] = (data || []).map((inv: any) => {
        const total = parseFloat(inv.total || 0);
        const amountPaid = parseFloat(inv.amount_paid || 0);
        const balanceRemaining = parseFloat(inv.amount_outstanding || 0);
        const dueDate = new Date(inv.due_date);
        const today = new Date();
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        let agingBucket: '0-30' | '31-60' | '61-90' | '90+' = '0-30';
        if (daysOverdue > 90) agingBucket = '90+';
        else if (daysOverdue > 60) agingBucket = '61-90';
        else if (daysOverdue > 30) agingBucket = '31-60';

        return {
          invoice_id: inv.id,
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

  const filteredInvoices = invoices.filter(inv => {
    if (selectedAgingBucket !== 'all' && inv.aging_bucket !== selectedAgingBucket) {
      return false;
    }
    return true;
  });

  const totalOutstanding = filteredInvoices.reduce((sum, inv) => sum + inv.balance_remaining, 0);
  const agingBuckets = calculateAgingBuckets();

  const handleViewInvoice = (invoiceId: string) => {
    setViewingInvoiceId(invoiceId);
  };

  const handleBackToReport = () => {
    setViewingInvoiceId(null);
  };

  const handleExportPDF = async () => {
    await exportARToPDF({
      invoices: filteredInvoices,
      columns: getDefaultARColumns(),
      companyName,
    });
  };

  const handleExportCSV = () => {
    const csvContent = exportARToCSV({
      invoices: filteredInvoices,
      columns: getDefaultARColumns(),
    });
    downloadCSV(csvContent);
  };

  const exportPrebuiltReport = async (reportType: string, format: 'pdf' | 'csv') => {
    let reportInvoices = invoices;
    let reportTitle = 'Accounts Receivable Report';

    switch (reportType) {
      case 'full':
        reportTitle = 'Full Accounts Receivable Summary';
        break;
      case 'aging':
        reportTitle = 'Aging Report';
        break;
      case 'by-customer':
        reportTitle = 'Outstanding Invoices by Customer';
        break;
      case 'partial':
        reportTitle = 'Partially Paid Invoices';
        reportInvoices = invoices.filter(inv => inv.amount_paid > 0 && inv.balance_remaining > 0);
        break;
      case 'overdue':
        reportTitle = 'Overdue Invoices Only';
        reportInvoices = invoices.filter(inv => inv.days_overdue > 0);
        break;
    }

    if (format === 'pdf') {
      await exportARToPDF({
        invoices: reportInvoices,
        columns: getDefaultARColumns(),
        companyName,
        reportTitle,
      });
    } else {
      const csvContent = exportARToCSV({
        invoices: reportInvoices,
        columns: getDefaultARColumns(),
      });
      downloadCSV(csvContent, `${reportTitle.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    }
  };

  if (viewingInvoiceId) {
    return (
      <InvoiceDetail
        invoiceId={viewingInvoiceId}
        onBack={handleBackToReport}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prebuilt Reports Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Prebuilt Reports</h3>
            <p className="text-sm text-gray-600 mt-1">Quick access to common AR reports</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { type: 'full', title: 'Full AR Summary', icon: FileText },
            { type: 'aging', title: 'Aging Report', icon: Clock },
            { type: 'by-customer', title: 'By Customer', icon: Users },
            { type: 'partial', title: 'Partially Paid', icon: DollarSign },
            { type: 'overdue', title: 'Overdue Only', icon: AlertCircle },
          ].map((report) => {
            const Icon = report.icon;
            return (
              <div key={report.type} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-gray-600" />
                  <h4 className="text-sm font-medium text-gray-900">{report.title}</h4>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportPrebuiltReport(report.type, 'pdf')}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    PDF
                  </button>
                  <button
                    onClick={() => exportPrebuiltReport(report.type, 'csv')}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                  >
                    <FileSpreadsheet className="w-3 h-3" />
                    CSV
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-blue-900">
            <span className="font-medium">Tip:</span> You can schedule automated AR reports to be sent via email from the{' '}
            <span className="font-semibold">Settings → Automated Reports</span> section. Set up daily, weekly, or monthly reports in PDF or CSV format.
          </p>
        </div>
      </div>

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
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Customers</option>
            {customers.map(customer => (
              <option key={customer} value={customer}>{customer}</option>
            ))}
          </select>

          <select
            value={selectedAgingBucket}
            onChange={(e) => setSelectedAgingBucket(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Aging Buckets</option>
            <option value="0-30">0-30 Days</option>
            <option value="31-60">31-60 Days</option>
            <option value="61-90">61-90 Days</option>
            <option value="90+">90+ Days</option>
          </select>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={() => onNavigateToSettings?.('automated-reports')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Automations
            </button>

            <button
              onClick={() => setShowReportBuilder(true)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Report Builder
            </button>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export CSV
            </button>
          </div>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Paid</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Remaining</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aging Bucket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.invoice_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleViewInvoice(invoice.invoice_id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {invoice.invoice_number}
                    </button>
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

          {filteredInvoices.length === 0 && (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Outstanding Invoices</h3>
              <p className="text-gray-600">All invoices have been paid.</p>
            </div>
          )}
        </div>
      </div>

      <ARReportBuilderModal
        isOpen={showReportBuilder}
        onClose={() => setShowReportBuilder(false)}
        onGenerate={() => {}}
        invoices={filteredInvoices}
      />
    </div>
  );
}
