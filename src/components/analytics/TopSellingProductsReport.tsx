import { useMemo } from 'react';
import { Package } from 'lucide-react';

interface TopSellingProductsReportProps {
  invoices: any[];
  payments: any[];
  lineItems: any[];
}

interface ProductData {
  rank: number;
  productName: string;
  quantitySold: number;
  percentOfTotal: number;
}

export default function TopSellingProductsReport({ invoices, lineItems }: TopSellingProductsReportProps) {
  const productData = useMemo(() => {
    const invoiceIds = new Set(invoices.map(inv => inv.id));
    const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

    const productMap = new Map<string, number>();

    relevantLineItems.forEach(item => {
      const name = item.description || 'Unknown Product';
      const qty = Number(item.quantity) || 0;
      productMap.set(name, (productMap.get(name) || 0) + qty);
    });

    const totalQuantity = Array.from(productMap.values()).reduce((sum, qty) => sum + qty, 0);

    const products: ProductData[] = Array.from(productMap.entries())
      .map(([name, qty]) => ({
        rank: 0,
        productName: name,
        quantitySold: qty,
        percentOfTotal: totalQuantity > 0 ? (qty / totalQuantity) * 100 : 0
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 20)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return products;
  }, [invoices, lineItems]);

  if (productData.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Product Data</h3>
        <p className="text-gray-600">
          No product line items found for the selected date range.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Top 20 Products by Quantity</h3>
        <div className="text-sm text-gray-500">
          Total items: {productData.reduce((sum, p) => sum + p.quantitySold, 0).toLocaleString()}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Sold</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {productData.map((product) => (
              <tr key={product.rank} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{product.rank}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {product.productName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  {product.quantitySold.toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  {product.percentOfTotal.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
