import { useState, useMemo, lazy, Suspense } from 'react';
import { BarChart3, TrendingUp, Package, DollarSign, Shirt, PieChart, Target, TrendingDown, Loader2, Search, ChevronDown, Calendar, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { DateRangePreset, getDateRangeForPreset, dateRangePresetLabels } from '../utils/date-ranges';
import { exportAnalyticsReport } from '../utils/analytics-export';

interface AnalyticsProps {
  invoices: any[];
  payments: any[];
  lineItems: any[];
}

type ReportType =
  | 'sales-by-style'
  | 'top-selling-products'
  | 'top-garment-categories'
  | 'revenue-by-product'
  | 'units-sold-by-product'
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

export function Analytics({ invoices, payments, lineItems }: AnalyticsProps) {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'total' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const dateRange = useMemo(() => {
    if (dateRangePreset === 'custom' && customStartDate && customEndDate) {
      return {
        startDate: new Date(customStartDate),
        endDate: new Date(customEndDate)
      };
    }
    return getDateRangeForPreset(dateRangePreset);
  }, [dateRangePreset, customStartDate, customEndDate]);

  const filteredInvoices = useMemo(() => {
    let filtered = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.createdAt);
      const matchesDateRange = invoiceDate >= dateRange.startDate && invoiceDate <= dateRange.endDate;

      const customerName = invoice.contact?.customer?.companyName || invoice.contact?.fullName || '';
      const invoiceNumber = invoice.visualId || invoice.id;
      const matchesSearch = searchTerm === '' ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesDateRange && matchesSearch;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'total') {
        comparison = (a.total || 0) - (b.total || 0);
      } else if (sortBy === 'customer') {
        const aName = a.contact?.customer?.companyName || a.contact?.fullName || '';
        const bName = b.contact?.customer?.companyName || b.contact?.fullName || '';
        comparison = aName.localeCompare(bName);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [invoices, dateRange, searchTerm, sortBy, sortOrder]);

  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      const paymentDate = new Date(payment.paidAt);
      return paymentDate >= dateRange.startDate && paymentDate <= dateRange.endDate;
    });
  }, [payments, dateRange]);

  const handleReportSelect = (reportId: ReportType) => {
    setSelectedReport(reportId);
  };

  const handleBackToList = () => {
    setSelectedReport(null);
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    if (!selectedReport) return;
    const reportName = reportCategories
      .flatMap(cat => cat.reports)
      .find(r => r.id === selectedReport)?.name || 'Report';
    exportAnalyticsReport(filteredInvoices, filteredPayments, reportName, format, dateRange);
    setShowExportMenu(false);
  };

  if (selectedReport) {
    const ReportComponent = reportComponents[selectedReport];
    const reportInfo = reportCategories
      .flatMap(cat => cat.reports)
      .find(r => r.id === selectedReport);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <button
            onClick={handleBackToList}
            className="text-blue-600 hover:text-blue-800 font-medium mb-4"
          >
            ← Back to Reports List
          </button>
          <div className="flex items-center gap-3 mb-2">
            {reportInfo && <reportInfo.icon className="w-6 h-6 text-blue-600" />}
            <h1 className="text-2xl font-bold text-gray-900">{reportInfo?.name || 'Analytics'}</h1>
          </div>
          <p className="text-gray-600">
            {reportInfo?.description || 'Select a report to generate detailed analytics and insights'}
          </p>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
              >
                <FileDown className="w-4 h-4" />
                Export
                <ChevronDown className="w-4 h-4" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search and Sort */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by invoice number or customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'total' | 'customer')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="date">Sort by Date</option>
                <option value="total">Sort by Total</option>
                <option value="customer">Sort by Customer</option>
              </select>
              <button
                onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-bold"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Date Range</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(dateRangePresetLabels).filter(key => key !== 'custom') as DateRangePreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDateRangePreset(preset)}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                    dateRangePreset === preset
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {dateRangePresetLabels[preset]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={dateRangePreset === 'custom'}
                  onChange={() => setDateRangePreset('custom')}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Custom Range</span>
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setDateRangePreset('custom');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <span className="text-gray-400 font-medium text-sm">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setDateRangePreset('custom');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Showing:</span> <span className="font-semibold text-blue-700">{format(dateRange.startDate, 'MMM d, yyyy')}</span> - <span className="font-semibold text-blue-700">{format(dateRange.endDate, 'MMM d, yyyy')}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Report Display */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="ml-3 text-gray-600">Loading report...</span>
            </div>
          }>
            <ReportComponent invoices={filteredInvoices} payments={filteredPayments} lineItems={lineItems} />
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
