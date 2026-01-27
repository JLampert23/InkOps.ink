import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, Filter, GripVertical, Save, X, Plus, Search, RefreshCw, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';
import SchedulerTabManager from './SchedulerTabManager';
import { useAuth } from '../../contexts/AuthContext';

interface ScheduleEntry {
  id: string;
  company_id: string;
  quote_id: string | null;
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
}

export default function ProductionScheduler({ typeOfWork }: ProductionSchedulerProps) {
  const { user, companySettings } = useAuth();
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedEntry, setDraggedEntry] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ entryId: string; field: string } | null>(null);

  // Tab management
  const [activeTab, setActiveTab] = useState<SchedulerTab | null>(null);

  const companyId = companySettings?.company_id || null;

  // Filters
  const [startDate, setStartDate] = useState(format(startOfWeek(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfWeek(addDays(new Date(), 14)), 'yyyy-MM-dd'));
  const [stationFilter, setStationFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Stations from database
  const [availableStations, setAvailableStations] = useState<Array<{ id: string; station_name: string }>>([]);

  const loadWorkflowSteps = async () => {
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
      }
    } catch (error) {
      console.error('Error loading workflow steps:', error);
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
        .order('production_due_date', { ascending: true })
        .order('priority_order', { ascending: true });

      if (stationFilter) {
        query = query.eq('station', stationFilter);
      }

      if (customerFilter) {
        query = query.ilike('customer_name', `%${customerFilter}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setEntries(data || []);
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
    }
  }, [activeTab]);

  const handleTabSelect = (tab: SchedulerTab | null) => {
    setActiveTab(tab);
    if (tab === null) {
      setStartDate(format(startOfWeek(new Date()), 'yyyy-MM-dd'));
      setEndDate(format(endOfWeek(addDays(new Date(), 14)), 'yyyy-MM-dd'));
      setStationFilter('');
      setCustomerFilter('');
    }
  };

  const currentFilters: FilterConfig = {
    startDate,
    endDate,
    stationFilter,
    customerFilter,
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

  const handleDragStart = (e: React.DragEvent, entryId: string) => {
    setDraggedEntry(entryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDate: string, targetStation?: string) => {
    e.preventDefault();

    if (!draggedEntry) return;

    const updates: Partial<ScheduleEntry> = {
      production_due_date: targetDate,
    };

    if (targetStation !== undefined) {
      updates.station = targetStation;
    }

    updateEntry(draggedEntry, updates);
    setDraggedEntry(null);
  };

  const handleStatusChange = (entryId: string, stepId: string, newStatus: string) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const updatedStatuses = {
      ...entry.step_statuses,
      [stepId]: newStatus,
    };

    updateEntry(entryId, { step_statuses: updatedStatuses });
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

  const handleDragEnd = (e: React.DragEvent, targetEntryId: string) => {
    e.preventDefault();

    if (!draggedEntry || draggedEntry === targetEntryId) {
      setDraggedEntry(null);
      return;
    }

    const draggedIndex = entries.findIndex(e => e.id === draggedEntry);
    const targetIndex = entries.findIndex(e => e.id === targetEntryId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedEntry(null);
      return;
    }

    const draggedItem = entries[draggedIndex];
    const targetItem = entries[targetIndex];

    updateEntry(draggedEntry, { priority_order: targetItem.priority_order });
    updateEntry(targetEntryId, { priority_order: draggedItem.priority_order });

    setDraggedEntry(null);
  };

  const getStatusColor = (stepId: string, statusName: string) => {
    const step = workflowSteps.find(s => s.id === stepId);
    const status = step?.statuses.find(s => s.status_name === statusName);
    return status?.status_color || '#6B7280';
  };

  if (loading && workflowSteps.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-green-600 dark:text-green-400 animate-spin" />
      </div>
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {typeOfWork} Schedule
        </h3>
        <div className="flex items-center gap-2">
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
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8">
                  {/* Drag handle */}
                </th>
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
                {workflowSteps.map(step => (
                  <th key={step.id} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {step.step_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8 + workflowSteps.length} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-8 h-8 text-green-600 dark:text-green-400 animate-spin" />
                      <span className="text-sm text-gray-500 dark:text-gray-400">Loading schedule...</span>
                    </div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8 + workflowSteps.length} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No scheduled jobs for this time period
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, entry.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDragEnd(e, entry.id)}
                    className={`hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                      draggedEntry === entry.id ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-3 py-3">
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                    </td>
                    <td className="px-3 py-3">
                      {entry.artwork_thumb_url ? (
                        <img
                          src={entry.artwork_thumb_url}
                          alt="Artwork"
                          className="w-10 h-10 object-cover rounded border border-gray-200 dark:border-slate-600"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded border border-gray-200 dark:border-slate-600 flex items-center justify-center">
                          <span className="text-xs text-gray-400">No img</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-white font-medium">
                      {entry.imprint_number || '-'}
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
        Showing {entries.length} scheduled {entries.length === 1 ? 'job' : 'jobs'}
      </div>
    </div>
  );
}
