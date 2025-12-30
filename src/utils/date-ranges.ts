import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export type DateRangePreset = 'today' | 'this-week' | 'last-week' | 'last-5-days' | 'this-month' | 'last-month' | 'custom';

export const getDateRangeForPreset = (preset: DateRangePreset, customRange?: DateRange): DateRange => {
  const now = new Date();

  switch (preset) {
    case 'today':
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now)
      };

    case 'this-week':
      return {
        startDate: startOfWeek(now, { weekStartsOn: 0 }),
        endDate: endOfWeek(now, { weekStartsOn: 0 })
      };

    case 'last-week':
      const lastWeek = subWeeks(now, 1);
      return {
        startDate: startOfWeek(lastWeek, { weekStartsOn: 0 }),
        endDate: endOfWeek(lastWeek, { weekStartsOn: 0 })
      };

    case 'last-5-days':
      return {
        startDate: startOfDay(subDays(now, 4)),
        endDate: endOfDay(now)
      };

    case 'this-month':
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now)
      };

    case 'last-month':
      const lastMonth = subMonths(now, 1);
      return {
        startDate: startOfMonth(lastMonth),
        endDate: endOfMonth(lastMonth)
      };

    case 'custom':
      return customRange || {
        startDate: startOfMonth(now),
        endDate: endOfDay(now)
      };

    default:
      return {
        startDate: startOfMonth(now),
        endDate: endOfDay(now)
      };
  }
};

export const dateRangePresetLabels: Record<DateRangePreset, string> = {
  'today': 'Today',
  'this-week': 'This Week',
  'last-week': 'Last Week',
  'last-5-days': 'Last 5 Days',
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'custom': 'Custom Range'
};
