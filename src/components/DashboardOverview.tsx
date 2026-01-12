import { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Invoice, PaymentWithInvoice } from '../types/printavo';
import { calculateFinancialSummary, formatCurrency, formatPercentage } from '../utils/financial-aggregations';

interface DashboardOverviewProps {
  invoices: Invoice[];
  payments: PaymentWithInvoice[];
  loading?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function DashboardOverview({ invoices, payments, loading }: DashboardOverviewProps) {
  const summary = useMemo(
    () => calculateFinancialSummary(invoices, payments),
    [invoices, payments]
  );

  const statusData = useMemo(() => {
    return Object.entries(summary.revenueByStatus).map(([status, revenue]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: revenue,
    }));
  }, [summary.revenueByStatus]);

  const paymentMethodData = useMemo(() => {
    return Object.entries(summary.paymentsByMethod).map(([method, amount]) => ({
      name: method.charAt(0).toUpperCase() + method.slice(1),
      amount,
    }));
  }, [summary.paymentsByMethod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading financial data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          icon={<DollarSign className="w-6 h-6" />}
          trend={`${summary.invoiceCount} invoices`}
          color="blue"
        />
        <StatCard
          title="Outstanding Balance"
          value={formatCurrency(summary.outstandingBalance)}
          icon={<AlertCircle className="w-6 h-6" />}
          trend={`${summary.invoiceCount - summary.paidInvoiceCount} unpaid`}
          color="orange"
        />
        <StatCard
          title="Total Payments"
          value={formatCurrency(summary.totalPayments)}
          icon={<CheckCircle className="w-6 h-6" />}
          trend={`${summary.paidInvoiceCount} paid`}
          color="green"
        />
        <StatCard
          title="Average Invoice"
          value={formatCurrency(summary.averageInvoiceValue)}
          icon={<FileText className="w-6 h-6" />}
          trend={`${summary.invoiceCount} total`}
          color="indigo"
        />
        <StatCard
          title="Payment Rate"
          value={formatPercentage(summary.paidInvoiceCount > 0 ? (summary.paidInvoiceCount / summary.invoiceCount) * 100 : 0)}
          icon={<TrendingUp className="w-6 h-6" />}
          trend={`${summary.paidInvoiceCount}/${summary.invoiceCount} paid`}
          color="purple"
        />
        <StatCard
          title="Total Fees & Tax"
          value={formatCurrency(summary.totalFees + summary.totalTax)}
          icon={<Clock className="w-6 h-6" />}
          trend={`Fees: ${formatCurrency(summary.totalFees)}`}
          color="pink"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="bg-white rounded-lg shadow p-4 lg:p-6">
          <h3 className="text-base lg:text-lg font-semibold mb-4">Monthly Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={summary.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4 lg:p-6">
          <h3 className="text-base lg:text-lg font-semibold mb-4">Revenue by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4 lg:p-6">
          <h3 className="text-base lg:text-lg font-semibold mb-4">Payments by Method</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={paymentMethodData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value as number)} />
              <Legend />
              <Bar dataKey="amount" fill="#10b981" name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-4 lg:p-6">
          <h3 className="text-base lg:text-lg font-semibold mb-4">Monthly Invoice Count</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={summary.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="invoiceCount" fill="#8b5cf6" name="Invoices" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: string;
  color: 'blue' | 'green' | 'orange' | 'indigo' | 'purple' | 'pink';
}

function StatCard({ title, value, icon, trend, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    pink: 'bg-pink-50 text-pink-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          <p className="text-sm text-gray-500">{trend}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
