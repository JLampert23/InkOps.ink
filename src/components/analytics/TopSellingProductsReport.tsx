import { useState } from 'react';
import { Download, FileText, Calendar, TrendingUp } from 'lucide-react';
import { exportToCSV, exportToPDF, formatNumber } from '../../utils/analytics-export';

interface TopSellingProductsReportProps {
  invoices: any[];
  payments: any[];
}

interface ProductData {
  rank: number;
  productName: string;
  quantitySold: number;
  percentOfTotal: number;
}

export default function TopSellingProductsReport({ invoices }: TopSellingProductsReportProps) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState<ProductData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [limit, setLimit] = useState(10);

  const generateReport = () => {
    // TODO: Replace with actual Printavo API v2 call
    const mockData: ProductData[] = [
      { rank: 1, productName: 'Premium T-Shirt', quantitySold: 500, percentOfTotal: 35.7 },
      { rank: 2, productName: 'Cotton Hoodie', quantitySold: 250, percentOfTotal: 17.9 },
      { rank: 3, productName: 'Baseball Cap', quantitySold: 200, percentOfTotal: 14.3 },
    ];

    setReportData(mockData.slice(0, limit));
    setIsGenerated(true);
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: 'top-selling-products',
      title: 'Top-Selling Products',
      columns: [
        { header: 'Rank', key: 'rank' },
        { header: 'Product Name', key: 'productName' },
        { header: 'Quantity Sold', key: 'quantitySold', format: formatNumber },
        { header: '% of Total', key: 'percentOfTotal', format: (v) => `${v.toFixed(1)}%` },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} - ${dateRange.end}` : undefined,
    });
  };

  const handleExportPDF = () => {
    const totalQuantity = reportData.reduce((sum, item) => sum + item.quantitySold, 0);

    exportToPDF({
      filename: 'top-selling-products',
      title: 'Top-Selling Products',
      columns: [
        { header: 'Rank', key: 'rank' },
        { header: 'Product Name', key: 'productName' },
        { header: 'Quantity Sold', key: 'quantitySold', format: formatNumber },
        { header: '% of Total', key: 'percentOfTotal', format: (v) => `${v.toFixed(1)}%` },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `Date Range: ${dateRange.start} - ${dateRange.end}` : undefined,
      summary: [
        { label: 'Total Units in Top Products', value: formatNumber(totalQuantity) },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Top-Selling Products</h2>
        <p className="text-gray-600">Best performing products by quantity sold</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Top N Products
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
            </select>
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
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity Sold
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.rank}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.productName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(item.quantitySold)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {item.percentOfTotal.toFixed(1)}%
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
