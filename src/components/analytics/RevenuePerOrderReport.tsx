import { useState } from 'react';
import { Download, FileText, Calendar, TrendingUp } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatNumber } from '../../utils/analytics-export';

interface RevenuePerOrderReportProps {
  invoices: any[];
  payments: any[];
}

interface OrderRevenueData {
  orderNumber: string;
  customerName: string;
  orderDate: string;
  itemCount: number;
  revenue: number;
  revenuePerItem: number;
}

export default function RevenuePerOrderReport({ invoices }: RevenuePerOrderReportProps) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState<OrderRevenueData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  const generateReport = () => {
    // TODO: Replace with actual Printavo API v2 call
    const mockData: OrderRevenueData[] = [
      { orderNumber: 'ORD-001', customerName: 'Acme Corp', orderDate: '2024-01-15', itemCount: 500, revenue: 12500, revenuePerItem: 25 },
      { orderNumber: 'ORD-002', customerName: 'Tech Solutions', orderDate: '2024-01-20', itemCount: 250, revenue: 15000, revenuePerItem: 60 },
      { orderNumber: 'ORD-003', customerName: 'Global Inc', orderDate: '2024-01-25', itemCount: 100, revenue: 8000, revenuePerItem: 80 },
    ];

    setReportData(mockData);
    setIsGenerated(true);
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: 'revenue-per-order',
      title: 'Revenue per Order',
      columns: [
        { header: 'Order Number', key: 'orderNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Order Date', key: 'orderDate' },
        { header: 'Item Count', key: 'itemCount', format: formatNumber },
        { header: 'Revenue', key: 'revenue', format: formatCurrency },
        { header: 'Revenue per Item', key: 'revenuePerItem', format: formatCurrency },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} - ${dateRange.end}` : undefined,
    });
  };

  const handleExportPDF = () => {
    const totalRevenue = reportData.reduce((sum, item) => sum + item.revenue, 0);
    const avgRevenue = totalRevenue / reportData.length;
    const totalItems = reportData.reduce((sum, item) => sum + item.itemCount, 0);

    exportToPDF({
      filename: 'revenue-per-order',
      title: 'Revenue per Order',
      columns: [
        { header: 'Order', key: 'orderNumber' },
        { header: 'Customer', key: 'customerName' },
        { header: 'Date', key: 'orderDate' },
        { header: 'Items', key: 'itemCount', format: formatNumber },
        { header: 'Revenue', key: 'revenue', format: formatCurrency },
        { header: 'Per Item', key: 'revenuePerItem', format: formatCurrency },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `Date Range: ${dateRange.start} - ${dateRange.end}` : undefined,
      summary: [
        { label: 'Total Orders', value: formatNumber(reportData.length) },
        { label: 'Total Items', value: formatNumber(totalItems) },
        { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
        { label: 'Average Revenue per Order', value: formatCurrency(avgRevenue) },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Revenue per Order</h2>
        <p className="text-gray-600">Average and total revenue per order</p>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item Count
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue per Item
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {item.orderDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(item.itemCount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-right flex items-center justify-end gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {formatCurrency(item.revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(item.revenuePerItem)}
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
