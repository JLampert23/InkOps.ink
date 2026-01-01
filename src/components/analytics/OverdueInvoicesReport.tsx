import { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/analytics-export';

interface OverdueInvoicesReportProps {
  invoices: any[];
  payments: any[];
}

interface OverdueInvoiceData {
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  daysOverdue: number;
}

export default function OverdueInvoicesReport({ invoices }: OverdueInvoicesReportProps) {
  const reportData = useMemo(() => {
    // TODO: Replace with actual Printavo API v2 call
    // This is placeholder logic for demonstration using filtered invoices
    const mockData: OverdueInvoiceData[] = [
      {
        invoiceNumber: 'INV-001',
        customerName: 'Acme Corp',
        invoiceDate: '2023-11-15',
        dueDate: '2023-12-15',
        totalAmount: 11000,
        amountPaid: 5000,
        balance: 6000,
        daysOverdue: 47,
      },
      {
        invoiceNumber: 'INV-005',
        customerName: 'Retail Plus',
        invoiceDate: '2023-12-01',
        dueDate: '2024-01-01',
        totalAmount: 7500,
        amountPaid: 1000,
        balance: 6500,
        daysOverdue: 30,
      },
    ];

    return mockData.filter(item => item.balance > 0 && item.daysOverdue > 0);
  }, [invoices]);

  return (
    <div className="space-y-6">
      {reportData.length > 0 ? (
        <>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium">
              {reportData.length} overdue invoice{reportData.length !== 1 ? 's' : ''} totaling{' '}
              {formatCurrency(reportData.reduce((sum, item) => sum + item.balance, 0))}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-50 border-b border-red-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                      Invoice Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">
                      Paid
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-red-700 uppercase tracking-wider">
                      Days Overdue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((item, index) => (
                    <tr key={index} className="hover:bg-red-50">
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
                      <td className="px-4 py-4 whitespace-nowrap text-gray-600 text-right">
                        {formatCurrency(item.amountPaid)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-semibold text-red-600 text-right">
                        {formatCurrency(item.balance)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-bold text-red-600 text-right flex items-center justify-end gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {item.daysOverdue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <p className="text-green-800">No overdue invoices! All invoices are current.</p>
        </div>
      )}
    </div>
  );
}
