import { useMemo } from 'react';
import { Shirt } from 'lucide-react';

interface TopGarmentCategoriesReportProps {
  invoices: any[];
  payments: any[];
  lineItems: any[];
}

interface GarmentCategoryData {
  category: string;
  quantitySold: number;
  revenue: number;
  percentOfTotal: number;
}

function extractGarmentType(description: string): string {
  const lower = description.toLowerCase();

  if (lower.includes('hoodie') || lower.includes('hooded')) return 'Hoodies';
  if (lower.includes('sweatshirt') || lower.includes('fleece')) return 'Sweatshirts';
  if (lower.includes('t-shirt') || lower.includes('tee') || lower.includes('softstyle')) return 'T-Shirts';
  if (lower.includes('tank')) return 'Tank Tops';
  if (lower.includes('polo')) return 'Polo Shirts';
  if (lower.includes('jacket')) return 'Jackets';
  if (lower.includes('hat') || lower.includes('cap') || lower.includes('beanie')) return 'Headwear';
  if (lower.includes('bag') || lower.includes('tote') || lower.includes('backpack')) return 'Bags';
  if (lower.includes('long sleeve') || lower.includes('longsleeve')) return 'Long Sleeve';
  if (lower.includes('pants') || lower.includes('joggers') || lower.includes('sweatpants')) return 'Bottoms';

  return 'Other';
}

export default function TopGarmentCategoriesReport({ invoices, lineItems }: TopGarmentCategoriesReportProps) {
  const categoryData = useMemo(() => {
    const invoiceIds = new Set(invoices.map(inv => inv.id));
    const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

    const categoryMap = new Map<string, { quantity: number; revenue: number }>();

    relevantLineItems.forEach(item => {
      const category = extractGarmentType(item.description || '');
      const qty = Number(item.quantity) || 0;
      const revenue = Number(item.total_price) || 0;

      const existing = categoryMap.get(category) || { quantity: 0, revenue: 0 };
      categoryMap.set(category, {
        quantity: existing.quantity + qty,
        revenue: existing.revenue + revenue
      });
    });

    const totalQuantity = Array.from(categoryMap.values()).reduce((sum, data) => sum + data.quantity, 0);

    const categories: GarmentCategoryData[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        quantitySold: data.quantity,
        revenue: data.revenue,
        percentOfTotal: totalQuantity > 0 ? (data.quantity / totalQuantity) * 100 : 0
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold);

    return categories;
  }, [invoices, lineItems]);

  if (categoryData.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <Shirt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Garment Data</h3>
        <p className="text-gray-600">
          No garment category data found for the selected date range.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Top-Selling Garment Categories</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity Sold</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Total</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {categoryData.map((category, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {category.category}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                  {category.quantitySold.toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                  ${category.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  {category.percentOfTotal.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
