import { useState } from 'react';
import { Download, FileText, Calendar, PieChart } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatNumber } from '../../utils/analytics-export';

interface DecorationBreakdownReportProps {
  invoices: any[];
  payments: any[];
}

interface DecorationData {
  decorationType: string;
  orderCount: number;
  unitsSold: number;
  revenue: number;
  percentOfRevenue: number;
}

export default function DecorationBreakdownReport({ invoices }: DecorationBreakdownReportProps) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState<DecorationData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  const generateReport = () => {
    // TODO: Replace with actual Printavo API v2 call
    const mockData: DecorationData[] = [
      { decorationType: 'Screen Print', orderCount: 45, unitsSold: 1200, revenue: 35000, percentOfRevenue: 45.5 },
      { decorationType: 'Embroidery', orderCount: 30, unitsSold: 600, revenue: 25000, percentOfRevenue: 32.5 },
      { decorationType: 'DTG', orderCount: 20, unitsSold: 400, revenue: 12000, percentOfRevenue: 15.6 },
      { decorationType: 'Heat Transfer', orderCount: 15, unitsSold: 300, revenue: 5000, percentOfRevenue: 6.5 },
    ];

    setReportData(mockData);
    setIsGenerated(true);
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: 'decoration-breakdown',
      title: 'Decoration Type Breakdown',
      columns: [
        { header: 'Decoration Type', key: 'decorationType' },
        { header: 'Order Count', key: 'orderCount', format: formatNumber },
        { header: 'Units Sold', key: 'unitsSold', format: formatNumber },
        { header: 'Revenue', key: 'revenue', format: formatCurrency },
        { header: '% of Revenue', key: 'percentOfRevenue', format: (v) => `${v.toFixed(1)}%` },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} - ${dateRange.end}` : undefined,
    });
  };

  const handleExportPDF = () => {
    const totalOrders = reportData.reduce((sum, item) => sum + item.orderCount, 0);
    const totalUnits = reportData.reduce((sum, item) => sum + item.unitsSold, 0);
    const totalRevenue = reportData.reduce((sum, item) => sum + item.revenue, 0);

    exportToPDF({
      filename: 'decoration-breakdown',
      title: 'Decoration Type Breakdown',
      columns: [
        { header: 'Decoration Type', key: 'decorationType' },
        { header: 'Orders', key: 'orderCount', format: formatNumber },
        { header: 'Units', key: 'unitsSold', format: formatNumber },
        { header: 'Revenue', key: 'revenue', format: formatCurrency },
        { header: '% of Revenue', key: 'percentOfRevenue', format: (v) => `${v.toFixed(1)}%` },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `Date Range: ${dateRange.start} - ${dateRange.end}` : undefined,
      summary: [
        { label: 'Total Orders', value: formatNumber(totalOrders) },
        { label: 'Total Units', value: formatNumber(totalUnits) },
        { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Decoration Type Breakdown</h2>
        <p className="text-gray-600">Revenue by decoration method</p>
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
                      Decoration Type
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order Count
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Units Sold
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      % of Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-blue-500" />
                        {item.decorationType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(item.orderCount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(item.unitsSold)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-right">
                        {formatCurrency(item.revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {item.percentOfRevenue.toFixed(1)}%
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
