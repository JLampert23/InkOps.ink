import { useMemo } from 'react';
import { formatNumber } from '../../utils/analytics-export';

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
  const reportData = useMemo(() => {
    // TODO: Replace with actual Printavo API v2 call
    // This is placeholder logic for demonstration using filtered invoices
    const mockData: ProductData[] = [
      { rank: 1, productName: 'Premium T-Shirt', quantitySold: 500, percentOfTotal: 35.7 },
      { rank: 2, productName: 'Cotton Hoodie', quantitySold: 250, percentOfTotal: 17.9 },
      { rank: 3, productName: 'Baseball Cap', quantitySold: 200, percentOfTotal: 14.3 },
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
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No data available for the selected date range.</p>
        </div>
      )}
    </div>
  );
}
