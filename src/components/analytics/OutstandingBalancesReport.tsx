import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/analytics-export';

interface OutstandingBalancesReportProps {
  invoices: any[];
  payments: any[];
}

interface OutstandingBalanceData {
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  daysOutstanding: number;
}

export default function OutstandingBalancesReport({ invoices }: OutstandingBalancesReportProps) {
  const reportData = useMemo(() => {
    // TODO: Replace with actual Printavo API v2 call
    // This is placeholder logic for demonstration using filtered invoices
    const mockData: OutstandingBalanceData[] = [
      {
        invoiceNumber: 'INV-001',
        customerName: 'Acme Corp',
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        totalAmount: 11000,
        amountPaid: 5000,
        balance: 6000,
        daysOutstanding: 15,
      },
      {
        invoiceNumber: 'INV-003',
        customerName: 'Global Industries',
        invoiceDate: '2024-01-20',
        dueDate: '2024-02-20',
        totalAmount: 8500,
        amountPaid: 2000,
        balance: 6500,
        daysOutstanding: 10,
      },
    ];

    return mockData.filter(item => item.balance > 0);
  }, [invoices]);

  return (
    <div className="space-y-6">
      {reportData.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Days
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
                      {item.invoiceNumber}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-900">
                      {item.customerName}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                      {formatDate(item.invoiceDate)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                      {formatDate(item.dueDate)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-900 text-right">
                      {formatCurrency(item.totalAmount)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-green-600 text-right">
                      {formatCurrency(item.amountPaid)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap font-semibold text-red-600 text-right">
                      {formatCurrency(item.balance)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-600 text-right flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" />
                      {item.daysOutstanding}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-800">No outstanding balances! All invoices are paid in full.</p>
        </div>
      )}
    </div>
  );
}
