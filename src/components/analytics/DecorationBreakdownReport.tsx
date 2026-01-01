import { useMemo } from 'react';
import { PieChart } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/analytics-export';

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
  const reportData = useMemo(() => {
    // TODO: Replace with actual Printavo API v2 call
    // This is placeholder logic for demonstration using filtered invoices
    const mockData: DecorationData[] = [
      { decorationType: 'Screen Print', orderCount: 45, unitsSold: 1200, revenue: 35000, percentOfRevenue: 45.5 },
      { decorationType: 'Embroidery', orderCount: 30, unitsSold: 600, revenue: 25000, percentOfRevenue: 32.5 },
      { decorationType: 'DTG', orderCount: 20, unitsSold: 400, revenue: 12000, percentOfRevenue: 15.6 },
      { decorationType: 'Heat Transfer', orderCount: 15, unitsSold: 300, revenue: 5000, percentOfRevenue: 6.5 },
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
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No data available for the selected date range.</p>
        </div>
      )}
    </div>
  );
}
