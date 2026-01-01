import { useState } from 'react';
import { Download, FileText, Calendar, Clock } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatDate } from '../../utils/analytics-export';

interface OutstandingBalancesReportProps {
  invoices: any[];
  payments: any[];
}

interface OutstandingBalanceData {
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  daysOutstanding: number;
}

export default function OutstandingBalancesReport({ invoices }: OutstandingBalancesReportProps) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState<OutstandingBalanceData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  const generateReport = () => {
    // TODO: Replace with actual Printavo API v2 call
    const mockData: OutstandingBalanceData[] = [
      {
        invoiceNumber: 'INV-001',
        customerName: 'Acme Corp',
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        totalAmount: 11000,
        amountPaid: 5000,
        balance: 6000,
        daysOutstanding: 15,
      },
      {
        invoiceNumber: 'INV-003',
        customerName: 'Global Industries',
        invoiceDate: '2024-01-20',
        dueDate: '2024-02-20',
        totalAmount: 8500,
        amountPaid: 2000,
        balance: 6500,
        daysOutstanding: 10,
      },
    ];

    setReportData(mockData.filter(item => item.balance > 0));
    setIsGenerated(true);
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: 'outstanding-balances',
      title: 'Outstanding Balances',
      columns: [
        { header: 'Invoice Number', key: 'invoiceNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Invoice Date', key: 'invoiceDate', format: formatDate },
        { header: 'Due Date', key: 'dueDate', format: formatDate },
        { header: 'Total Amount', key: 'totalAmount', format: formatCurrency },
        { header: 'Amount Paid', key: 'amountPaid', format: formatCurrency },
        { header: 'Balance', key: 'balance', format: formatCurrency },
        { header: 'Days Outstanding', key: 'daysOutstanding' },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} - ${dateRange.end}` : undefined,
    });
  };

  const handleExportPDF = () => {
    const totalOutstanding = reportData.reduce((sum, item) => sum + item.balance, 0);
    const avgDaysOutstanding = reportData.reduce((sum, item) => sum + item.daysOutstanding, 0) / reportData.length;

    exportToPDF({
      filename: 'outstanding-balances',
      title: 'Outstanding Balances',
      columns: [
        { header: 'Invoice', key: 'invoiceNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Invoice Date', key: 'invoiceDate', format: formatDate },
        { header: 'Due Date', key: 'dueDate', format: formatDate },
        { header: 'Total', key: 'totalAmount', format: formatCurrency },
        { header: 'Paid', key: 'amountPaid', format: formatCurrency },
        { header: 'Balance', key: 'balance', format: formatCurrency },
        { header: 'Days', key: 'daysOutstanding' },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `Date Range: ${dateRange.start} - ${dateRange.end}` : undefined,
      summary: [
        { label: 'Total Outstanding', value: formatCurrency(totalOutstanding) },
        { label: 'Avg Days Outstanding', value: avgDaysOutstanding.toFixed(0) },
        { label: 'Number of Invoices', value: reportData.length.toString() },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Outstanding Balances</h2>
        <p className="text-gray-600">All unpaid invoice balances</p>
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
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Paid
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
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
                      <td className="px-4 py-4 whitespace-nowrap text-green-600 text-right">
                        {formatCurrency(item.amountPaid)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-semibold text-red-600 text-right">
                        {formatCurrency(item.balance)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-600 text-right flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {item.daysOutstanding}
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
          <p className="text-green-800">No outstanding balances! All invoices are paid in full.</p>
        </div>
      )}
    </div>
  );
}
