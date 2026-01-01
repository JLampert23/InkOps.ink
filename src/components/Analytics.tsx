import { useState, lazy, Suspense } from 'react';
import { BarChart3, TrendingUp, Package, DollarSign, FileText, Clock, AlertCircle, Layers, Shirt, PieChart, Target, TrendingDown, Loader2 } from 'lucide-react';

interface AnalyticsProps {
  invoices: any[];
  payments: any[];
}

type ReportType =
  | 'sales-by-style'
  | 'top-selling-products'
  | 'top-garment-categories'
  | 'revenue-by-product'
  | 'units-sold-by-product'
  | 'invoice-totals'
  | 'outstanding-balances'
  | 'overdue-invoices'
  | 'invoices-by-status'
  | 'decoration-breakdown'
  | 'revenue-per-order'
  | 'estimated-margin'
  | 'revenue-per-garment'
  | 'revenue-per-decoration';

const reportComponents = {
  'sales-by-style': lazy(() => import('./analytics/SalesByStyleReport')),
  'top-selling-products': lazy(() => import('./analytics/TopSellingProductsReport')),
  'top-garment-categories': lazy(() => import('./analytics/TopGarmentCategoriesReport')),
  'revenue-by-product': lazy(() => import('./analytics/RevenueByProductReport')),
  'units-sold-by-product': lazy(() => import('./analytics/UnitsSoldByProductReport')),
  'invoice-totals': lazy(() => import('./analytics/InvoiceTotalsReport')),
  'outstanding-balances': lazy(() => import('./analytics/OutstandingBalancesReport')),
  'overdue-invoices': lazy(() => import('./analytics/OverdueInvoicesReport')),
  'invoices-by-status': lazy(() => import('./analytics/InvoicesByStatusReport')),
  'decoration-breakdown': lazy(() => import('./analytics/DecorationBreakdownReport')),
  'revenue-per-order': lazy(() => import('./analytics/RevenuePerOrderReport')),
  'estimated-margin': lazy(() => import('./analytics/EstimatedMarginReport')),
  'revenue-per-garment': lazy(() => import('./analytics/RevenuePerGarmentReport')),
  'revenue-per-decoration': lazy(() => import('./analytics/RevenuePerDecorationReport')),
};

const reportCategories = [
  {
    name: 'Sales & Revenue',
    reports: [
      {
        id: 'sales-by-style' as ReportType,
        name: 'Sales by Style Number',
        description: 'Analyze sales performance by product style',
        icon: BarChart3,
      },
      {
        id: 'revenue-by-product' as ReportType,
        name: 'Revenue by Product',
        description: 'Total revenue generated per product',
        icon: DollarSign,
      },
      {
        id: 'revenue-per-order' as ReportType,
        name: 'Revenue per Order',
        description: 'Average and total revenue per order',
        icon: TrendingUp,
      },
      {
        id: 'estimated-margin' as ReportType,
        name: 'Estimated Margin per Order',
        description: 'Profit margin analysis for orders',
        icon: Target,
      },
    ],
  },
  {
    name: 'Product Performance',
    reports: [
      {
        id: 'top-selling-products' as ReportType,
        name: 'Top-Selling Products',
        description: 'Best performing products by quantity',
        icon: TrendingUp,
      },
      {
        id: 'top-garment-categories' as ReportType,
        name: 'Top-Selling Garment Categories',
        description: 'Most popular garment types',
        icon: Shirt,
      },
      {
        id: 'units-sold-by-product' as ReportType,
        name: 'Units Sold by Product',
        description: 'Quantity of each product sold',
        icon: Package,
      },
      {
        id: 'revenue-per-garment' as ReportType,
        name: 'Revenue per Garment Type',
        description: 'Revenue breakdown by garment type',
        icon: Shirt,
      },
    ],
  },
  {
    name: 'Invoice Analytics',
    reports: [
      {
        id: 'invoice-totals' as ReportType,
        name: 'Invoice Totals, Subtotals, Taxes & Fees',
        description: 'Complete invoice financial breakdown',
        icon: FileText,
      },
      {
        id: 'outstanding-balances' as ReportType,
        name: 'Outstanding Balances',
        description: 'All unpaid invoice balances',
        icon: Clock,
      },
      {
        id: 'overdue-invoices' as ReportType,
        name: 'Overdue Invoices',
        description: 'Past due invoice tracking',
        icon: AlertCircle,
      },
      {
        id: 'invoices-by-status' as ReportType,
        name: 'Invoices by Status',
        description: 'Invoice breakdown by current status',
        icon: Layers,
      },
    ],
  },
  {
    name: 'Decoration & Services',
    reports: [
      {
        id: 'decoration-breakdown' as ReportType,
        name: 'Decoration Type Breakdown',
        description: 'Revenue by decoration method',
        icon: PieChart,
      },
      {
        id: 'revenue-per-decoration' as ReportType,
        name: 'Revenue per Decoration Type',
        description: 'Financial performance by decoration',
        icon: TrendingDown,
      },
    ],
  },
];

export function Analytics({ invoices, payments }: AnalyticsProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);

  const handleReportSelect = (reportId: ReportType) => {
    setSelectedReport(reportId);
  };

  const handleBackToList = () => {
    setSelectedReport(null);
  };

  if (selectedReport) {
    const ReportComponent = reportComponents[selectedReport];
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <button
            onClick={handleBackToList}
            className="text-blue-600 hover:text-blue-800 font-medium mb-4"
          >
            ← Back to Reports List
          </button>
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="ml-3 text-gray-600">Loading report...</span>
            </div>
          }>
            <ReportComponent invoices={invoices} payments={payments} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        </div>
        <p className="text-gray-600">
          Select a report to generate detailed analytics and insights
        </p>
      </div>

      {reportCategories.map((category) => (
        <div key={category.name} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{category.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {category.reports.map((report) => {
              const Icon = report.icon;
              return (
                <button
                  key={report.id}
                  onClick={() => handleReportSelect(report.id)}
                  className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 text-left group"
                >
                  <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 mb-1 group-hover:text-blue-900">
                      {report.name}
                    </h3>
                    <p className="text-sm text-gray-500 group-hover:text-gray-700">
                      {report.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
