import { useMemo } from 'react';
import { TrendingUp, DollarSign, FileText, Clock } from 'lucide-react';
import { Invoice } from '../types/printavo';
import {
  calculateTotalAR,
  calculateAverageDaysOutstanding,
  getOpenInvoices,
  getHighestOutstandingCustomer,
} from '../utils/aging-calculations';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface AccountsReceivableProps {
  invoices: Invoice[];
}

export function AccountsReceivable({ invoices }: AccountsReceivableProps) {

  const openInvoices = useMemo(() => getOpenInvoices(invoices), [invoices]);
  const totalAR = useMemo(() => calculateTotalAR(invoices), [invoices]);
  const avgDaysOutstanding = useMemo(() => calculateAverageDaysOutstanding(invoices), [invoices]);
  const highestCustomer = useMemo(() => getHighestOutstandingCustomer(invoices), [invoices]);

  const arByMonth = useMemo(() => {
    const months: { month: string; ar: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthInvoices = invoices.filter(inv => {
        const createdDate = new Date(inv.createdAt);
        return createdDate >= monthStart && createdDate <= monthEnd;
      });

      const monthAR = getOpenInvoices(monthInvoices).reduce(
        (sum, inv) => sum + (inv.amountOutstanding || 0),
        0
      );

      months.push({
        month: format(monthDate, 'MMM yyyy'),
        ar: monthAR,
      });
    }
    return months;
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Total A/R</p>
          <p className="text-3xl font-bold text-gray-900">
            ${totalAR.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Avg Days Outstanding</p>
          <p className="text-3xl font-bold text-gray-900">{avgDaysOutstanding}</p>
          <p className="text-xs text-gray-500 mt-1">days</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Open Invoices</p>
          <p className="text-3xl font-bold text-gray-900">{openInvoices.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-1">Highest Balance</p>
          <p className="text-lg font-bold text-gray-900">
            ${highestCustomer.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1 truncate">{highestCustomer.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">A/R Trend (Last 12 Months)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={arByMonth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            />
            <Line type="monotone" dataKey="ar" stroke="#3b82f6" strokeWidth={2} name="A/R Balance" />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
