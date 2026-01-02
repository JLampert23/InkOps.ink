import { useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');

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
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return products;
  }, [invoices, lineItems]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return productData.slice(0, 20);
    const filtered = productData.filter(product =>
      product.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return filtered.slice(0, 20);
  }, [productData, searchTerm]);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Top 20 Products by Quantity</h3>
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
            Total: {productData.reduce((sum, p) => sum + p.quantitySold, 0).toLocaleString()}
          </div>
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
            {filteredProducts.map((product) => (
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
