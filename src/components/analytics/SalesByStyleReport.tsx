import { useMemo } from 'react';
import { formatCurrency, formatNumber } from '../../utils/analytics-export';

interface LineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SalesByStyleReportProps {
  invoices: any[];
  payments: any[];
  lineItems: LineItem[];
}

interface StyleSalesData {
  styleNumber: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  averagePrice: number;
}

export default function SalesByStyleReport({ lineItems }: SalesByStyleReportProps) {
  const reportData = useMemo(() => {
    const productMap = new Map<string, { quantity: number; revenue: number }>();

    lineItems.forEach(item => {
      const description = item.description || 'Unknown Product';
      const quantity = item.quantity || 0;
      const revenue = item.total_price || 0;

      if (!productMap.has(description)) {
        productMap.set(description, { quantity: 0, revenue: 0 });
      }

      const productData = productMap.get(description)!;
      productData.quantity += quantity;
      productData.revenue += revenue;
    });

    const data: StyleSalesData[] = Array.from(productMap.entries())
      .map(([productName, data]) => ({
        styleNumber: productName,
        productName,
        quantitySold: data.quantity,
        totalRevenue: data.revenue,
        averagePrice: data.quantity > 0 ? data.revenue / data.quantity : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 25);

    return data;
  }, [lineItems]);

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
                    Quantity Sold
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Price
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.productName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatNumber(item.quantitySold)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
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
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No product data available for the selected date range.</p>
        </div>
      )}
    </div>
  );
}
