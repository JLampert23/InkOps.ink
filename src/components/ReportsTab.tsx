import { useState } from 'react';
import { FileText, DollarSign, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { Invoice, PaymentWithInvoice } from '../types/printavo';
import { AgingReport } from './AgingReport';
import { PaymentsExplorer } from './PaymentsExplorer';
import { SalesSummaryReport } from './SalesSummaryReport';
import { CustomerSummaryReport } from './CustomerSummaryReport';

interface ReportsTabProps {
  invoices: Invoice[];
  payments: PaymentWithInvoice[];
}

type ReportType = 'ar-aging' | 'payments' | 'sales-summary' | 'customer-summary';

export function ReportsTab({ invoices, payments }: ReportsTabProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('ar-aging');

  const reports = [
    {
      id: 'ar-aging' as ReportType,
      name: 'Accounts Receivables',
      description: '',
      icon: FileText,
      color: 'blue',
    },
    {
      id: 'payments' as ReportType,
      name: 'Payments',
      description: '',
      icon: DollarSign,
      color: 'green',
    },
    {
      id: 'sales-summary' as ReportType,
      name: 'Sales Summary',
      description: '',
      icon: BarChart3,
      color: 'purple',
    },
    {
      id: 'customer-summary' as ReportType,
      name: 'Customer Summary',
      description: '',
      icon: Users,
      color: 'orange',
    },
  ];

  const renderReport = () => {
    switch (activeReport) {
      case 'ar-aging':
        return <AgingReport invoices={invoices} />;
      case 'payments':
        return <PaymentsExplorer payments={payments} />;
      case 'sales-summary':
        return <SalesSummaryReport invoices={invoices} />;
      case 'customer-summary':
        return <CustomerSummaryReport invoices={invoices} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive reporting and analytics for your business
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reports.map((report) => {
            const Icon = report.icon;
            const isActive = activeReport === report.id;

            return (
              <button
                key={report.id}
                onClick={() => setActiveReport(report.id)}
                className={`text-center p-5 rounded-lg border-2 transition-all ${
                  isActive
                    ? 'border-blue-600 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={`p-3 rounded-lg ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : report.color === 'blue'
                        ? 'bg-blue-100 text-blue-600'
                        : report.color === 'green'
                        ? 'bg-green-100 text-green-600'
                        : report.color === 'purple'
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-orange-100 text-orange-600'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3
                      className={`text-lg font-bold ${
                        isActive ? 'text-blue-900' : 'text-gray-900'
                      }`}
                    >
                      {report.name}
                    </h3>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>{renderReport()}</div>
    </div>
  );
}
