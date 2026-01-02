import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import { formatCurrency, formatNumber } from '../../utils/analytics-export';

interface InvoicesByStatusReportProps {
  invoices: any[];
  payments: any[];
}

interface StatusData {
  status: string;
  count: number;
  totalAmount: number;
  percentOfTotal: number;
}

export default function InvoicesByStatusReport({ invoices }: InvoicesByStatusReportProps) {
  const reportData = useMemo(() => {
    // Group invoices by status
    const statusMap = new Map<string, { count: number; totalAmount: number }>();
    let grandTotal = 0;

    invoices.forEach(invoice => {
      const status = String(invoice.status || 'Unknown');
      const total = Number(invoice.total) || 0;

      if (!statusMap.has(status)) {
        statusMap.set(status, { count: 0, totalAmount: 0 });
      }

      const statusData = statusMap.get(status)!;
      statusData.count += 1;
      statusData.totalAmount += total;
      grandTotal += total;
    });

    // Convert to array and calculate percentages
    const data: StatusData[] = Array.from(statusMap.entries())
      .map(([status, data]) => ({
        status,
        count: data.count,
        totalAmount: data.totalAmount,
        percentOfTotal: grandTotal > 0 ? (data.totalAmount / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return data;
  }, [invoices]);

  const getStatusColor = (status: string) => {
    const statusLower = String(status).toLowerCase();
    switch (statusLower) {
      case 'paid':
        return 'text-green-600 bg-green-50';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'overdue':
        return 'text-red-600 bg-red-50';
      case 'draft':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <div className="space-y-6">
      {reportData.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-gray-400" />
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-semibold">
                      {formatNumber(item.count)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatCurrency(item.totalAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {item.percentOfTotal.toFixed(1)}%
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
