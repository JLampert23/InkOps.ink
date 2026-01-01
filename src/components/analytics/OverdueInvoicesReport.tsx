import { useState } from 'react';
import { Download, FileText, Calendar, AlertCircle } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatDate } from '../../utils/analytics-export';

interface OverdueInvoicesReportProps {
  invoices: any[];
  payments: any[];
}

interface OverdueInvoiceData {
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
}

export default function OverdueInvoicesReport({ invoices }: OverdueInvoicesReportProps) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState<OverdueInvoiceData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  const generateReport = () => {
    // TODO: Replace with actual Printavo API v2 call
    const today = new Date();
    const mockData: OverdueInvoiceData[] = [
      {
        invoiceNumber: 'INV-001',
        customerName: 'Acme Corp',
        invoiceDate: '2023-11-15',
        dueDate: '2023-12-15',
        totalAmount: 11000,
        amountPaid: 5000,
        balance: 6000,
        daysOverdue: 47,
      },
      {
        invoiceNumber: 'INV-005',
        customerName: 'Retail Plus',
        invoiceDate: '2023-12-01',
        dueDate: '2024-01-01',
        totalAmount: 7500,
        amountPaid: 1000,
        balance: 6500,
        daysOverdue: 30,
      },
    ];

    setReportData(mockData.filter(item => item.balance > 0 && item.daysOverdue > 0));
    setIsGenerated(true);
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: 'overdue-invoices',
      title: 'Overdue Invoices',
      columns: [
        { header: 'Invoice Number', key: 'invoiceNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Invoice Date', key: 'invoiceDate', format: formatDate },
        { header: 'Due Date', key: 'dueDate', format: formatDate },
        { header: 'Total Amount', key: 'totalAmount', format: formatCurrency },
        { header: 'Amount Paid', key: 'amountPaid', format: formatCurrency },
        { header: 'Balance', key: 'balance', format: formatCurrency },
        { header: 'Days Overdue', key: 'daysOverdue' },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} - ${dateRange.end}` : undefined,
    });
  };

  const handleExportPDF = () => {
    const totalOverdue = reportData.reduce((sum, item) => sum + item.balance, 0);
    const avgDaysOverdue = reportData.reduce((sum, item) => sum + item.daysOverdue, 0) / reportData.length;

    exportToPDF({
      filename: 'overdue-invoices',
      title: 'Overdue Invoices',
      columns: [
        { header: 'Invoice', key: 'invoiceNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Invoice Date', key: 'invoiceDate', format: formatDate },
        { header: 'Due Date', key: 'dueDate', format: formatDate },
        { header: 'Total', key: 'totalAmount', format: formatCurrency },
        { header: 'Paid', key: 'amountPaid', format: formatCurrency },
        { header: 'Balance', key: 'balance', format: formatCurrency },
        { header: 'Days Overdue', key: 'daysOverdue' },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `Date Range: ${dateRange.start} - ${dateRange.end}` : undefined,
      summary: [
        { label: 'Total Overdue Amount', value: formatCurrency(totalOverdue) },
        { label: 'Avg Days Overdue', value: avgDaysOverdue.toFixed(0) },
        { label: 'Number of Overdue Invoices', value: reportData.length.toString() },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-red-500" />
          Overdue Invoices
        </h2>
        <p className="text-gray-600">Past due invoice tracking and analysis</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <button
          onClick={generateReport}
          className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Generate Report
        </button>
      </div>

      {isGenerated && reportData.length > 0 && (
        <>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">
              {reportData.length} overdue invoice{reportData.length !== 1 ? 's' : ''} totaling{' '}
              {formatCurrency(reportData.reduce((sum, item) => sum + item.balance, 0))}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-50 border-b border-red-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                      Invoice Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">
                      Paid
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">
                      Days Overdue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((item, index) => (
                    <tr key={index} className="hover:bg-red-50">
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
                        {item.invoiceNumber}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                        {item.customerName}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                        {formatDate(item.invoiceDate)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                        {formatDate(item.dueDate)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-900 text-right">
                        {formatCurrency(item.totalAmount)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-600 text-right">
                        {formatCurrency(item.amountPaid)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-semibold text-red-600 text-right">
                        {formatCurrency(item.balance)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-bold text-red-600 text-right flex items-center justify-end gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {item.daysOverdue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {isGenerated && reportData.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-800">No overdue invoices! All invoices are current.</p>
        </div>
      )}
    </div>
  );
}
