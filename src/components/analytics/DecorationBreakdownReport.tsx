import { useMemo } from 'react';
import { PieChart } from 'lucide-react';

interface DecorationBreakdownReportProps {
  invoices: any[];
  payments: any[];
  lineItems: any[];
}

interface DecorationData {
  decorationType: string;
  orderCount: number;
  unitsSold: number;
  revenue: number;
  percentOfRevenue: number;
}

function extractDecorationType(description: string): string {
  const lower = description.toLowerCase();

  if (lower.includes('screen print') || lower.includes('screenprint')) return 'Screen Print';
  if (lower.includes('embroid')) return 'Embroidery';
  if (lower.includes('dtg') || lower.includes('direct to garment')) return 'DTG';
  if (lower.includes('heat transfer') || lower.includes('vinyl')) return 'Heat Transfer';
  if (lower.includes('sublimation') || lower.includes('dye sub')) return 'Sublimation';
  if (lower.includes('patch')) return 'Patches';
  if (lower.includes('printing') || lower.includes('print')) return 'Printing';

  return 'Other/Garment';
}

export default function DecorationBreakdownReport({ invoices, lineItems }: DecorationBreakdownReportProps) {
  const decorationData = useMemo(() => {
    const invoiceIds = new Set(invoices.map(inv => inv.id));
    const relevantLineItems = lineItems.filter(item => invoiceIds.has(item.invoice_id));

    const decorationMap = new Map<string, { orders: Set<string>; units: number; revenue: number }>();

    relevantLineItems.forEach(item => {
      const type = extractDecorationType(item.description || '');
      const units = Number(item.quantity) || 0;
      const revenue = Number(item.total_price) || 0;

      if (!decorationMap.has(type)) {
        decorationMap.set(type, { orders: new Set(), units: 0, revenue: 0 });
      }

      const existing = decorationMap.get(type)!;
      existing.orders.add(item.invoice_id);
      existing.units += units;
      existing.revenue += revenue;
    });

    const totalRevenue = Array.from(decorationMap.values()).reduce((sum, data) => sum + data.revenue, 0);

    const decorations: DecorationData[] = Array.from(decorationMap.entries())
      .map(([type, data]) => ({
        decorationType: type,
        orderCount: data.orders.size,
        unitsSold: data.units,
        revenue: data.revenue,
        percentOfRevenue: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return decorations;
  }, [invoices, lineItems]);

  if (decorationData.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <PieChart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Decoration Data</h3>
        <p className="text-gray-600">
          No decoration breakdown data found for the selected date range.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Decoration Type Breakdown</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decoration Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Units</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">% of Revenue</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {decorationData.map((decoration, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {decoration.decorationType}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  {decoration.orderCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  {decoration.unitsSold.toLocaleString()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  ${decoration.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  {decoration.percentOfRevenue.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
