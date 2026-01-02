import { useMemo, useState } from 'react';
import { DollarSign, Search } from 'lucide-react';

interface RevenueByProductReportProps {
  invoices: any[];
  payments: any[];
  lineItems: any[];
}

interface ProductRevenueData {
  productName: string;
  unitsSold: number;
  revenue: number;
  averagePrice: number;
  percentOfTotalRevenue: number;
}

export default function RevenueByProductReport({ invoices, lineItems }: RevenueByProductReportProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const productData = useMemo(() => {
    const invoiceIds = new Set(invoices.map(inv => inv.id));
    const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

    const productMap = new Map<string, { revenue: number; units: number }>();

    relevantLineItems.forEach(item => {
      const name = item.description || 'Unknown Product';
      const revenue = Number(item.total_price) || 0;
      const units = Number(item.quantity) || 0;

      const existing = productMap.get(name) || { revenue: 0, units: 0 };
      productMap.set(name, {
        revenue: existing.revenue + revenue,
        units: existing.units + units
      });
    });

    const totalRevenue = Array.from(productMap.values()).reduce((sum, data) => sum + data.revenue, 0);

    const products: ProductRevenueData[] = Array.from(productMap.entries())
      .map(([name, data]) => ({
        productName: name,
        revenue: data.revenue,
        unitsSold: data.units,
        averagePrice: data.units > 0 ? data.revenue / data.units : 0,
        percentOfTotalRevenue: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return products;
  }, [invoices, lineItems]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return productData;
    return productData.filter(product =>
      product.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [productData, searchTerm]);

  const totalRevenue = productData.reduce((sum, p) => sum + p.revenue, 0);

  if (productData.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Product Data</h3>
        <p className="text-gray-600">
          No product revenue data found for the selected date range.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Revenue by Product</h3>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 md:flex-none md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
            />
          </div>
          <div className="text-sm text-gray-500 whitespace-nowrap">
            Total: <span className="font-semibold text-gray-900">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Units Sold</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Total</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Price</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.map((product, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {product.productName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  {product.unitsSold.toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  ${product.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  {product.percentOfTotalRevenue.toFixed(1)}%
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  ${product.averagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
