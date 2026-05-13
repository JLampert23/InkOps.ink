import { Fragment, useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, CalendarDays, Loader2, AlertCircle, CheckCircle, X, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { format, parseISO } from 'date-fns';

interface ScheduleEntry {
  id: string;
  work_order_id: string | null;
  quote_id: string | null;
  imprint_id: string | null;
  imprint_number: string | null;
  customer_name: string | null;
  quote_number: string | null;
  type_of_work: string;
  production_due_date: string;
  line_item_id: string | null;
  quantity: number;
  step_statuses: Record<string, string>;
  priority_order: number;
  artwork_thumb_url: string | null;
  is_on_master_schedule: boolean;
  stock_status?: 'none' | 'ordered' | 'partial' | 'received';
  art_status?: 'pending' | 'approved' | 'rejected' | 'none';
  // 2026-05-13 — line item group label from quote_line_items. Lets us
  // group imprints in Master by group within a WO, since different groups
  // can carry different artwork.
  group_label?: string;
}

interface WorkOrderInfo {
  id: string;
  work_order_number: string | null;
  status: string | null;
  customer_name: string | null;
  production_due_date: string | null;
  total_quantity: number | null;
}

interface StepStatus {
  status_name: string;
  status_color: string;
  is_default: boolean;
}

interface WorkflowStep {
  id: string;
  step_name: string;
  statuses: StepStatus[];
}

interface MasterScheduleProps {
  onNavigateToWorkOrder?: (workOrderId: string) => void;
}

// 2026-05-13 redesign per client feedback (image walk-through):
//  - Stock + Art status pulled OUT of the expanded view and shown as
//    columns on the WO row itself.
//  - Priority column removed (was a duplicate of the per-row tag).
//  - Expanded view shows ONE row per type_of_work (not per imprint). All
//    Screen Print imprints on a quote collapse into a single "Screen Print"
//    row so admin changes the status once, not N times.
//  - Step pills laid out like the per-type Scheduler tab (step name in
//    small caps, status pill next to it).
//  - "Production Status" step is hidden on Master (it's set by the
//    production floor on the per-type tab, not here).
export default function MasterSchedule({ onNavigateToWorkOrder }: MasterScheduleProps) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [workOrders, setWorkOrders] = useState<Record<string, WorkOrderInfo>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [scheduling, setScheduling] = useState<Record<string, boolean>>({});
  const [workflowsByType, setWorkflowsByType] = useState<Record<string, WorkflowStep[]>>({});
  const [editingCell, setEditingCell] = useState<{ groupKey: string; stepId: string } | null>(null);
  // 2026-05-13 — when admin clicks Schedule, prompt for the production date
  // before moving the group off master. Modal carries the (woKey, groupLabel,
  // typeOfWork) the action targets + the pre-filled default date.
  const [scheduleModal, setScheduleModal] = useState<{
    woKey: string;
    groupLabel: string;
    typeOfWork: string;
    woNumber: string;
    defaultDate: string;
  } | null>(null);
  const [scheduleDateInput, setScheduleDateInput] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setEntries([]);
        return;
      }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();
      if (!profile?.company_id) {
        setEntries([]);
        return;
      }

      const { data: entriesData } = await supabase
        .from('production_schedule_entries')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_on_master_schedule', true)
        .order('production_due_date', { ascending: true })
        .order('priority_order', { ascending: true });

      const rawList: ScheduleEntry[] = entriesData || [];

      // Fetch group_label per line_item_id — used to group imprints in the
      // expanded view by line-item-group (client 2026-05-13).
      const lineItemIds = [...new Set(rawList.map(e => e.line_item_id).filter(Boolean))] as string[];
      const groupLabelByLineItem = new Map<string, string>();
      if (lineItemIds.length > 0) {
        const { data: lineItems } = await supabase
          .from('quote_line_items')
          .select('id, group_label')
          .in('id', lineItemIds);
        (lineItems || []).forEach((li: any) => {
          groupLabelByLineItem.set(li.id, (li.group_label || '').trim());
        });
      }

      // Enrich with stock_status + art_status (same semantics as
      // ProductionScheduler).
      const uniqueQuoteIds = [...new Set(rawList.map(e => e.quote_id).filter(Boolean))] as string[];
      const stockMap = new Map<string, 'none' | 'ordered' | 'partial' | 'received'>();
      const artMap = new Map<string, 'pending' | 'approved' | 'rejected' | 'none'>();
      if (uniqueQuoteIds.length > 0) {
        const { data: stagingRows } = await supabase
          .from('garment_requirements_staging')
          .select('quote_id, is_ordered, total_quantity, quantity_received')
          .in('quote_id', uniqueQuoteIds);

        const { data: poReceived } = await supabase
          .from('purchase_order_line_items')
          .select('quantity_received, purchase_orders!inner(quote_id)')
          .not('purchase_orders.quote_id', 'is', null)
          .in('purchase_orders.quote_id', uniqueQuoteIds);

        const { data: quotesData } = await supabase
          .from('quotes')
          .select('id, artwork_approval_status')
          .in('id', uniqueQuoteIds);

        if (stagingRows && stagingRows.length > 0) {
          const byQuote = new Map<string, { ordered: number; total: number; needed: number; stagingReceived: number }>();
          stagingRows.forEach((s: any) => {
            if (!byQuote.has(s.quote_id)) {
              byQuote.set(s.quote_id, { ordered: 0, total: 0, needed: 0, stagingReceived: 0 });
            }
            const q = byQuote.get(s.quote_id)!;
            if (s.is_ordered) q.ordered += 1;
            q.total += 1;
            q.needed += s.total_quantity || 0;
            q.stagingReceived += s.quantity_received || 0;
          });
          const poReceivedByQuote = new Map<string, number>();
          poReceived?.forEach((r: any) => {
            const qid = r.purchase_orders?.quote_id;
            if (qid) poReceivedByQuote.set(qid, (poReceivedByQuote.get(qid) || 0) + (r.quantity_received || 0));
          });
          byQuote.forEach((val, qid) => {
            const totalReceived = val.stagingReceived + (poReceivedByQuote.get(qid) || 0);
            const allOrdered = val.ordered === val.total && val.total > 0;
            const someOrdered = val.ordered > 0;
            if (val.needed > 0 && totalReceived >= val.needed) stockMap.set(qid, 'received');
            else if (totalReceived > 0) stockMap.set(qid, 'partial');
            else if (allOrdered || someOrdered) stockMap.set(qid, 'ordered');
            else stockMap.set(qid, 'none');
          });
        }

        quotesData?.forEach((q: any) => {
          if (q.artwork_approval_status === 'approved') artMap.set(q.id, 'approved');
          else if (q.artwork_approval_status === 'declined') artMap.set(q.id, 'rejected');
          else if (q.artwork_approval_status === 'not_applicable' || !q.artwork_approval_status) artMap.set(q.id, 'none');
          else artMap.set(q.id, 'pending');
        });
      }

      const list: ScheduleEntry[] = rawList.map(e => ({
        ...e,
        stock_status: e.quote_id ? (stockMap.get(e.quote_id) ?? 'none') : 'none',
        art_status: e.quote_id ? (artMap.get(e.quote_id) ?? 'none') : 'none',
        group_label: e.line_item_id ? (groupLabelByLineItem.get(e.line_item_id) || '') : '',
      }));
      setEntries(list);

      // Load workflow steps for every distinct type_of_work present.
      const uniqueTypes = [...new Set(list.map(e => e.type_of_work).filter(Boolean))];
      if (uniqueTypes.length > 0) {
        const { data: typeRows } = await supabase
          .from('type_of_work_settings')
          .select('id, work_type_name')
          .in('work_type_name', uniqueTypes);
        const typeIds = (typeRows || []).map(t => t.id);
        const typeIdToName: Record<string, string> = {};
        (typeRows || []).forEach(t => { typeIdToName[t.id] = t.work_type_name; });

        const wfByType: Record<string, WorkflowStep[]> = {};
        if (typeIds.length > 0) {
          const { data: workflows } = await supabase
            .from('work_type_workflows')
            .select('work_type_id, steps')
            .in('work_type_id', typeIds);
          (workflows || []).forEach((wf: any) => {
            const name = typeIdToName[wf.work_type_id];
            if (!name) return;
            const stepArr = Array.isArray(wf.steps) ? wf.steps : [];
            wfByType[name] = stepArr.map((step: any) => ({
              id: step.step_name,
              step_name: step.step_name,
              statuses: (step.statuses || []).map((s: any) => ({
                status_name: s.name,
                status_color: s.color,
                is_default: s.is_default || false,
              })),
            }));
          });
        }
        setWorkflowsByType(wfByType);
      }

      // Pull WO summaries (no priority/custom_invoice_status — removed
      // from master per client 2026-05-13).
      const woIds = [...new Set(list.map(e => e.work_order_id).filter(Boolean))] as string[];
      if (woIds.length > 0) {
        const { data: wos } = await supabase
          .from('work_orders')
          .select('id, work_order_number, status, customer_name, production_due_date, total_quantity')
          .in('id', woIds);
        const map: Record<string, WorkOrderInfo> = {};
        (wos || []).forEach((wo: any) => { map[wo.id] = wo; });
        setWorkOrders(map);
      }
    } catch (err) {
      console.error('MasterSchedule load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Write step status to ALL entries that share (work_order_id, group_label,
  // type_of_work). Per client 2026-05-13: "if there's a front and a back and
  // they're both screen printing I only have to change one status per type of
  // imprint" — extended to also keep different line-item groups independent
  // since "different line item groups can have different artwork".
  // The DB trigger enqueue_scheduler_step_status_automation handles
  // automation dispatch; do NOT also call queue_matching_automations here
  // (see ProductionScheduler.tsx for the 2026-05-08 email spam bug).
  const handleGroupStatusChange = async (groupKey: string, stepId: string, newStatus: string) => {
    const [woId, groupLabel, typeOfWork] = parseGroupKey(groupKey);
    const groupEntries = entries.filter(e =>
      (e.work_order_id || 'unassigned') === woId
      && (e.group_label || '') === groupLabel
      && e.type_of_work === typeOfWork
    );
    if (groupEntries.length === 0) return;

    const snapshot = groupEntries.map(e => ({ id: e.id, step_statuses: e.step_statuses }));

    setEntries(prev => prev.map(e => {
      if ((e.work_order_id || 'unassigned') === woId
        && (e.group_label || '') === groupLabel
        && e.type_of_work === typeOfWork) {
        return { ...e, step_statuses: { ...(e.step_statuses || {}), [stepId]: newStatus } };
      }
      return e;
    }));
    setEditingCell(null);

    try {
      // One UPDATE per entry — preserves each row's other-step values.
      await Promise.all(groupEntries.map(e =>
        supabase
          .from('production_schedule_entries')
          .update({ step_statuses: { ...(e.step_statuses || {}), [stepId]: newStatus } })
          .eq('id', e.id)
      ));
    } catch (err) {
      console.error('Failed to update group status:', err);
      // Revert
      setEntries(prev => prev.map(e => {
        const snap = snapshot.find(s => s.id === e.id);
        return snap ? { ...e, step_statuses: snap.step_statuses } : e;
      }));
      alert('Failed to update status. Please try again.');
    }
  };

  const getStatusColor = (steps: WorkflowStep[], stepId: string, statusName: string) => {
    const step = steps.find(s => s.id === stepId);
    const status = step?.statuses.find(s => s.status_name === statusName);
    return status?.status_color || '#6B7280';
  };

  const toggleExpand = (workOrderId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(workOrderId)) next.delete(workOrderId);
      else next.add(workOrderId);
      return next;
    });
  };

  // Open the schedule-date modal (client 2026-05-13: prompt for date when
  // Schedule is clicked instead of moving immediately).
  const openScheduleModal = (woKey: string, groupLabel: string, typeOfWork: string, woNumber: string) => {
    const groupEntries = entries.filter(e =>
      (e.work_order_id || 'unassigned') === woKey
      && (e.group_label || '') === groupLabel
      && e.type_of_work === typeOfWork
    );
    const defaultDate = groupEntries[0]?.production_due_date || format(new Date(), 'yyyy-MM-dd');
    setScheduleModal({ woKey, groupLabel, typeOfWork, woNumber, defaultDate });
    setScheduleDateInput(defaultDate);
  };

  // Confirm the schedule modal: write the chosen production_due_date to every
  // entry in (woKey, groupLabel, typeOfWork) and flip is_on_master_schedule
  // off so it leaves master and lands on its type tab on the chosen date.
  const confirmSchedule = async () => {
    if (!scheduleModal) return;
    const { woKey, groupLabel, typeOfWork } = scheduleModal;
    const groupEntries = entries.filter(e =>
      (e.work_order_id || 'unassigned') === woKey
      && (e.group_label || '') === groupLabel
      && e.type_of_work === typeOfWork
    );
    if (groupEntries.length === 0) {
      setScheduleModal(null);
      return;
    }
    if (!scheduleDateInput) {
      alert('Pick a production date first.');
      return;
    }

    const groupKey = makeGroupKey(woKey, groupLabel, typeOfWork);
    setScheduling(prev => ({ ...prev, [groupKey]: true }));
    try {
      const ids = groupEntries.map(e => e.id);
      const { error } = await supabase
        .from('production_schedule_entries')
        .update({
          is_on_master_schedule: false,
          production_due_date: scheduleDateInput,
        })
        .in('id', ids);
      if (error) throw error;
      setEntries(prev => prev.filter(e => !ids.includes(e.id)));
      setScheduleModal(null);
    } catch (err) {
      console.error('Failed to schedule group:', err);
      alert('Failed to schedule. Please try again.');
    } finally {
      setScheduling(prev => {
        const next = { ...prev };
        delete next[groupKey];
        return next;
      });
    }
  };

  // Group entries by WO. Within each WO, sub-group by type_of_work so the
  // expanded view shows one row per type, not per imprint.
  const grouped = entries.reduce((acc, entry) => {
    const key = entry.work_order_id || 'unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {} as Record<string, ScheduleEntry[]>);

  const groupedKeys = Object.keys(grouped);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading master schedule…</p>
      </div>
    );
  }

  if (groupedKeys.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
        <CalendarDays className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Master schedule is empty</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Approved quotes land here automatically. Expand a work order to schedule its decorations.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Master Schedule</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            All work orders waiting to be scheduled. Click a row to expand its decoration types.
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-8"></th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Work Order</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Customer</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                <div>Stock Status</div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">Ordered / Partial / Received</div>
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">
                <div>Art Status</div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">Approved / Rejected</div>
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Total Qty</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Due</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Imprint Types</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400 w-16">Imprints</th>
            </tr>
          </thead>
          <tbody>
            {groupedKeys.map(woKey => {
              const groupEntries = grouped[woKey];
              const wo = woKey !== 'unassigned' ? workOrders[woKey] : undefined;
              const isExpanded = expanded.has(woKey);
              const woNumber = wo?.work_order_number || groupEntries[0]?.quote_number || 'Unassigned';
              const customer = wo?.customer_name || groupEntries[0]?.customer_name || '—';
              const totalQty = wo?.total_quantity ?? groupEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
              const dueDate = wo?.production_due_date || groupEntries[0]?.production_due_date || null;
              const woStock = aggregateStock(groupEntries);
              const woArt = aggregateArt(groupEntries);
              const imprintTypes = [...new Set(groupEntries.map(e => e.type_of_work))];

              // Sub-group entries by (group_label, type_of_work) for the
              // expanded view. Within each WO we get one row per
              // (line-item-group, decoration type). Per client 2026-05-13:
              // line item groups stay separate so artwork can differ.
              const subGroupMap = new Map<string, { groupLabel: string; type: string; items: ScheduleEntry[] }>();
              for (const e of groupEntries) {
                const gl = (e.group_label || '').trim();
                const t = e.type_of_work;
                const key = `${gl}::${t}`;
                if (!subGroupMap.has(key)) subGroupMap.set(key, { groupLabel: gl, type: t, items: [] });
                subGroupMap.get(key)!.items.push(e);
              }
              const byGroup = Array.from(subGroupMap.values()).sort((a, b) => {
                if (a.groupLabel !== b.groupLabel) return a.groupLabel.localeCompare(b.groupLabel);
                return a.type.localeCompare(b.type);
              });

              return (
                <Fragment key={woKey}>
                  <tr
                    className="border-t border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30 cursor-pointer"
                    onClick={() => toggleExpand(woKey)}
                  >
                    <td className="px-3 py-2.5">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (wo && onNavigateToWorkOrder) onNavigateToWorkOrder(wo.id);
                        }}
                        className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {woNumber}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{customer}</td>
                    <td className="px-3 py-2.5">
                      <StockStatusBadge status={woStock} />
                    </td>
                    <td className="px-3 py-2.5">
                      <ArtStatusBadge status={woArt} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-900 dark:text-white">{totalQty}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">
                      {dueDate ? format(parseISO(dueDate), 'MMM d') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {imprintTypes.map(t => (
                          <span
                            key={t}
                            className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-full whitespace-nowrap"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400">
                      {groupEntries.length}
                    </td>
                  </tr>

                  {/* Expanded: one row per (line-item-group, type_of_work).
                      All imprints of that combo share a single set of step
                      pills. Different line item groups stay separate per
                      client 2026-05-13 (so they can carry different art). */}
                  {isExpanded && byGroup.map(sub => {
                    const allSteps = workflowsByType[sub.type] || [];
                    // Hide "Production Status" — set on the production floor
                    // via the per-type Scheduler tab, not on Master.
                    const visibleSteps = allSteps.filter(s =>
                      s.step_name.trim().toLowerCase() !== 'production status'
                    );
                    const groupKey = makeGroupKey(woKey, sub.groupLabel, sub.type);
                    const isScheduling = !!scheduling[groupKey];
                    const totalGroupQty = sub.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
                    const imprintLabels = sub.items
                      .map(i => i.imprint_number)
                      .filter(Boolean)
                      .join(', ');

                    // The status displayed on the group row uses the first
                    // entry's value (all entries in the group are kept in
                    // sync via handleGroupStatusChange).
                    const representative = sub.items[0];
                    const groupLabelDisplay = sub.groupLabel || 'Default Group';

                    return (
                      <tr key={groupKey} className="border-t border-gray-100 dark:border-slate-800 bg-gray-50/40 dark:bg-slate-900/30">
                        <td className="px-3 py-3"></td>
                        <td colSpan={8} className="px-3 py-3">
                          <div className="flex flex-col gap-2">
                            {/* Header line: group, type, imprints, qty, schedule btn */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-baseline gap-3 min-w-0 flex-wrap">
                                <span className="inline-block w-3 text-gray-400">⤷</span>
                                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 rounded-full whitespace-nowrap">
                                  {groupLabelDisplay}
                                </span>
                                <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                                  {sub.type}
                                </span>
                                {imprintLabels && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {sub.items.length} imprint{sub.items.length === 1 ? '' : 's'}: {imprintLabels}
                                  </span>
                                )}
                                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  Qty {totalGroupQty}
                                </span>
                              </div>
                              <button
                                onClick={() => openScheduleModal(woKey, sub.groupLabel, sub.type, woNumber)}
                                disabled={isScheduling}
                                className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 whitespace-nowrap"
                                title={`Schedule ${groupLabelDisplay} · ${sub.type}`}
                              >
                                {isScheduling ? 'Moving…' : 'Schedule →'}
                              </button>
                            </div>

                            {/* Step pills — STEP NAME (small caps) + status
                                pill. One change updates every imprint in
                                this (group, type) bucket. Pill text is
                                gray-900 in light mode for readability
                                (client 2026-05-13). */}
                            {visibleSteps.length > 0 && (
                              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-6">
                                {visibleSteps.map(step => {
                                  const currentStatus = representative.step_statuses?.[step.id]
                                    || step.statuses.find(s => s.is_default)?.status_name
                                    || 'Not Started';
                                  const statusColor = getStatusColor(visibleSteps, step.id, currentStatus);
                                  const isEditing = editingCell?.groupKey === groupKey && editingCell?.stepId === step.id;
                                  return (
                                    <div key={step.id} className="flex items-center gap-2">
                                      <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">
                                        {step.step_name}
                                      </span>
                                      {isEditing ? (
                                        <select
                                          autoFocus
                                          value={currentStatus}
                                          onChange={(e) => handleGroupStatusChange(groupKey, step.id, e.target.value)}
                                          onBlur={() => setEditingCell(null)}
                                          className="px-2 py-0.5 text-xs border border-green-500 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                        >
                                          {step.statuses.map(s => (
                                            <option key={s.status_name} value={s.status_name}>{s.status_name}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <button
                                          onClick={() => setEditingCell({ groupKey, stepId: step.id })}
                                          className="px-2.5 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap text-gray-900 dark:text-white"
                                          style={{
                                            backgroundColor: `${statusColor}33`,
                                            border: `1px solid ${statusColor}80`,
                                          }}
                                          title={`Change ${step.step_name} status (applies to all imprints in this ${groupLabelDisplay} · ${sub.type} bucket)`}
                                        >
                                          {currentStatus}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <AlertCircle className="w-3.5 h-3.5" />
        Click <span className="font-medium">Schedule →</span> to pick a production date and move every imprint of that group to its type-specific schedule. When every group on a WO is scheduled, the work order drops off this view.
      </div>

      {/* Schedule date prompt — client 2026-05-13. Picks the production date
          before flipping the entries off master. */}
      {scheduleModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setScheduleModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Schedule {scheduleModal.typeOfWork}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <span className="font-medium">{scheduleModal.woNumber}</span>
              {' · '}
              <span className="font-medium">{scheduleModal.groupLabel || 'Default Group'}</span>
            </p>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Production Date
            </label>
            <input
              type="date"
              value={scheduleDateInput}
              onChange={(e) => setScheduleDateInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
              autoFocus
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
              All imprints in this group will be moved to the {scheduleModal.typeOfWork} schedule under this date.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setScheduleModal(null)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmSchedule}
                className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Group-key helpers: encode (woId, groupLabel, typeOfWork) as a single string
// so we can use it as an editing-cell handle and a scheduling-loading key
// without nested maps. Separator '::' is safe since group_label and
// type_of_work are user-entered text but unlikely to contain that sequence.
function makeGroupKey(woId: string, groupLabel: string, typeOfWork: string): string {
  return `${woId}::${groupLabel}::${typeOfWork}`;
}
function parseGroupKey(key: string): [string, string, string] {
  const parts = key.split('::');
  return [parts[0] || '', parts[1] || '', parts[2] || ''];
}

// Worst-case stock across all imprints in a WO. If anything is short, surface
// the lowest progress so admin sees what's still blocking.
function aggregateStock(items: ScheduleEntry[]): 'none' | 'ordered' | 'partial' | 'received' {
  const order: Array<'none' | 'ordered' | 'partial' | 'received'> = ['none', 'ordered', 'partial', 'received'];
  let worstIdx = order.length - 1;
  for (const it of items) {
    const s = it.stock_status || 'none';
    const idx = order.indexOf(s);
    if (idx < worstIdx) worstIdx = idx;
  }
  return order[worstIdx];
}

// Art status aggregate: rejection always wins (needs attention); else
// pending; else none; else approved.
function aggregateArt(items: ScheduleEntry[]): 'pending' | 'approved' | 'rejected' | 'none' {
  let hasRejected = false;
  let hasPending = false;
  let hasNone = false;
  let hasApproved = false;
  for (const it of items) {
    const s = it.art_status || 'none';
    if (s === 'rejected') hasRejected = true;
    else if (s === 'pending') hasPending = true;
    else if (s === 'none') hasNone = true;
    else if (s === 'approved') hasApproved = true;
  }
  if (hasRejected) return 'rejected';
  if (hasPending) return 'pending';
  if (hasNone && !hasApproved) return 'none';
  if (hasApproved && !hasPending && !hasNone) return 'approved';
  return hasApproved ? 'approved' : 'none';
}

function StockStatusBadge({ status }: { status: 'none' | 'ordered' | 'partial' | 'received' }) {
  if (status === 'received') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded-full whitespace-nowrap">
        <CheckCircle className="w-3 h-3" />Received
      </span>
    );
  }
  if (status === 'ordered') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-full whitespace-nowrap">
        <CheckCircle className="w-3 h-3" />Ordered
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-full whitespace-nowrap">
        <Clock className="w-3 h-3" />Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 rounded-full whitespace-nowrap">
      —
    </span>
  );
}

function ArtStatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' | 'none' }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded-full whitespace-nowrap">
        <CheckCircle className="w-3 h-3" />Approved
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-full whitespace-nowrap">
        <X className="w-3 h-3" />Rejected
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20 rounded-full whitespace-nowrap">
        <Clock className="w-3 h-3" />Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-700 rounded-full whitespace-nowrap">
      —
    </span>
  );
}
