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
    return invoices.map(invoice => ({
      invoiceNumber: invoice.invoice_number || invoice.id,
      customerName: invoice.customer_name || invoice.customer_company || 'Unknown',
      subtotal: Number(invoice.subtotal) || 0,
      tax: Number(invoice.tax) || 0,
      fees: 0, // No fees field in current data
      total: Number(invoice.total) || 0,
      amountPaid: Number(invoice.amount_paid) || 0,
      balance: Number(invoice.amount_outstanding) || 0,
    }));
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
