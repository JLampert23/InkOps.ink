import { useState, useEffect, useCallback } from 'react';
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
  quantity: number;
  step_statuses: Record<string, string>;
  priority_order: number;
  artwork_thumb_url: string | null;
  is_on_master_schedule: boolean;
  // 2026-05-11 — client asked for Stock Status + Art Status to show on each
  // imprint in the expanded view. Computed via the same logic as
  // ProductionScheduler's enrichment so the badge meanings are consistent.
  stock_status?: 'none' | 'ordered' | 'partial' | 'received';
  art_status?: 'pending' | 'approved' | 'rejected' | 'none';
}

interface WorkOrderInfo {
  id: string;
  work_order_number: string | null;
  status: string | null;
  priority: string | null;
  customer_name: string | null;
  production_due_date: string | null;
  total_quantity: number | null;
  custom_invoice_status_id: string | null;
}

interface MasterScheduleProps {
  onNavigateToWorkOrder?: (workOrderId: string) => void;
}

// Per client spec (2026-05-09): Master Schedule is the first tab inside
// Scheduling. Approved quotes land here as work orders. Each WO is one row,
// expandable to show every decoration type within it. Each decoration has a
// "Schedule" button that pushes it to its type-specific schedule tab. Once
// all decorations on a WO are scheduled, the WO drops off Master.
export default function MasterSchedule({ onNavigateToWorkOrder }: MasterScheduleProps) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [workOrders, setWorkOrders] = useState<Record<string, WorkOrderInfo>>({});
  const [customStatusNames, setCustomStatusNames] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [scheduling, setScheduling] = useState<Record<string, boolean>>({});

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

      // Pull every schedule entry currently parked on the master schedule
      // (is_on_master_schedule=true). Order by production_due_date so the
      // most urgent jobs surface first.
      const { data: entriesData } = await supabase
        .from('production_schedule_entries')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_on_master_schedule', true)
        .order('production_due_date', { ascending: true })
        .order('priority_order', { ascending: true });

      const rawList: ScheduleEntry[] = entriesData || [];

      // Enrich each entry with stock_status + art_status per quote (same
      // semantics as ProductionScheduler so the badges mean the same thing
      // on master and on the type tabs).
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
      }));
      setEntries(list);

      // Pull the related work orders so each row header can show priority,
      // status, totals, etc. without doing a join in the entries query.
      const woIds = [...new Set(list.map(e => e.work_order_id).filter(Boolean))] as string[];
      if (woIds.length > 0) {
        const { data: wos } = await supabase
          .from('work_orders')
          .select('id, work_order_number, status, priority, customer_name, production_due_date, total_quantity, custom_invoice_status_id')
          .in('id', woIds);
        const map: Record<string, WorkOrderInfo> = {};
        (wos || []).forEach((wo: any) => { map[wo.id] = wo; });
        setWorkOrders(map);

        // Resolve custom invoice status names (e.g. "COMPLETE") for the
        // decoration-row status pill. We do this per-name not per-WO so a
        // small set of distinct statuses doesn't fan into N queries.
        const statusIds = [...new Set((wos || []).map((wo: any) => wo.custom_invoice_status_id).filter(Boolean))];
        if (statusIds.length > 0) {
          const { data: statusRows } = await supabase
            .from('custom_invoice_statuses')
            .select('id, name')
            .in('id', statusIds);
          const nameMap: Record<string, string> = {};
          (statusRows || []).forEach((s: any) => { nameMap[s.id] = s.name; });
          setCustomStatusNames(nameMap);
        }
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

  const toggleExpand = (workOrderId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(workOrderId)) next.delete(workOrderId);
      else next.add(workOrderId);
      return next;
    });
  };

  // Push a single decoration out of master and into its type-specific tab.
  // The destination is determined by the entry's existing type_of_work field
  // (e.g. "Screen Print" → Screen Print tab) — admin doesn't pick. Once
  // every decoration on a WO is scheduled, the whole WO group disappears
  // from master because the filter is_on_master_schedule=true matches none
  // of its entries.
  const handleScheduleDecoration = async (entry: ScheduleEntry) => {
    setScheduling(prev => ({ ...prev, [entry.id]: true }));
    try {
      const { error } = await supabase
        .from('production_schedule_entries')
        .update({ is_on_master_schedule: false })
        .eq('id', entry.id);
      if (error) throw error;
      // Drop the entry locally so the UI updates without a full reload.
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (err) {
      console.error('Failed to schedule decoration:', err);
      alert('Failed to schedule. Please try again.');
    } finally {
      setScheduling(prev => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    }
  };

  // Group the entries by work_order_id so the table renders one row per WO
  // with expandable decoration sub-rows. Entries without a work_order_id
  // (orphaned) get bucketed under a synthetic 'unassigned' key.
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
          Approved quotes land here automatically. Use the Schedule button on each decoration to move it into its type-specific schedule.
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
            All work orders waiting to be scheduled. Click a row to see decoration types within.
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
              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Total Qty</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Due</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Priority</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-400 w-16">Decos</th>
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
              const priority = (wo?.priority || 'medium').toLowerCase();
              const priorityLabel =
                priority === 'high' || priority === 'rush' ? 'Rush' :
                priority === 'low' ? 'Low' : 'Normal';
              const priorityClass =
                priorityLabel === 'Rush'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : priorityLabel === 'Low'
                  ? 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';

              return (
                <>
                  <tr
                    key={woKey}
                    className="border-t border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/30 cursor-pointer"
                    onClick={() => toggleExpand(woKey)}
                  >
                    <td className="px-3 py-2.5">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
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
                    <td className="px-3 py-2.5 text-right text-gray-900 dark:text-white">{totalQty}</td>
                    <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">
                      {dueDate ? format(parseISO(dueDate), 'MMM d') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityClass}`}>
                        {priorityLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400">
                      {groupEntries.length}
                    </td>
                  </tr>
                  {isExpanded && groupEntries.map(entry => {
                    const statusName = wo?.custom_invoice_status_id
                      ? customStatusNames[wo.custom_invoice_status_id]
                      : null;
                    return (
                      <tr key={entry.id} className="border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/30">
                        <td className="px-3 py-2"></td>
                        <td className="px-3 py-2 pl-8 text-xs text-gray-700 dark:text-gray-300">
                          <span className="inline-block w-3 text-gray-400">⤷</span>
                          <span className="font-medium">{entry.type_of_work}</span>
                          {entry.imprint_number && (
                            <span className="ml-2 text-gray-500 dark:text-gray-400">{entry.imprint_number}</span>
                          )}
                        </td>
                        {/* Stock Status badge — same semantics as
                            ProductionScheduler. Red = ordered, yellow =
                            partial receipt, green = fully received. */}
                        <td className="px-3 py-2">
                          <StockStatusBadge status={entry.stock_status || 'none'} />
                        </td>
                        {/* Art Status badge */}
                        <td className="px-3 py-2">
                          <ArtStatusBadge status={entry.art_status || 'none'} />
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-700 dark:text-gray-300">{entry.quantity}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                          {statusName ? (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              {statusName}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">Pending</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleScheduleDecoration(entry)}
                            disabled={scheduling[entry.id]}
                            className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
                            title={`Move to ${entry.type_of_work} schedule`}
                          >
                            {scheduling[entry.id] ? 'Moving…' : 'Schedule →'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <AlertCircle className="w-3.5 h-3.5" />
        Click <span className="font-medium">Schedule →</span> on a decoration to move it into its type-specific schedule (Screen Print, Embroidery, etc.). When every decoration on a WO is scheduled, the whole work order drops off this view.
      </div>
    </div>
  );
}

// 2026-05-11 — small status pills shown per decoration in the expanded view.
// Same color semantics as ProductionScheduler so admin learns one mapping.
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
