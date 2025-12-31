import { useMemo, useState } from 'react';
import { FileDown, TrendingUp, DollarSign, FileText, Calendar, ChevronDown } from 'lucide-react';
import { Invoice } from '../types/printavo';
import { format, startOfDay, endOfDay, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';
import { exportToCSV } from '../utils/csv-export';
import { exportToPDF } from '../utils/pdf-export';
import { DateRangePreset, getDateRangeForPreset, dateRangePresetLabels } from '../utils/date-ranges';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface SalesSummaryReportProps {
  invoices: Invoice[];
}

type GroupingPeriod = 'day' | 'week' | 'month';

interface SalesData {
  period: string;
  periodDate: Date;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
}

export function SalesSummaryReport({ invoices }: SalesSummaryReportProps) {
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('this-month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [grouping, setGrouping] = useState<GroupingPeriod>('week');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
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

  const salesData = useMemo(() => {
    const filteredInvoices = invoices.filter(invoice => {
      const invoiceDate = new Date(invoice.createdAt);
      return invoiceDate >= dateRange.startDate && invoiceDate <= dateRange.endDate;
    });

    let periods: Date[] = [];
    let formatString = 'MMM d, yyyy';

    if (grouping === 'day') {
      periods = eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
      formatString = 'MMM d';
    } else if (grouping === 'week') {
      periods = eachWeekOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
      formatString = 'MMM d';
    } else if (grouping === 'month') {
      periods = eachMonthOfInterval({ start: dateRange.startDate, end: dateRange.endDate });
      formatString = 'MMM yyyy';
    }

    const data: SalesData[] = periods.map(period => {
      let periodStart: Date;
      let periodEnd: Date;

      if (grouping === 'day') {
        periodStart = startOfDay(period);
        periodEnd = endOfDay(period);
      } else if (grouping === 'week') {
        periodStart = startOfWeek(period);
        periodEnd = endOfWeek(period);
      } else {
        periodStart = startOfMonth(period);
        periodEnd = endOfMonth(period);
      }

      const periodInvoices = filteredInvoices.filter(inv => {
        const invDate = new Date(inv.createdAt);
        return invDate >= periodStart && invDate <= periodEnd;
      });

      const totalInvoiced = periodInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const totalPaid = periodInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
      const totalOutstanding = periodInvoices.reduce((sum, inv) => sum + (inv.amountOutstanding || 0), 0);

      return {
        period: format(period, formatString),
        periodDate: period,
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        invoiceCount: periodInvoices.length,
      };
    });

    return data;
  }, [invoices, dateRange, grouping]);

  const summaryMetrics = useMemo(() => {
    const totalInvoiced = salesData.reduce((sum, d) => sum + d.totalInvoiced, 0);
    const totalPaid = salesData.reduce((sum, d) => sum + d.totalPaid, 0);
    const totalOutstanding = salesData.reduce((sum, d) => sum + d.totalOutstanding, 0);
    const invoiceCount = salesData.reduce((sum, d) => sum + d.invoiceCount, 0);

    return { totalInvoiced, totalPaid, totalOutstanding, invoiceCount };
  }, [salesData]);

  const handleExportCSV = () => {
    exportToCSV(
      salesData.map(d => ({
        period: d.period,
        invoiceCount: d.invoiceCount,
        totalInvoiced: `$${d.totalInvoiced.toFixed(2)}`,
        totalPaid: `$${d.totalPaid.toFixed(2)}`,
        totalOutstanding: `$${d.totalOutstanding.toFixed(2)}`,
      })),
      [
        { header: 'Period', key: 'period' },
        { header: 'Invoice Count', key: 'invoiceCount' },
        { header: 'Total Invoiced', key: 'totalInvoiced' },
        { header: 'Total Paid', key: 'totalPaid' },
        { header: 'Total Outstanding', key: 'totalOutstanding' },
      ],
      `sales-summary-${format(new Date(), 'yyyy-MM-dd')}`
    );
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'Sales Summary Report',
      subtitle: `${format(dateRange.startDate, 'MMM d, yyyy')} - ${format(dateRange.endDate, 'MMM d, yyyy')} • Grouped by ${grouping}`,
      filename: `sales-summary-${format(new Date(), 'yyyy-MM-dd')}`,
      columns: [
        { header: 'Period', dataKey: 'period' },
        { header: 'Invoices', dataKey: 'invoiceCount' },
        { header: 'Total Invoiced', dataKey: 'totalInvoiced', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Total Paid', dataKey: 'totalPaid', formatter: (val) => `$${val.toFixed(2)}` },
        { header: 'Outstanding', dataKey: 'totalOutstanding', formatter: (val) => `$${val.toFixed(2)}` },
      ],
      data: salesData,
      orientation: 'landscape',
    });
  };

  const ChartComponent = chartType === 'bar' ? BarChart : LineChart;
  const DataComponent = chartType === 'bar' ? Bar : Line;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700 mb-1">Total Invoiced</p>
              <p className="text-3xl font-bold text-blue-900">
                ${summaryMetrics.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-blue-200 rounded-full p-3">
              <DollarSign className="w-8 h-8 text-blue-700" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-sm border border-green-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700 mb-1">Total Paid</p>
              <p className="text-3xl font-bold text-green-900">
                ${summaryMetrics.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-green-200 rounded-full p-3">
              <TrendingUp className="w-8 h-8 text-green-700" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-sm border border-red-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700 mb-1">Outstanding</p>
              <p className="text-3xl font-bold text-red-900">
                ${summaryMetrics.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-red-200 rounded-full p-3">
              <DollarSign className="w-8 h-8 text-red-700" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Invoices</p>
              <p className="text-3xl font-bold text-gray-900">{summaryMetrics.invoiceCount}</p>
            </div>
            <div className="bg-gray-200 rounded-full p-3">
              <FileText className="w-8 h-8 text-gray-700" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Export Controls Bar */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6 justify-end">
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={salesData.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              Export
              <ChevronDown className="w-4 h-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                <button
                  onClick={() => {
                    handleExportCSV();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Export as CSV
                </button>
                <button
                  onClick={() => {
                    handleExportPDF();
                    setShowExportMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Date Range Selector with Pills */}
        <div className="space-y-4">
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

        {/* Additional Controls */}
        <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-gray-200 mt-6">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Group by:</label>
            <div className="flex gap-2">
              {(['day', 'week', 'month'] as GroupingPeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setGrouping(period)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    grouping === period
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Chart type:</label>
            <div className="flex gap-2">
              {(['bar', 'line'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    chartType === type
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trends</h3>
        <ResponsiveContainer width="100%" height={400}>
          <ChartComponent data={salesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            />
            {chartType === 'bar' ? (
              <>
                <Bar dataKey="totalInvoiced" name="Total Invoiced" fill="#3b82f6" />
                <Bar dataKey="totalPaid" name="Total Paid" fill="#10b981" />
                <Bar dataKey="totalOutstanding" name="Outstanding" fill="#ef4444" />
              </>
            ) : (
              <>
                <Line type="monotone" dataKey="totalInvoiced" name="Total Invoiced" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="totalPaid" name="Total Paid" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="totalOutstanding" name="Outstanding" stroke="#ef4444" strokeWidth={2} />
              </>
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Invoices
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total Invoiced
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total Paid
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Outstanding
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {salesData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-12 h-12 text-gray-300" />
                      <p className="text-sm font-medium">No data available for selected date range</p>
                    </div>
                  </td>
                </tr>
              ) : (
                salesData.map((data, index) => (
                  <tr
                    key={index}
                    className={`transition-colors hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{data.period}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{data.invoiceCount}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-blue-600">
                        ${data.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-green-600">
                        ${data.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-bold text-red-600">
                        ${data.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
