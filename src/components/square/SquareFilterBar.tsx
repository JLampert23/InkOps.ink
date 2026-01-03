import { useState } from 'react';
import { Search, Calendar, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';

interface DateRangeOption {
  label: string;
  value: string;
}

interface SquareFilterBarProps {
  searchPlaceholder?: string;
  sortOptions?: { label: string; value: string }[];
  onSearchChange?: (value: string) => void;
  onSortChange?: (value: string) => void;
  onDateRangeChange?: (start: string, end: string) => void;
  showDateRange?: boolean;
  showSort?: boolean;
}

export default function SquareFilterBar({
  searchPlaceholder = 'Search by invoice number or customer name...',
  sortOptions = [
    { label: 'Sort by Date', value: 'date' },
    { label: 'Sort by Amount', value: 'amount' },
    { label: 'Sort by Status', value: 'status' }
  ],
  onSearchChange,
  onSortChange,
  onDateRangeChange,
  showDateRange = true,
  showSort = true
}: SquareFilterBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedRange, setSelectedRange] = useState('today');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [useCustomRange, setUseCustomRange] = useState(false);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    onSearchChange?.(value);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    onSortChange?.(value);
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleDateRangeClick = (range: string) => {
    setSelectedRange(range);
    setUseCustomRange(false);

    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'today':
        start = new Date(today);
        end = new Date(today);
        break;
      case 'thisWeek': {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        start = weekStart;
        end = new Date();
        break;
      }
      case 'lastWeek': {
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
        start = lastWeekStart;
        end = lastWeekEnd;
        break;
      }
      case 'last5Days': {
        const fiveDaysAgo = new Date(today);
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        start = fiveDaysAgo;
        end = new Date();
        break;
      }
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date();
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'allTime':
        start = new Date(2020, 0, 1);
        end = new Date();
        break;
    }

    onDateRangeChange?.(format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'));
  };

  const handleCustomRangeChange = () => {
    if (customRange.start && customRange.end) {
      setUseCustomRange(true);
      setSelectedRange('');
      onDateRangeChange?.(customRange.start, customRange.end);
    }
  };

  const getDisplayDateRange = () => {
    if (useCustomRange && customRange.start && customRange.end) {
      return `${format(new Date(customRange.start), 'MMM d, yyyy')} - ${format(new Date(customRange.end), 'MMM d, yyyy')}`;
    }

    const today = new Date();
    switch (selectedRange) {
      case 'today':
        return format(today, 'MMM d, yyyy');
      case 'thisWeek': {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return `${format(weekStart, 'MMM d, yyyy')} - ${format(new Date(), 'MMM d, yyyy')}`;
      }
      case 'lastWeek': {
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
        return `${format(lastWeekStart, 'MMM d, yyyy')} - ${format(lastWeekEnd, 'MMM d, yyyy')}`;
      }
      case 'last5Days': {
        const fiveDaysAgo = new Date(today);
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        return `${format(fiveDaysAgo, 'MMM d, yyyy')} - ${format(new Date(), 'MMM d, yyyy')}`;
      }
      case 'thisMonth': {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return `${format(monthStart, 'MMM d, yyyy')} - ${format(new Date(), 'MMM d, yyyy')}`;
      }
      case 'lastMonth': {
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return `${format(lastMonthStart, 'MMM d, yyyy')} - ${format(lastMonthEnd, 'MMM d, yyyy')}`;
      }
      case 'allTime':
        return 'All Time';
      default:
        return format(new Date(), 'MMM d, yyyy');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>

      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
          />
        </div>

        {showSort && (
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={toggleSortDirection}
              className="px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown className={`w-5 h-5 text-gray-600 ${sortDirection === 'desc' ? 'rotate-180' : ''} transition-transform`} />
            </button>
          </div>
        )}
      </div>

      {showDateRange && (
        <>
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
              <Calendar className="w-4 h-4" />
              Date Range
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Today', value: 'today' },
                { label: 'This Week', value: 'thisWeek' },
                { label: 'Last Week', value: 'lastWeek' },
                { label: 'Last 5 Days', value: 'last5Days' },
                { label: 'This Month', value: 'thisMonth' },
                { label: 'Last Month', value: 'lastMonth' },
                { label: 'All Time', value: 'allTime' }
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => handleDateRangeClick(value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedRange === value && !useCustomRange
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="customRange"
                checked={useCustomRange}
                onChange={() => setUseCustomRange(true)}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor="customRange" className="text-sm font-medium text-gray-900">
                Custom Range
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                onBlur={handleCustomRangeChange}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-600">to</span>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                onBlur={handleCustomRangeChange}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <p className="text-sm text-blue-900">
              <span className="font-medium">Showing:</span> {getDisplayDateRange()}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
