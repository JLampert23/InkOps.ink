import { useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/analytics-export';

interface RevenueByProductReportProps {
  invoices: any[];
  payments: any[];
}

interface ProductRevenueData {
  productName: string;
  unitsSold: number;
  revenue: number;
  averagePrice: number;
  percentOfTotalRevenue: number;
}

export default function RevenueByProductReport({ invoices }: RevenueByProductReportProps) {
  const reportData = useMemo(() => {
    // TODO: Replace with actual Printavo API v2 call
    // This is placeholder logic for demonstration using filtered invoices
    const mockData: ProductRevenueData[] = [
      { productName: 'Premium T-Shirt', unitsSold: 500, revenue: 12500, averagePrice: 25, percentOfTotalRevenue: 35.7 },
      { productName: 'Cotton Hoodie', unitsSold: 250, revenue: 15000, averagePrice: 60, percentOfTotalRevenue: 42.9 },
      { productName: 'Baseball Cap', unitsSold: 200, revenue: 5000, averagePrice: 25, percentOfTotalRevenue: 14.3 },
    ];

    return mockData;
  }, [invoices]);

  return (
    <div className="space-y-6">
      {reportData.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Units Sold
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Average Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      {item.productName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatNumber(item.unitsSold)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-right">
                      {formatCurrency(item.revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(item.averagePrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {item.percentOfTotalRevenue.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No data available for the selected date range.</p>
        </div>
      )}
    </div>
  );
}
