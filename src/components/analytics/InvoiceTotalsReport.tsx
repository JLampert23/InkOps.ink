import { useMemo } from 'react';
import { formatCurrency } from '../../utils/analytics-export';

interface InvoiceTotalsReportProps {
  invoices: any[];
  payments: any[];
}

interface InvoiceTotalsData {
  invoiceNumber: string;
  customerName: string;
  subtotal: number;
  tax: number;
  fees: number;
  total: number;
  amountPaid: number;
  balance: number;
}

export default function InvoiceTotalsReport({ invoices }: InvoiceTotalsReportProps) {
  const reportData = useMemo(() => {
    // TODO: Replace with actual Printavo API v2 call
    // This is placeholder logic for demonstration using filtered invoices
    const mockData: InvoiceTotalsData[] = [
      {
        invoiceNumber: 'INV-001',
        customerName: 'Acme Corp',
        subtotal: 10000,
        tax: 800,
        fees: 200,
        total: 11000,
        amountPaid: 5000,
        balance: 6000,
      },
      {
        invoiceNumber: 'INV-002',
        customerName: 'Tech Solutions',
        subtotal: 5000,
        tax: 400,
        fees: 100,
        total: 5500,
        amountPaid: 5500,
        balance: 0,
      },
    ];

    return mockData;
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
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subtotal
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tax
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fees
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
                    <td className="px-4 py-4 whitespace-nowrap text-gray-900 text-right">
                      {formatCurrency(item.subtotal)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-900 text-right">
                      {formatCurrency(item.tax)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-900 text-right">
                      {formatCurrency(item.fees)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap font-semibold text-gray-900 text-right">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-green-600 text-right">
                      {formatCurrency(item.amountPaid)}
                    </td>
                    <td className={`px-4 py-4 whitespace-nowrap text-right font-medium ${item.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(item.balance)}
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
