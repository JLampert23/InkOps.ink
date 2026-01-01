import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/analytics-export';

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
  const reportData = useMemo(() => {
    // TODO: Replace with actual Printavo API v2 call
    // This is placeholder logic for demonstration using filtered invoices
    const mockData: OrderRevenueData[] = [
      { orderNumber: 'ORD-001', customerName: 'Acme Corp', orderDate: '2024-01-15', itemCount: 500, revenue: 12500, revenuePerItem: 25 },
      { orderNumber: 'ORD-002', customerName: 'Tech Solutions', orderDate: '2024-01-20', itemCount: 250, revenue: 15000, revenuePerItem: 60 },
      { orderNumber: 'ORD-003', customerName: 'Global Inc', orderDate: '2024-01-25', itemCount: 100, revenue: 8000, revenuePerItem: 80 },
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
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No data available for the selected date range.</p>
        </div>
      )}
    </div>
  );
}
