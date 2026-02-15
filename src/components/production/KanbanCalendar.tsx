import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Filter, ChevronLeft, ChevronRight, X, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format, startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isSameDay, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

interface KanbanJob {
  id: string;
  quote_id: string | null;
  work_order_id: string | null;
  work_order_number: string | null;
  quote_number: string | null;
  customer_name: string | null;
  production_due_date: string;
  imprint_type: string;
  total_pieces: number;
  primary_color: string | null;
  status: string;
}

type ViewMode = 'week' | 'month';

interface KanbanCalendarProps {
  typeOfWork: string;
  onClose?: () => void;
  onNavigateToWorkOrder?: (workOrderId: string) => void;
  inline?: boolean;
}

export default function KanbanCalendar({ typeOfWork, onClose, onNavigateToWorkOrder, inline = false }: KanbanCalendarProps) {
  const { companySettings } = useAuth();
  const [jobs, setJobs] = useState<KanbanJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [imprintTypeFilter, setImprintTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [draggedJob, setDraggedJob] = useState<string | null>(null);

  const companyId = companySettings?.id || null;

  // Available imprint types
  const imprintTypes = ['Screen Print', 'Embroidery', 'DTG', 'DTF', 'Heat Transfer', 'Sublimation'];

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate),
        end: endOfWeek(currentDate)
      });
    } else {
      return eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      });
    }
  }, [currentDate, viewMode]);

  useEffect(() => {
    if (companyId) {
      loadJobs();
    }
  }, [companyId, typeOfWork]);

  const loadJobs = async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      // Get quotes with line items and imprints
      const { data: quotes } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          customer_name,
          status,
          production_due_date,
          quote_line_items (
            id,
            quantity,
            size_2xs, size_xs, size_s, size_m, size_l, size_xl,
            size_2xl, size_3xl, size_4xl, size_5xl, size_6xl,
            garment_color
          ),
          quote_imprints (
            id,
            imprint_type
          )
        `)
        .eq('company_id', companyId)
        .not('production_due_date', 'is', null)
        .in('status', ['approved', 'in_production']);

      // Get work orders with line items
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select(`
          id,
          work_order_number,
          customer_name,
          status,
          production_due_date,
          work_order_line_items (
            id,
            quantity,
            size_2xs, size_xs, size_s, size_m, size_l, size_xl,
            size_2xl, size_3xl, size_4xl, size_5xl, size_6xl,
            garment_color,
            imprint_type
          )
        `)
        .eq('company_id', companyId)
        .not('production_due_date', 'is', null)
        .in('status', ['pending_scheduling', 'scheduled', 'in_production']);

      const kanbanJobs: KanbanJob[] = [];

      // Process quotes
      if (quotes) {
        quotes.forEach(quote => {
          const lineItems = quote.quote_line_items || [];
          const imprints = quote.quote_imprints || [];

          // Calculate total pieces
          const totalPieces = lineItems.reduce((sum, item) => {
            const sizes = [
              item.size_2xs, item.size_xs, item.size_s, item.size_m,
              item.size_l, item.size_xl, item.size_2xl, item.size_3xl,
              item.size_4xl, item.size_5xl, item.size_6xl
            ];
            const lineTotal = sizes.reduce((s, size) => s + (parseInt(size?.toString() || '0') || 0), 0);
            return sum + (lineTotal * (item.quantity || 1));
          }, 0);

          // Get primary color from first line item
          const primaryColor = lineItems[0]?.garment_color || null;

          // Get imprint type
          const imprintType = imprints[0]?.imprint_type || typeOfWork;

          kanbanJobs.push({
            id: `quote-${quote.id}`,
            quote_id: quote.id,
            work_order_id: null,
            work_order_number: null,
            quote_number: quote.quote_number,
            customer_name: quote.customer_name,
            production_due_date: quote.production_due_date,
            imprint_type: imprintType,
            total_pieces: totalPieces,
            primary_color: primaryColor,
            status: quote.status || 'quote'
          });
        });
      }

      // Process work orders
      if (workOrders) {
        workOrders.forEach(wo => {
          const lineItems = wo.work_order_line_items || [];

          // Calculate total pieces
          const totalPieces = lineItems.reduce((sum, item) => {
            const sizes = [
              item.size_2xs, item.size_xs, item.size_s, item.size_m,
              item.size_l, item.size_xl, item.size_2xl, item.size_3xl,
              item.size_4xl, item.size_5xl, item.size_6xl
            ];
            const lineTotal = sizes.reduce((s, size) => s + (parseInt(size?.toString() || '0') || 0), 0);
            return sum + (lineTotal * (item.quantity || 1));
          }, 0);

          // Get primary color and imprint type from first line item
          const primaryColor = lineItems[0]?.garment_color || null;
          const imprintType = lineItems[0]?.imprint_type || typeOfWork;

          kanbanJobs.push({
            id: `wo-${wo.id}`,
            quote_id: null,
            work_order_id: wo.id,
            work_order_number: wo.work_order_number,
            quote_number: null,
            customer_name: wo.customer_name,
            production_due_date: wo.production_due_date,
            imprint_type: imprintType,
            total_pieces: totalPieces,
            primary_color: primaryColor,
            status: wo.status || 'work_order'
          });
        });
      }

      setJobs(kanbanJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (imprintTypeFilter && job.imprint_type !== imprintTypeFilter) return false;
      if (statusFilter && job.status !== statusFilter) return false;
      if (customerFilter && !job.customer_name?.toLowerCase().includes(customerFilter.toLowerCase())) return false;
      return true;
    });
  }, [jobs, imprintTypeFilter, statusFilter, customerFilter]);

  // Group jobs by date
  const jobsByDate = useMemo(() => {
    const grouped: Record<string, KanbanJob[]> = {};

    filteredJobs.forEach(job => {
      const dateKey = format(parseISO(job.production_due_date), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(job);
    });

    return grouped;
  }, [filteredJobs]);

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJob(jobId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();

    if (!draggedJob) return;

    const job = jobs.find(j => j.id === draggedJob);
    if (!job) return;

    const newDate = format(targetDate, 'yyyy-MM-dd');

    try {
      if (job.work_order_id) {
        await supabase
          .from('work_orders')
          .update({ production_due_date: newDate })
          .eq('id', job.work_order_id);
      } else if (job.quote_id) {
        await supabase
          .from('quotes')
          .update({ production_due_date: newDate })
          .eq('id', job.quote_id);
      }

      // Update local state
      setJobs(prev => prev.map(j =>
        j.id === draggedJob ? { ...j, production_due_date: newDate } : j
      ));
    } catch (error) {
      console.error('Error updating date:', error);
    }

    setDraggedJob(null);
  };

  const handleJobClick = (job: KanbanJob) => {
    if (job.work_order_id && onNavigateToWorkOrder) {
      onNavigateToWorkOrder(job.work_order_id);
      if (onClose) {
        onClose();
      }
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setCurrentDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
    } else {
      setCurrentDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
    }
  };

  const getImprintColor = (type: string) => {
    const colors: Record<string, string> = {
      'Screen Print': '#10b981',
      'Embroidery': '#3b82f6',
      'DTG': '#8b5cf6',
      'DTF': '#ec4899',
      'Heat Transfer': '#f59e0b',
      'Sublimation': '#06b6d4'
    };
    return colors[type] || '#6b7280';
  };

  const calendarContent = (
    <div className={inline ? "flex flex-col h-full" : "bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col"}>
        {/* Header */}
        {!inline && (
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-green-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Kanban Calendar
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {typeOfWork} Production Schedule
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        )}

        {/* Controls */}
        <div className={`border-b border-gray-200 dark:border-slate-700 ${inline ? 'p-2 space-y-2' : 'p-4 space-y-4'}`}>
          <div className={`flex items-center ${inline ? 'flex-col gap-2' : 'justify-between'}`}>
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateDate('prev')}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <ChevronLeft className={inline ? 'w-4 h-4' : 'w-5 h-5'} />
              </button>
              <span className={`font-semibold text-gray-900 dark:text-white ${inline ? 'text-sm min-w-[150px]' : 'min-w-[200px]'} text-center`}>
                {viewMode === 'week'
                  ? `Week of ${format(startOfWeek(currentDate), 'MMM d')}`
                  : format(currentDate, 'MMM yyyy')
                }
              </span>
              <button
                onClick={() => navigateDate('next')}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <ChevronRight className={inline ? 'w-4 h-4' : 'w-5 h-5'} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className={`${inline ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg`}
              >
                Today
              </button>
            </div>

            {/* View Mode Toggle & Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('week')}
                className={`${inline ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'} font-medium rounded-lg ${
                  viewMode === 'week'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`${inline ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'} font-medium rounded-lg ${
                  viewMode === 'month'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`${inline ? 'p-1' : 'px-3 py-2'} text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 flex items-center gap-1`}
              >
                <Filter className="w-4 h-4" />
                {!inline && 'Filters'}
              </button>
              <button
                onClick={loadJobs}
                className="p-1 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <RefreshCw className={inline ? 'w-4 h-4' : 'w-5 h-5'} />
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-slate-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Imprint Type
                </label>
                <select
                  value={imprintTypeFilter}
                  onChange={(e) => setImprintTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                >
                  <option value="">All Types</option>
                  {imprintTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                >
                  <option value="">All Statuses</option>
                  <option value="quote">Quote</option>
                  <option value="approved">Approved</option>
                  <option value="in_production">In Production</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Customer
                </label>
                <input
                  type="text"
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  placeholder="Search customer..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Calendar Grid */}
        <div className={`flex-1 overflow-auto ${inline ? 'p-2' : 'p-4'}`}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
            </div>
          ) : (
            <div className={`grid ${inline ? 'gap-1' : 'gap-2'} ${viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7'}`}>
              {dateRange.map((date, idx) => {
                const dateKey = format(date, 'yyyy-MM-dd');
                const dayJobs = jobsByDate[dateKey] || [];
                const isToday = isSameDay(date, new Date());

                return (
                  <div
                    key={idx}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, date)}
                    className={`border rounded-lg ${inline ? 'p-1 min-h-[120px]' : 'p-2 min-h-[150px]'} ${
                      isToday
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    {/* Date Header */}
                    <div className={`text-center ${inline ? 'mb-1 pb-1' : 'mb-2 pb-2'} border-b ${
                      isToday ? 'border-green-300' : 'border-gray-200 dark:border-slate-700'
                    }`}>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {format(date, 'EEE')}
                      </div>
                      <div className={`${inline ? 'text-base' : 'text-lg'} font-bold ${
                        isToday ? 'text-green-600' : 'text-gray-900 dark:text-white'
                      }`}>
                        {format(date, 'd')}
                      </div>
                    </div>

                    {/* Job Blocks */}
                    <div className={inline ? 'space-y-1' : 'space-y-2'}>
                      {dayJobs.map(job => (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, job.id)}
                          onClick={() => handleJobClick(job)}
                          className={`${inline ? 'p-1' : 'p-2'} rounded-lg border-l-4 cursor-pointer hover:shadow-md transition-all ${
                            draggedJob === job.id ? 'opacity-50' : ''
                          }`}
                          style={{
                            borderLeftColor: getImprintColor(job.imprint_type),
                            backgroundColor: `${getImprintColor(job.imprint_type)}10`
                          }}
                        >
                          {/* Imprint Type Badge */}
                          <div
                            className={`text-xs font-medium ${inline ? 'px-1 py-0.5' : 'px-2 py-1'} rounded mb-1 inline-block`}
                            style={{
                              backgroundColor: getImprintColor(job.imprint_type),
                              color: 'white'
                            }}
                          >
                            {inline ? job.imprint_type.substring(0, 3) : job.imprint_type}
                          </div>

                          {/* Total Pieces */}
                          <div className={`${inline ? 'text-xs' : 'text-sm'} font-bold text-gray-900 dark:text-white`}>
                            {job.total_pieces} pcs
                          </div>

                          {/* Color */}
                          {!inline && job.primary_color && (
                            <div className="flex items-center gap-1 mt-1">
                              <div
                                className="w-3 h-3 rounded-full border border-gray-300"
                                style={{ backgroundColor: job.primary_color }}
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {job.primary_color}
                              </span>
                            </div>
                          )}

                          {/* Customer */}
                          {job.customer_name && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                              {job.customer_name}
                            </div>
                          )}

                          {/* Quote/WO Number - Only if not inline */}
                          {!inline && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {job.work_order_number || job.quote_number}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!inline && (
          <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'} scheduled
            </div>
            <div className="flex items-center gap-4">
              {/* Legend */}
              <div className="flex items-center gap-3">
                {imprintTypes.map(type => (
                  <div key={type} className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: getImprintColor(type) }}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
  );

  if (inline) {
    return calendarContent;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {calendarContent}
    </div>
  );
}
