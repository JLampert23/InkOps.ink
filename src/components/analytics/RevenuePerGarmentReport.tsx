import { useMemo } from 'react';
import { Shirt } from 'lucide-react';

interface RevenuePerGarmentReportProps {
  invoices: any[];
  payments: any[];
  lineItems: any[];
}

interface GarmentRevenueData {
  garmentType: string;
  unitsSold: number;
  revenue: number;
  avgPricePerUnit: number;
  percentOfRevenue: number;
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

export default function RevenuePerGarmentReport({ invoices, lineItems }: RevenuePerGarmentReportProps) {
  const garmentData = useMemo(() => {
    const invoiceIds = new Set(invoices.map(inv => inv.id));
    const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

    const garmentMap = new Map<string, { units: number; revenue: number }>();

    relevantLineItems.forEach(item => {
      const type = extractGarmentType(item.description || '');
      const units = Number(item.quantity) || 0;
      const revenue = Number(item.total_price) || 0;

      const existing = garmentMap.get(type) || { units: 0, revenue: 0 };
      garmentMap.set(type, {
        units: existing.units + units,
        revenue: existing.revenue + revenue
      });
    });

    const totalRevenue = Array.from(garmentMap.values()).reduce((sum, data) => sum + data.revenue, 0);

    const garments: GarmentRevenueData[] = Array.from(garmentMap.entries())
      .map(([type, data]) => ({
        garmentType: type,
        unitsSold: data.units,
        revenue: data.revenue,
        avgPricePerUnit: data.units > 0 ? data.revenue / data.units : 0,
        percentOfRevenue: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return garments;
  }, [invoices, lineItems]);

  const totalRevenue = garmentData.reduce((sum, g) => sum + g.revenue, 0);

  if (garmentData.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <Shirt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Garment Data</h3>
        <p className="text-gray-600">
          No garment revenue data found for the selected date range.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Revenue per Garment Type</h3>
        <div className="text-sm text-gray-500">
          Total Revenue: <span className="font-semibold text-gray-900">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Garment Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Units Sold</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Price/Unit</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {garmentData.map((garment, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {garment.garmentType}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  {garment.unitsSold.toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  ${garment.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  {garment.percentOfRevenue.toFixed(1)}%
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  ${garment.avgPricePerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
