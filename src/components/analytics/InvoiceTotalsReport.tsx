import { useState } from 'react';
import { Download, FileText, Calendar } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency } from '../../utils/analytics-export';

interface InvoiceTotalsReportProps {
  invoices: any[];
  payments: any[];
}

interface InvoiceTotalsData {
  invoiceNumber: string;
  customerName: string;
  subtotal: number;
  tax: number;
  fees: number;
  total: number;
  amountPaid: number;
  balance: number;
}

export default function InvoiceTotalsReport({ invoices }: InvoiceTotalsReportProps) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState<InvoiceTotalsData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  const generateReport = () => {
    // TODO: Replace with actual Printavo API v2 call
    const mockData: InvoiceTotalsData[] = [
      {
        invoiceNumber: 'INV-001',
        customerName: 'Acme Corp',
        subtotal: 10000,
        tax: 800,
        fees: 200,
        total: 11000,
        amountPaid: 5000,
        balance: 6000,
      },
      {
        invoiceNumber: 'INV-002',
        customerName: 'Tech Solutions',
        subtotal: 5000,
        tax: 400,
        fees: 100,
        total: 5500,
        amountPaid: 5500,
        balance: 0,
      },
    ];

    setReportData(mockData);
    setIsGenerated(true);
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: 'invoice-totals',
      title: 'Invoice Totals, Subtotals, Taxes & Fees',
      columns: [
        { header: 'Invoice Number', key: 'invoiceNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Subtotal', key: 'subtotal', format: formatCurrency },
        { header: 'Tax', key: 'tax', format: formatCurrency },
        { header: 'Fees', key: 'fees', format: formatCurrency },
        { header: 'Total', key: 'total', format: formatCurrency },
        { header: 'Amount Paid', key: 'amountPaid', format: formatCurrency },
        { header: 'Balance', key: 'balance', format: formatCurrency },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} - ${dateRange.end}` : undefined,
    });
  };

  const handleExportPDF = () => {
    const totalSubtotal = reportData.reduce((sum, item) => sum + item.subtotal, 0);
    const totalTax = reportData.reduce((sum, item) => sum + item.tax, 0);
    const totalFees = reportData.reduce((sum, item) => sum + item.fees, 0);
    const totalAmount = reportData.reduce((sum, item) => sum + item.total, 0);
    const totalPaid = reportData.reduce((sum, item) => sum + item.amountPaid, 0);
    const totalBalance = reportData.reduce((sum, item) => sum + item.balance, 0);

    exportToPDF({
      filename: 'invoice-totals',
      title: 'Invoice Totals, Subtotals, Taxes & Fees',
      columns: [
        { header: 'Invoice', key: 'invoiceNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Subtotal', key: 'subtotal', format: formatCurrency },
        { header: 'Tax', key: 'tax', format: formatCurrency },
        { header: 'Fees', key: 'fees', format: formatCurrency },
        { header: 'Total', key: 'total', format: formatCurrency },
        { header: 'Paid', key: 'amountPaid', format: formatCurrency },
        { header: 'Balance', key: 'balance', format: formatCurrency },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `Date Range: ${dateRange.start} - ${dateRange.end}` : undefined,
      summary: [
        { label: 'Total Subtotal', value: formatCurrency(totalSubtotal) },
        { label: 'Total Tax', value: formatCurrency(totalTax) },
        { label: 'Total Fees', value: formatCurrency(totalFees) },
        { label: 'Grand Total', value: formatCurrency(totalAmount) },
        { label: 'Total Paid', value: formatCurrency(totalPaid) },
        { label: 'Total Balance', value: formatCurrency(totalBalance) },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Totals, Subtotals, Taxes & Fees</h2>
        <p className="text-gray-600">Complete financial breakdown of all invoices</p>
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subtotal
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tax
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fees
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
                      <td className="px-4 py-4 whitespace-nowrap text-gray-900 text-right">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-900 text-right">
                        {formatCurrency(item.tax)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-gray-900 text-right">
                        {formatCurrency(item.fees)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-semibold text-gray-900 text-right">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-green-600 text-right">
                        {formatCurrency(item.amountPaid)}
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap text-right font-medium ${item.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(item.balance)}
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No data available for the selected date range.</p>
        </div>
      )}
    </div>
  );
}
