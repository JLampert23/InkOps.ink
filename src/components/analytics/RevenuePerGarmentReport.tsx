import { useMemo } from 'react';
import { Shirt } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/analytics-export';

interface RevenuePerGarmentReportProps {
  invoices: any[];
  payments: any[];
}

interface GarmentRevenueData {
  garmentType: string;
  unitsSold: number;
  revenue: number;
  avgPricePerUnit: number;
  percentOfRevenue: number;
}

export default function RevenuePerGarmentReport({ invoices }: RevenuePerGarmentReportProps) {
  const reportData = useMemo(() => {
    // TODO: Replace with actual Printavo API v2 call
    // This is placeholder logic for demonstration using filtered invoices
    const mockData: GarmentRevenueData[] = [
      { garmentType: 'T-Shirts', unitsSold: 1200, revenue: 30000, avgPricePerUnit: 25, percentOfRevenue: 42.9 },
      { garmentType: 'Hoodies', unitsSold: 400, revenue: 24000, avgPricePerUnit: 60, percentOfRevenue: 34.3 },
      { garmentType: 'Polo Shirts', unitsSold: 300, revenue: 9000, avgPricePerUnit: 30, percentOfRevenue: 12.9 },
      { garmentType: 'Caps', unitsSold: 400, revenue: 7000, avgPricePerUnit: 17.5, percentOfRevenue: 10.0 },
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
                    Garment Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Units Sold
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Price per Unit
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
                      <Shirt className="w-4 h-4 text-blue-500" />
                      {item.garmentType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatNumber(item.unitsSold)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 text-right">
                      {formatCurrency(item.revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(item.avgPricePerUnit)}
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
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No data available for the selected date range.</p>
        </div>
      )}
    </div>
  );
}
