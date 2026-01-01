import { useState } from 'react';
import { Download, FileText, Calendar } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, formatNumber } from '../../utils/analytics-export';

interface SalesByStyleReportProps {
  invoices: any[];
  payments: any[];
}

interface StyleSalesData {
  styleNumber: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  averagePrice: number;
}

export default function SalesByStyleReport({ invoices }: SalesByStyleReportProps) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [reportData, setReportData] = useState<StyleSalesData[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  const generateReport = () => {
    // TODO: Replace with actual Printavo API v2 call
    // This is placeholder logic for demonstration
    const mockData: StyleSalesData[] = [
      {
        styleNumber: 'STYLE-001',
        productName: 'Premium T-Shirt',
        quantitySold: 500,
        totalRevenue: 12500,
        averagePrice: 25,
      },
      {
        styleNumber: 'STYLE-002',
        productName: 'Cotton Hoodie',
        quantitySold: 250,
        totalRevenue: 15000,
        averagePrice: 60,
      },
    ];

    setReportData(mockData);
    setIsGenerated(true);
  };

  const handleExportCSV = () => {
    exportToCSV({
      filename: 'sales-by-style',
      title: 'Sales by Style Number',
      columns: [
        { header: 'Style Number', key: 'styleNumber' },
        { header: 'Product Name', key: 'productName' },
        { header: 'Quantity Sold', key: 'quantitySold', format: formatNumber },
        { header: 'Total Revenue', key: 'totalRevenue', format: formatCurrency },
        { header: 'Average Price', key: 'averagePrice', format: formatCurrency },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `${dateRange.start} - ${dateRange.end}` : undefined,
    });
  };

  const handleExportPDF = () => {
    const totalRevenue = reportData.reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalQuantity = reportData.reduce((sum, item) => sum + item.quantitySold, 0);

    exportToPDF({
      filename: 'sales-by-style',
      title: 'Sales by Style Number',
      columns: [
        { header: 'Style Number', key: 'styleNumber' },
        { header: 'Product Name', key: 'productName' },
        { header: 'Quantity Sold', key: 'quantitySold', format: formatNumber },
        { header: 'Total Revenue', key: 'totalRevenue', format: formatCurrency },
        { header: 'Average Price', key: 'averagePrice', format: formatCurrency },
      ],
      data: reportData,
      dateRange: dateRange.start && dateRange.end ? `Date Range: ${dateRange.start} - ${dateRange.end}` : undefined,
      summary: [
        { label: 'Total Units Sold', value: formatNumber(totalQuantity) },
        { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sales by Style Number</h2>
        <p className="text-gray-600">Analyze sales performance by product style</p>
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
                      Style Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity Sold
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Revenue
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Average Price
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.styleNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.productName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatNumber(item.quantitySold)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(item.totalRevenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatCurrency(item.averagePrice)}
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
