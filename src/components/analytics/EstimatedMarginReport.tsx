import { useState } from 'react';
import { Download, FileText, Calendar, Target } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatPercent } from '../../utils/analytics-export';

interface EstimatedMarginReportProps {
  invoices: any[];
  payments: any[];
}

interface MarginData {
  orderNumber: string;
  customerName: string;
  revenue: number;
  estimatedCost: number;
  estimatedProfit: number;
  marginPercent: number;
}

export default function EstimatedMarginReport({ invoices }: EstimatedMarginReportProps) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState<MarginData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  const generateReport = () => {
    // TODO: Replace with actual Printavo API v2 call
    const mockData: MarginData[] = [
      { orderNumber: 'ORD-001', customerName: 'Acme Corp', revenue: 12500, estimatedCost: 7500, estimatedProfit: 5000, marginPercent: 40.0 },
      { orderNumber: 'ORD-002', customerName: 'Tech Solutions', revenue: 15000, estimatedCost: 9000, estimatedProfit: 6000, marginPercent: 40.0 },
      { orderNumber: 'ORD-003', customerName: 'Global Inc', revenue: 8000, estimatedCost: 5600, estimatedProfit: 2400, marginPercent: 30.0 },
    ];

    setReportData(mockData);
    setIsGenerated(true);
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: 'estimated-margin-per-order',
      title: 'Estimated Margin per Order',
      columns: [
        { header: 'Order Number', key: 'orderNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Revenue', key: 'revenue', format: formatCurrency },
        { header: 'Estimated Cost', key: 'estimatedCost', format: formatCurrency },
        { header: 'Estimated Profit', key: 'estimatedProfit', format: formatCurrency },
        { header: 'Margin %', key: 'marginPercent', format: formatPercent },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} - ${dateRange.end}` : undefined,
    });
  };

  const handleExportPDF = () => {
    const totalRevenue = reportData.reduce((sum, item) => sum + item.revenue, 0);
    const totalCost = reportData.reduce((sum, item) => sum + item.estimatedCost, 0);
    const totalProfit = reportData.reduce((sum, item) => sum + item.estimatedProfit, 0);
    const avgMargin = (totalProfit / totalRevenue) * 100;

    exportToPDF({
      filename: 'estimated-margin-per-order',
      title: 'Estimated Margin per Order',
      columns: [
        { header: 'Order', key: 'orderNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Revenue', key: 'revenue', format: formatCurrency },
        { header: 'Cost', key: 'estimatedCost', format: formatCurrency },
        { header: 'Profit', key: 'estimatedProfit', format: formatCurrency },
        { header: 'Margin %', key: 'marginPercent', format: formatPercent },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `Date Range: ${dateRange.start} - ${dateRange.end}` : undefined,
      summary: [
        { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
        { label: 'Total Cost', value: formatCurrency(totalCost) },
        { label: 'Total Profit', value: formatCurrency(totalProfit) },
        { label: 'Average Margin', value: formatPercent(avgMargin) },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Estimated Margin per Order</h2>
        <p className="text-gray-600">Profit margin analysis for orders</p>
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
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Est. Cost
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Est. Profit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Margin %
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.orderNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.customerName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(item.revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">
                        {formatCurrency(item.estimatedCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-right">
                        {formatCurrency(item.estimatedProfit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600 text-right flex items-center justify-end gap-1">
                        <Target className="w-3 h-3" />
                        {formatPercent(item.marginPercent)}
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
