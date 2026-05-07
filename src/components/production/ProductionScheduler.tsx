import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Filter, Save, X, Plus, Search, RefreshCw, CalendarDays, Menu, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';
import SchedulerTabManager from './SchedulerTabManager';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { UpgradeWall } from '../common/UpgradeWall';

interface ScheduleEntry {
  id: string;
  company_id: string;
  quote_id: string | null;
  work_order_id: string | null;
  line_item_id: string | null;
  imprint_id: string | null;
  type_of_work: string;
  imprint_number: string | null;
  artwork_thumb_url: string | null;
  production_due_date: string;
  station: string | null;
  quantity: number;
  step_statuses: Record<string, string>;
  priority_order: number;
  customer_name: string | null;
  quote_number: string | null;
  created_at: string;
  updated_at: string;
  garment_front_image_url?: string;
  // Two hard-coded scheduler status columns
  stock_status?: 'none' | 'ordered' | 'partial' | 'received';
  art_status?: 'pending' | 'approved' | 'rejected' | 'none';
}

interface WorkflowStep {
  id: string;
  step_name: string;
  step_color: string;
  step_order: number;
  statuses: Array<{
    status_name: string;
    status_color: string;
    is_default: boolean;
  }>;
}

interface SchedulerTab {
  id: string;
  tab_name: string;
  is_public: boolean;
  filters: FilterConfig;
  sort_config: any;
  tab_order: number;
  user_id: string | null;
}

interface FilterConfig {
  startDate?: string;
  endDate?: string;
  stationFilter?: string;
  customerFilter?: string;
  stepStatusFilters?: Record<string, string[]>;
}

interface ProductionSchedulerProps {
  typeOfWork: string;
  onNavigateToWorkOrder?: (workOrderId: string) => void;
}

export default function ProductionScheduler({ typeOfWork, onNavigateToWorkOrder }: ProductionSchedulerProps) {
  const { user, companySettings } = useAuth();
  const { canAccess } = useSubscription();

  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{ entryId: string; field: string } | null>(null);
  const [previewArtwork, setPreviewArtwork] = useState<string | null>(null);

  // Tab management
  const [activeTab, setActiveTab] = useState<SchedulerTab | null>(null);

  const companyId = companySettings?.id || null;

  // Filters
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfWeek(addDays(new Date(), 14)), 'yyyy-MM-dd'));
  const [stationFilter, setStationFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [stepStatusFilters, setStepStatusFilters] = useState<Record<string, string[]>>({});
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);

  // Stations from database
  const [availableStations, setAvailableStations] = useState<Array<{ id: string; station_name: string }>>([]);

  const loadWorkflowSteps = async () => {
    setLoading(true);
    try {
      const { data: typeData } = await supabase
        .from('type_of_work_settings')
        .select('id')
        .eq('work_type_name', typeOfWork)
        .maybeSingle();

      if (typeData) {
        const { data: workflow } = await supabase
          .from('work_type_workflows')
          .select('steps')
          .eq('work_type_id', typeData.id)
          .maybeSingle();

        if (workflow && workflow.steps) {
          const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
          setWorkflowSteps(steps.map((step: any, index: number) => ({
            id: step.step_name,
            step_name: step.step_name,
            step_color: step.statuses?.[0]?.color || '#6B7280',
            step_order: index,
            statuses: (step.statuses || []).map((status: any) => ({
              status_name: status.name,
              status_color: status.color,
              is_default: status.is_default || false,
            })),
          })));
        } else {
          setWorkflowSteps([]);
          setLoading(false);
        }

        // Load stations for this work type
        const { data: stationsData } = await supabase
          .from('production_stations')
          .select('id, station_name')
          .eq('work_type_id', typeData.id)
          .eq('is_active', true)
          .order('display_order');

        if (stationsData) {
          setAvailableStations(stationsData);
        }
      } else {
        setWorkflowSteps([]);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading workflow steps:', error);
      setLoading(false);
    }
  };

  const loadScheduleEntries = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('production_schedule_entries')
        .select('*')
        .eq('type_of_work', typeOfWork)
        .gte('production_due_date', startDate)
        .lte('production_due_date', endDate)
        .order('quote_number', { ascending: true })
        .order('imprint_number', { ascending: true });

      if (stationFilter) {
        query = query.eq('station', stationFilter);
      }

      if (customerFilter) {
        query = query.ilike('customer_name', `%${customerFilter}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      let entriesData = data || [];
      
      // Fetch garment images mapped to line_item_id
      const lineItemIds = Array.from(new Set(entriesData.map(e => e.line_item_id).filter(Boolean))) as string[];
      if (lineItemIds.length > 0) {
        const { data: lineItems } = await supabase
          .from('quote_line_items')
          .select('id, garment_front_image_url')
          .in('id', lineItemIds);
          
        if (lineItems) {
          const garmentMap = new Map(lineItems.map(li => [li.id, li.garment_front_image_url]));
          entriesData = entriesData.map(e => ({
            ...e,
            garment_front_image_url: e.line_item_id ? garmentMap.get(e.line_item_id) : undefined
          }));
        }
      }

      setEntries(entriesData);

      // ── Enrich: Stock Status + Art Status ────────────────────────────────
      const uniqueQuoteIds = [...new Set(entriesData.map((e: any) => e.quote_id).filter(Boolean))] as string[];
      if (uniqueQuoteIds.length > 0) {
        // Staging: determine if garments are ordered / partially ordered
        const { data: stagingRows } = await supabase
          .from('garment_requirements_staging')
          .select('quote_id, is_ordered, total_quantity')
          .in('quote_id', uniqueQuoteIds);

        // PO receiving: check how many units received per quote
        const { data: poReceived } = await supabase
          .from('purchase_order_line_items')
          .select('quantity_received, purchase_orders!inner(quote_id)')
          .not('purchase_orders.quote_id', 'is', null)
          .in('purchase_orders.quote_id', uniqueQuoteIds);

        // Art status: from quote approval
        const { data: quotesData } = await supabase
          .from('quotes')
          .select('id, artwork_approval_status')
          .in('id', uniqueQuoteIds);

        // Build stock_status per quote
        const stockMap = new Map<string, 'none' | 'ordered' | 'partial' | 'received'>();
        if (stagingRows && stagingRows.length > 0) {
          const byQuote = new Map<string, { ordered: number; total: number; needed: number }>();
          stagingRows.forEach((s: any) => {
            if (!byQuote.has(s.quote_id)) byQuote.set(s.quote_id, { ordered: 0, total: 0, needed: 0 });
            const q = byQuote.get(s.quote_id)!;
            if (s.is_ordered) q.ordered += 1;
            q.total += 1;
            q.needed += s.total_quantity || 0;
          });

          // Add received quantities
          const receivedByQuote = new Map<string, number>();
          poReceived?.forEach((r: any) => {
            const qid = r.purchase_orders?.quote_id;
            if (qid) receivedByQuote.set(qid, (receivedByQuote.get(qid) || 0) + (r.quantity_received || 0));
          });

          byQuote.forEach((val, qid) => {
            const received = receivedByQuote.get(qid) || 0;
            if (val.needed > 0 && received >= val.needed) {
              stockMap.set(qid, 'received');
            } else if (val.ordered === val.total && val.total > 0) {
              stockMap.set(qid, 'ordered');
            } else if (val.ordered > 0) {
              stockMap.set(qid, 'partial');
            } else {
              stockMap.set(qid, 'none');
            }
          });
        }

        // Build art_status per quote
        const artMap = new Map<string, 'pending' | 'approved' | 'rejected' | 'none'>();
        quotesData?.forEach((q: any) => {
          if (q.artwork_approval_status === 'approved') artMap.set(q.id, 'approved');
          else if (q.artwork_approval_status === 'declined') artMap.set(q.id, 'rejected');
          else if (q.artwork_approval_status === 'not_applicable' || !q.artwork_approval_status) artMap.set(q.id, 'none');
          else artMap.set(q.id, 'pending');
        });

        const enriched = entriesData.map((e: any) => ({
          ...e,
          stock_status: e.quote_id ? (stockMap.get(e.quote_id) ?? 'none') : 'none',
          art_status: e.quote_id ? (artMap.get(e.quote_id) ?? 'none') : 'none',
        }));
        setEntries(enriched);
      }
    } catch (error) {
      console.error('Error loading schedule entries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [typeOfWork, startDate, endDate, stationFilter, customerFilter]);

  useEffect(() => {
    loadWorkflowSteps();
  }, [typeOfWork]);

  // Close column menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openColumnMenu) {
        setOpenColumnMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openColumnMenu]);

  useEffect(() => {
    if (workflowSteps.length > 0) {
      const timer = setTimeout(() => {
        loadScheduleEntries();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [workflowSteps.length, loadScheduleEntries]);

  // Apply tab filters when tab is selected
  useEffect(() => {
    if (activeTab && activeTab.filters) {
      if (activeTab.filters.startDate) setStartDate(activeTab.filters.startDate);
      if (activeTab.filters.endDate) setEndDate(activeTab.filters.endDate);
      if (activeTab.filters.stationFilter !== undefined) setStationFilter(activeTab.filters.stationFilter);
      if (activeTab.filters.customerFilter !== undefined) setCustomerFilter(activeTab.filters.customerFilter);
      if (activeTab.filters.stepStatusFilters) setStepStatusFilters(activeTab.filters.stepStatusFilters);
    }
  }, [activeTab]);

  const handleTabSelect = (tab: SchedulerTab | null) => {
    setActiveTab(tab);
    if (tab === null) {
      setStartDate(format(startOfWeek(new Date()), 'yyyy-MM-dd'));
      setEndDate(format(endOfWeek(addDays(new Date(), 14)), 'yyyy-MM-dd'));
      setStationFilter('');
      setCustomerFilter('');
      setStepStatusFilters({});
    }
  };

  const currentFilters: FilterConfig = {
    startDate,
    endDate,
    stationFilter,
    customerFilter,
    stepStatusFilters,
  };

  const saveFiltersToActiveTab = async () => {
    if (!activeTab) return;

    try {
      const { error } = await supabase
        .from('scheduler_tabs')
        .update({ filters: currentFilters })
        .eq('id', activeTab.id);

      if (error) throw error;

      setActiveTab({ ...activeTab, filters: currentFilters });
    } catch (error) {
      console.error('Error saving filters to tab:', error);
    }
  };

  const updateEntry = async (entryId: string, updates: Partial<ScheduleEntry>) => {
    try {
      console.log('Updating entry:', entryId, 'with updates:', updates);

      const { data, error } = await supabase
        .from('production_schedule_entries')
        .update(updates)
        .eq('id', entryId)
        .select()
        .single();

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      if (data) {
        console.log('Update successful, new data:', data);
        setEntries(prev => prev.map(e => e.id === entryId ? data : e));
      }
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('Failed to update entry. Please try again.');
    }
  };

  const handleStatusChange = async (entryId: string, stepId: string, newStatus: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const updatedStatuses = {
      ...entry.step_statuses,
      [stepId]: newStatus,
    };

    // Update the database first
    await updateEntry(entryId, { step_statuses: updatedStatuses });

    // Trigger automation if companyId exists
    if (companyId) {
      try {
        console.log('Queuing automation for work step status change:', { stepId, newStatus });
        
        // Use the database function to find all matching automations and queue them
        // This is better than direct insert because it handles the logic of matching rules
        const { error: rpcError } = await supabase.rpc('queue_matching_automations', {
          p_company_id: companyId,
          p_trigger_type: 'work_step_status_changed',
          p_trigger_data: {
            step_name: stepId,
            status: newStatus,
            quote_id: entry.quote_id,
            work_order_id: entry.work_order_id,
            quote_number: entry.quote_number,
            customer_name: entry.customer_name,
            type_of_work: entry.type_of_work,
            station: entry.station,
            imprint_number: entry.imprint_number,
            quantity: entry.quantity,
            new_status: newStatus, // added for compatibility with standard conditions
            changed_at: new Date().toISOString()
          }
        });

        if (rpcError) throw rpcError;
      } catch (err) {
        console.error('Failed to trigger automation:', err);
      }
    }

    setEditingCell(null);
  };

  const handleStationChange = (entryId: string, newStation: string) => {
    updateEntry(entryId, { station: newStation });
    setEditingCell(null);
  };

  const handleDateChange = (entryId: string, newDate: string) => {
    updateEntry(entryId, { production_due_date: newDate });
    setEditingCell(null);
  };

  const getStatusColor = (stepId: string, statusName: string) => {
    const step = workflowSteps.find(s => s.id === stepId);
    const status = step?.statuses.find(s => s.status_name === statusName);
    return status?.status_color || '#6B7280';
  };

  // Quick week range helper
  const setWeekRange = (offset: -1 | 0 | 1) => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    setStartDate(monday.toISOString().split('T')[0]);
    setEndDate(sunday.toISOString().split('T')[0]);
  };

  // Apply column filters to entries
  // Uses the same status-resolution logic as the display (step_statuses || default || 'Not Started')
  // so filtering by 'Not Started' correctly catches entries whose status was never explicitly set.
  const filteredEntries = useMemo(() => {
    const activeFilters = Object.entries(stepStatusFilters).filter(([_, v]) => v.length > 0);
    if (activeFilters.length === 0) return entries;

    return entries.filter(entry => {
      for (const [stepId, statuses] of activeFilters) {
        const step = workflowSteps.find(s => s.id === stepId);
        const defaultStatus = step?.statuses.find(s => s.is_default)?.status_name || 'Not Started';
        const entryStatus = entry.step_statuses[stepId] || defaultStatus;
        if (!statuses.includes(entryStatus)) return false;
      }
      return true;
    });
  }, [entries, stepStatusFilters, workflowSteps]);

  if (loading && workflowSteps.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-green-600 dark:text-green-400 animate-spin" />
      </div>
    );
  }

  if (!canAccess('production_scheduler')) {
    return (
      <UpgradeWall 
        title="Production Scheduler" 
        description="Get full spreadsheet-style scheduling, station assignments, custom workflows, and deep filters." 
        icon={CalendarDays} 
      />
    );
  }

  if (workflowSteps.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
        <CalendarDays className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Workflow Steps</h3>
        <p className="text-gray-600 dark:text-gray-400">Configure workflow steps for {typeOfWork} in Settings to use the scheduler</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      {companyId && user?.id && (
        <div className="mb-4">
          <SchedulerTabManager
            typeOfWork={typeOfWork}
            companyId={companyId}
            userId={user.id}
            currentFilters={currentFilters}
            onSelectTab={handleTabSelect}
            activeTabId={activeTab?.id || null}
          />
        </div>
      )}

      {/* Header and Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {typeOfWork} Schedule
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Week quick-filters */}
          <div className="flex items-center gap-1 border border-gray-300 dark:border-slate-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setWeekRange(-1)}
              className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border-r border-gray-300 dark:border-slate-600"
            >
              Last Week
            </button>
            <button
              onClick={() => setWeekRange(0)}
              className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border-r border-gray-300 dark:border-slate-600"
            >
              This Week
            </button>
            <button
              onClick={() => setWeekRange(1)}
              className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Next Week
            </button>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={loadScheduleEntries}
            className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Station
              </label>
              <select
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              >
                <option value="">All Stations</option>
                {availableStations.map(station => (
                  <option key={station.id} value={station.station_name}>{station.station_name}</option>
                ))}
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
        </div>
      )}

      {/* Schedule Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                  Artwork
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Imprint #
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Quote #
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Prod Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Station
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Qty
                </th>
                {/* 2 hard-coded status columns — Stock Status then Art Status, after Qty */}
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap bg-blue-50/50 dark:bg-blue-900/10">
                  <div>Stock Status</div>
                  <div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Ordered / Partial / Received</div>
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap bg-purple-50/50 dark:bg-purple-900/10">
                  <div>Art Status</div>
                  <div className="text-[10px] font-normal normal-case text-gray-400 mt-0.5">Approved / Rejected</div>
                </th>
                {workflowSteps.map(step => (
                  <th key={step.id} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider relative">
                    <div className="flex items-center justify-between gap-2">
                      <span>{step.step_name}</span>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenColumnMenu(openColumnMenu === step.id ? null : step.id);
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors relative"
                          title="Filter column"
                        >
                          <Menu className="w-4 h-4" />
                          {(stepStatusFilters[step.id]?.length || 0) > 0 && (
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-600 rounded-full" />
                          )}
                        </button>
                        {openColumnMenu === step.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[200px]"
                          >
                            <div className="p-3 border-b border-gray-200 dark:border-slate-700">
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                Filter by Status
                              </div>
                              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                {step.statuses.map(status => {
                                  const isSelected = stepStatusFilters[step.id]?.includes(status.status_name);
                                  return (
                                    <label
                                      key={status.status_name}
                                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          const currentFilters = stepStatusFilters[step.id] || [];
                                          const newFilters = e.target.checked
                                            ? [...currentFilters, status.status_name]
                                            : currentFilters.filter(s => s !== status.status_name);

                                          setStepStatusFilters(prev => ({
                                            ...prev,
                                            [step.id]: newFilters,
                                          }));
                                        }}
                                        className="rounded"
                                      />
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: status.status_color }}
                                      />
                                      <span className="text-xs text-gray-900 dark:text-white">
                                        {status.status_name}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="p-2 flex gap-2">
                              <button
                                onClick={() => {
                                  setStepStatusFilters(prev => ({
                                    ...prev,
                                    [step.id]: [],
                                  }));
                                }}
                                className="flex-1 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                              >
                                Clear
                              </button>
                              <button
                                onClick={() => {
                                  setOpenColumnMenu(null);
                                  if (activeTab) {
                                    saveFiltersToActiveTab();
                                  }
                                }}
                                className="flex-1 px-2 py-1 text-xs bg-green-600 text-white hover:bg-green-700 rounded"
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9 + workflowSteps.length} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-8 h-8 text-green-600 dark:text-green-400 animate-spin" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Loading schedule...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={9 + workflowSteps.length} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No scheduled jobs matching filters
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <td className="px-3 py-3">
                      {entry.artwork_thumb_url ? (
                        <button
                          onClick={() => setPreviewArtwork(entry.artwork_thumb_url)}
                          className="block hover:opacity-75 transition-opacity"
                          title="Click to preview artwork"
                        >
                          <img
                            src={entry.artwork_thumb_url}
                            alt="Artwork"
                            className="w-10 h-10 object-cover rounded border border-gray-200 dark:border-slate-600 cursor-pointer"
                          />
                        </button>
                      ) : entry.garment_front_image_url ? (
                        <button
                          onClick={() => setPreviewArtwork(entry.garment_front_image_url!)}
                          className="block hover:opacity-75 transition-opacity"
                          title="Click to preview garment"
                        >
                          <img
                            src={entry.garment_front_image_url}
                            alt="Garment"
                            className="w-10 h-10 object-cover rounded border border-gray-200 dark:border-slate-600 bg-white cursor-pointer"
                          />
                        </button>
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 flex items-center justify-center">
                          <span className="text-xs text-gray-400">No img</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm font-medium">
                      {entry.imprint_number ? (
                        entry.work_order_id && onNavigateToWorkOrder ? (
                          <button
                            onClick={() => onNavigateToWorkOrder(entry.work_order_id!)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors"
                          >
                            {entry.imprint_number.replace(/^QTE-/, '')}
                          </button>
                        ) : (
                          <span className="text-gray-900 dark:text-white">{entry.imprint_number.replace(/^QTE-/, '')}</span>
                        )
                      ) : '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-white">
                      {entry.customer_name || '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-white">
                      {entry.quote_number || '-'}
                    </td>
                    <td className="px-3 py-3">
                      {editingCell?.entryId === entry.id && editingCell?.field === 'prod_date' ? (
                        <input
                          type="date"
                          value={entry.production_due_date}
                          onChange={(e) => {
                            handleDateChange(entry.id, e.target.value);
                          }}
                          autoFocus
                          className="w-full px-2 py-1 text-sm border border-green-500 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingCell({ entryId: entry.id, field: 'prod_date' })}
                          className="text-sm text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400"
                        >
                          {format(parseISO(entry.production_due_date), 'MMM d, yyyy')}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {editingCell?.entryId === entry.id && editingCell?.field === 'station' ? (
                        <select
                          value={entry.station || ''}
                          onChange={(e) => {
                            handleStationChange(entry.id, e.target.value);
                          }}
                          autoFocus
                          className="w-full px-2 py-1 text-sm border border-green-500 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                        >
                          <option value="">Select station</option>
                          {availableStations.map(station => (
                            <option key={station.id} value={station.station_name}>
                              {station.station_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingCell({ entryId: entry.id, field: 'station' })}
                          className="text-sm text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400"
                        >
                          {entry.station || 'Set station'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-white">
                      {entry.quantity}
                    </td>
                    {/* Stock Status — FIRST hard-coded status column */}
                    <td className="px-3 py-3 text-center bg-blue-50/30 dark:bg-blue-900/5">
                      {entry.stock_status === 'received' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded-full whitespace-nowrap">
                          <CheckCircle className="w-3 h-3" />Received
                        </span>
                      ) : entry.stock_status === 'ordered' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-full whitespace-nowrap">
                          <CheckCircle className="w-3 h-3" />Ordered
                        </span>
                      ) : entry.stock_status === 'partial' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-full whitespace-nowrap">
                          <Clock className="w-3 h-3" />Partial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 rounded-full whitespace-nowrap">
                          <Clock className="w-3 h-3" />—
                        </span>
                      )}
                    </td>
                    {/* Art Status — SECOND hard-coded status column */}
                    <td className="px-3 py-3 text-center bg-purple-50/30 dark:bg-purple-900/5">
                      {entry.art_status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded-full whitespace-nowrap">
                          <CheckCircle className="w-3 h-3" />Approved
                        </span>
                      ) : entry.art_status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-full whitespace-nowrap">
                          <X className="w-3 h-3" />Rejected
                        </span>
                      ) : entry.art_status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20 rounded-full whitespace-nowrap">
                          <Clock className="w-3 h-3" />Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 rounded-full whitespace-nowrap">
                          —
                        </span>
                      )}
                    </td>
                    {workflowSteps.map(step => {
                      const currentStatus = entry.step_statuses[step.id] || step.statuses.find(s => s.is_default)?.status_name || 'Not Started';
                      const statusColor = getStatusColor(step.id, currentStatus);

                      return (
                        <td key={step.id} className="px-3 py-3">
                          {editingCell?.entryId === entry.id && editingCell?.field === step.id ? (
                            <select
                              value={currentStatus}
                              onChange={(e) => {
                                handleStatusChange(entry.id, step.id, e.target.value);
                              }}
                              autoFocus
                              className="w-full px-2 py-1 text-sm border border-green-500 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                            >
                              {step.statuses.map(status => (
                                <option key={status.status_name} value={status.status_name}>
                                  {status.status_name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingCell({ entryId: entry.id, field: step.id })}
                              className="px-2 py-1 text-xs font-medium rounded-full"
                              style={{
                                backgroundColor: `${statusColor}20`,
                                color: statusColor,
                                border: `1px solid ${statusColor}40`,
                              }}
                            >
                              {currentStatus}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Entry Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredEntries.length}{filteredEntries.length !== entries.length ? ` of ${entries.length}` : ''} scheduled {entries.length === 1 ? 'job' : 'jobs'}
      </div>

      {/* Artwork Preview Modal */}
      {previewArtwork && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewArtwork(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-lg p-4">
            <button
              onClick={() => setPreviewArtwork(null)}
              className="absolute top-2 right-2 p-2 bg-gray-900 bg-opacity-50 hover:bg-opacity-75 text-white rounded-full transition-colors"
              title="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewArtwork}
              alt="Artwork Preview"
              className="max-w-full max-h-[calc(90vh-2rem)] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
