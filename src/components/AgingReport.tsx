import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileDown, ExternalLink } from 'lucide-react';
import { Invoice } from '../types/printavo';
import { categorizeIntoAgingBuckets, calculateDaysOutstanding, calculateDaysPastDue } from '../utils/aging-calculations';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { exportToCSV } from '../utils/csv-export';
import { exportToPDF } from '../utils/pdf-export';
import { getOpenInvoices } from '../utils/aging-calculations';
import { getPrintavoInvoiceUrl } from '../utils/printavo-links';

interface AgingReportProps {
  invoices: Invoice[];
}

export function AgingReport({ invoices }: AgingReportProps) {
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

  const agingBuckets = useMemo(() => categorizeIntoAgingBuckets(invoices), [invoices]);

  const totalOutstanding = agingBuckets.reduce((sum, bucket) => sum + bucket.total, 0);
  const totalInvoices = agingBuckets.reduce((sum, bucket) => sum + bucket.count, 0);

  const chartData = agingBuckets.map(bucket => ({
    name: bucket.label,
    total: bucket.total,
    count: bucket.count,
  }));

  const bucketColors = ['#3b82f6', '#10b981', '#fbbf24', '#f97316', '#dc2626'];

  const openInvoices = useMemo(() => getOpenInvoices(invoices), [invoices]);

  const handleExportCSV = () => {
    const filteredInvoices = invoices.filter(invoice => {
      const total = invoice.total || 0;
      const amountOutstanding = invoice.amountOutstanding || 0;
      const status = invoice.status?.name?.toLowerCase() || '';

      return total > 0
        && amountOutstanding > 0
        && !status.includes('dead');
    });

    const data = filteredInvoices.map(invoice => {
      const daysPastDue = calculateDaysPastDue(invoice.dueAt, invoice.invoiceAt || invoice.createdAt);
      const bucket = daysPastDue <= 0 ? 'Current' :
                     daysPastDue >= 1 && daysPastDue <= 30 ? '1-30 days' :
                     daysPastDue >= 31 && daysPastDue <= 60 ? '31-60 days' :
                     daysPastDue >= 61 && daysPastDue <= 90 ? '61-90 days' :
                     '90+ days';

      return {
        customer: invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown',
        invoiceNumber: invoice.visualId || '',
        invoiceDate: invoice.invoiceAt || invoice.createdAt,
        dueDate: invoice.dueAt || '',
        total: invoice.total || 0,
        outstanding: invoice.amountOutstanding || 0,
        agingBucket: bucket,
        daysPastDue: daysPastDue <= 0 ? 'Not Due' : daysPastDue.toString()
      };
    });

    exportToCSV(
      data,
      [
        { header: 'Customer', key: 'customer' },
        { header: 'Invoice #', key: 'invoiceNumber' },
        { header: 'Invoice Date', key: 'invoiceDate', formatter: (val) => format(new Date(val), 'MMM d, yyyy') },
        { header: 'Due Date', key: 'dueDate', formatter: (val) => val ? format(new Date(val), 'MMM d, yyyy') : '' },
        { header: 'Total Amount', key: 'total', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Amount Outstanding', key: 'outstanding', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Aging Bucket', key: 'agingBucket' },
        { header: 'Days Past Due', key: 'daysPastDue' }
      ],
      `aging-report-${format(new Date(), 'yyyy-MM-dd')}`
    );
  };

  const handleExportPDF = () => {
    const filteredInvoices = invoices.filter(invoice => {
      const total = invoice.total || 0;
      const amountOutstanding = invoice.amountOutstanding || 0;
      const status = invoice.status?.name?.toLowerCase() || '';

      return total > 0
        && amountOutstanding > 0
        && !status.includes('dead');
    });

    const data = filteredInvoices.map(invoice => {
      const daysPastDue = calculateDaysPastDue(invoice.dueAt, invoice.invoiceAt || invoice.createdAt);
      const bucket = daysPastDue <= 0 ? 'Current' :
                     daysPastDue >= 1 && daysPastDue <= 30 ? '1-30 days' :
                     daysPastDue >= 31 && daysPastDue <= 60 ? '31-60 days' :
                     daysPastDue >= 61 && daysPastDue <= 90 ? '61-90 days' :
                     '90+ days';

      return {
        customer: invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown',
        invoiceNumber: invoice.visualId || '',
        invoiceDate: invoice.invoiceAt || invoice.createdAt,
        dueDate: invoice.dueAt || '',
        total: invoice.total || 0,
        outstanding: invoice.amountOutstanding || 0,
        agingBucket: bucket,
        daysPastDue: daysPastDue <= 0 ? 'Not Due' : `${daysPastDue}d`
      };
    });

    exportToPDF({
      title: 'Accounts Receivable Aging Report',
      subtitle: `Generated on ${format(new Date(), 'MMMM d, yyyy')}`,
      filename: `aging-report-${format(new Date(), 'yyyy-MM-dd')}`,
      columns: [
        { header: 'Customer', dataKey: 'customer' },
        { header: 'Invoice #', dataKey: 'invoiceNumber' },
        { header: 'Invoice Date', dataKey: 'invoiceDate', formatter: (val) => format(new Date(val), 'MMM d, yyyy') },
        { header: 'Due Date', dataKey: 'dueDate', formatter: (val) => val ? format(new Date(val), 'MMM d, yyyy') : 'N/A' },
        { header: 'Total', dataKey: 'total', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Outstanding', dataKey: 'outstanding', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Aging Bucket', dataKey: 'agingBucket' },
        { header: 'Days Past Due', dataKey: 'daysPastDue' }
      ],
      data,
      orientation: 'landscape',
      summary: [
        { label: 'Total Open Invoices', value: totalInvoices.toString() },
        { label: 'Total Outstanding', value: `$${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
        ...agingBuckets.slice(0, 3).map(bucket => ({
          label: bucket.label,
          value: `$${bucket.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        }))
      ]
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Aging Report</h2>
            <p className="text-gray-600 mt-1">
              {totalInvoices} open invoices · ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={openInvoices.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              <span className="font-medium">Export CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              disabled={openInvoices.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              <span className="font-medium">Export PDF</span>
            </button>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding by Age</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              />
              <Bar dataKey="total" name="Total Outstanding">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={bucketColors[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          {agingBuckets.map((bucket, index) => {
            const isExpanded = expandedBucket === bucket.name;
            const percentage = totalOutstanding > 0 ? (bucket.total / totalOutstanding) * 100 : 0;

            return (
              <div key={bucket.name} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedBucket(isExpanded ? null : bucket.name)}
                  className="w-full px-6 py-4 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: bucketColors[index] }}
                    />
                    <div className="text-left">
                      <h4 className="text-lg font-semibold text-gray-900">{bucket.label}</h4>
                      <p className="text-sm text-gray-600">
                        {bucket.count} invoices · {percentage.toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        ${bucket.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && bucket.invoices.length > 0 && (
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                    <table className="w-full">
                      <thead className="border-b border-gray-200">
                        <tr>
                          <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                          <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                          <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                          <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                          <th className="pb-2 text-right text-xs font-medium text-gray-500 uppercase">Balance Due</th>
                          <th className="pb-2 text-center text-xs font-medium text-gray-500 uppercase">Days Past Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {bucket.invoices.map(invoice => {
                          const daysPastDue = calculateDaysPastDue(invoice.dueAt, invoice.invoiceAt || invoice.createdAt);
                          return (
                            <tr key={invoice.id} className="hover:bg-gray-100 transition-colors">
                              <td className="py-2 text-sm">
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
                              <td className="py-2 text-sm text-gray-900 font-medium">
                                {invoice.contact?.customer?.companyName || invoice.contact?.fullName || 'Unknown'}
                              </td>
                              <td className="py-2 text-sm text-gray-600">
                                {format(new Date(invoice.invoiceAt || invoice.createdAt), 'MMM d, yyyy')}
                              </td>
                              <td className="py-2 text-sm text-gray-600">
                                {invoice.dueAt ? format(new Date(invoice.dueAt), 'MMM d, yyyy') : '-'}
                              </td>
                              <td className="py-2 text-sm text-red-600 font-semibold text-right">
                                ${(invoice.amountOutstanding || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 text-sm text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  daysPastDue >= 91 ? 'bg-red-100 text-red-800' :
                                  daysPastDue >= 61 ? 'bg-orange-100 text-orange-800' :
                                  daysPastDue >= 31 ? 'bg-yellow-100 text-yellow-800' :
                                  daysPastDue >= 1 ? 'bg-green-100 text-green-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {daysPastDue <= 0 ? 'Not Due' : `${daysPastDue} days`}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
