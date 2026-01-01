import { useMemo } from 'react';
import { Target } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../utils/analytics-export';

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
  const reportData = useMemo(() => {
    // TODO: Replace with actual Printavo API v2 call
    // This is placeholder logic for demonstration using filtered invoices
    const mockData: MarginData[] = [
      { orderNumber: 'ORD-001', customerName: 'Acme Corp', revenue: 12500, estimatedCost: 7500, estimatedProfit: 5000, marginPercent: 40.0 },
      { orderNumber: 'ORD-002', customerName: 'Tech Solutions', revenue: 15000, estimatedCost: 9000, estimatedProfit: 6000, marginPercent: 40.0 },
      { orderNumber: 'ORD-003', customerName: 'Global Inc', revenue: 8000, estimatedCost: 5600, estimatedProfit: 2400, marginPercent: 30.0 },
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
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No data available for the selected date range.</p>
        </div>
      )}
    </div>
  );
}
