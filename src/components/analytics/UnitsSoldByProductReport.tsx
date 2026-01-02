import { useMemo } from 'react';
import { Package } from 'lucide-react';

interface UnitsSoldByProductReportProps {
  invoices: any[];
  payments: any[];
  lineItems: any[];
}

interface ProductUnitsData {
  productName: string;
  unitsSold: number;
  percentOfTotal: number;
}

export default function UnitsSoldByProductReport({ invoices, lineItems }: UnitsSoldByProductReportProps) {
  const productData = useMemo(() => {
    const invoiceIds = new Set(invoices.map(inv => inv.id));
    const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

    const productMap = new Map<string, number>();

    relevantLineItems.forEach(item => {
      const name = item.description || 'Unknown Product';
      const qty = Number(item.quantity) || 0;
      productMap.set(name, (productMap.get(name) || 0) + qty);
    });

    const totalUnits = Array.from(productMap.values()).reduce((sum, qty) => sum + qty, 0);

    const products: ProductUnitsData[] = Array.from(productMap.entries())
      .map(([name, units]) => ({
        productName: name,
        unitsSold: units,
        percentOfTotal: totalUnits > 0 ? (units / totalUnits) * 100 : 0
      }))
      .sort((a, b) => b.unitsSold - a.unitsSold);

    return products;
  }, [invoices, lineItems]);

  const totalUnits = productData.reduce((sum, p) => sum + p.unitsSold, 0);

  if (productData.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Product Data</h3>
        <p className="text-gray-600">
          No product sales data found for the selected date range.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Units Sold by Product</h3>
        <div className="text-sm text-gray-500">
          Total Units: <span className="font-semibold text-gray-900">{totalUnits.toLocaleString()}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Units Sold</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {productData.map((product, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {product.productName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  {product.unitsSold.toLocaleString()}
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
