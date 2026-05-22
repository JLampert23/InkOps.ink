import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  Package,
  Search,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { format, isAfter, isBefore, isToday, parseISO } from 'date-fns';
import { ReceiveMarkedOrderedModal } from './ReceiveMarkedOrderedModal';

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name: string;
  expected_delivery_date: string | null;
  receiving_status: string;
  total_items: number;
  received_items: number;
  created_at: string;
  vendor?: {
    vendor_name: string;
  };
}

interface ReceivingDashboardProps {
  onReceivePO: (poId: string) => void;
  onViewPO: (poId: string) => void;
  // 2026-05-21 — let the Awaiting Check-In rows link the WO# to the
  // work order detail screen so admin can jump straight to a job from
  // the receiving list (client ask).
  onNavigateToWorkOrder?: (workOrderId: string) => void;
}

interface MarkedOrderedItem {
  id: string;
  quote_id: string;
  work_order_id: string | null;
  style_number: string | null;
  style_name: string | null;
  color: string | null;
  total_quantity: number;
  quantity_received: number;
  ordered_at: string | null;
  supplier_name: string | null;
  customer_name?: string;
  quote_number?: string;
  // 2026-05-14 — show WO# on the Receiving row so admin knows which work
  // order each pending receipt belongs to.
  work_order_number?: string;
  // Per-size breakdown of what was ordered and what's been received so
  // far. Drives the size-level receive modal.
  sizes?: Record<string, number> | null;
  quantity_received_by_size?: Record<string, number> | null;
}

export function ReceivingDashboard({ onReceivePO, onViewPO, onNavigateToWorkOrder }: ReceivingDashboardProps) {
  const [closedPOs, setClosedPOs] = useState<PurchaseOrder[]>([]);
  const [overduePOs, setOverduePOs] = useState<PurchaseOrder[]>([]);
  const [openPOs, setOpenPOs] = useState<PurchaseOrder[]>([]);
  const [recentReceiving, setRecentReceiving] = useState<any[]>([]);
  // Items the user marked Ordered in Garment Order Report but never built
  // into a formal PO. Surface them here so the user has one place to
  // record receipts. (Path C from the 2026-05-08 client decision.)
  const [markedOrderedItems, setMarkedOrderedItems] = useState<MarkedOrderedItem[]>([]);
  // Per-row in-progress qty input for the Quick Receive form. Keyed by
  // staging row id so each row's input is independent. (Legacy fallback
  // only — used when a staging row has no size breakdown. Modern rows
  // open the size-level modal instead.)
  const [receiveQtyDraft, setReceiveQtyDraft] = useState<Record<string, string>>({});
  const [savingReceive, setSavingReceive] = useState<Record<string, boolean>>({});
  // 2026-05-14 — modal target for the size-level Mark Ordered receive
  // flow. Same UX as the PO receive modal; just operates on
  // garment_requirements_staging rows instead of PO line items.
  const [receiveModalTarget, setReceiveModalTarget] = useState<MarkedOrderedItem | null>(null);
  // 2026-05-15 — search for the Marked Ordered table. Filters client-side
  // across WO#, customer, quote, style, style name, color, supplier.
  const [markedOrderedSearch, setMarkedOrderedSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchTerm.trim()) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      await Promise.all([
        loadClosedPOs(profile.company_id),
        loadOverduePOs(profile.company_id),
        loadOpenPOs(profile.company_id),
        loadRecentReceiving(profile.company_id),
        loadMarkedOrderedItems(profile.company_id),
      ]);
    } catch (error) {
      console.error('Error loading receiving dashboard:', error);
      alert('Failed to load receiving data');
    } finally {
      setLoading(false);
    }
  };

  // Quick Receive: record additional units received against a staging row.
  // Adds qtyJustReceived to the existing quantity_received and flips
  // is_received=true once we hit total_quantity. The Stock Status badge in
  // ProductionScheduler reads from these columns to show partial/received.
  const handleQuickReceive = async (item: MarkedOrderedItem, qtyJustReceived: number) => {
    if (qtyJustReceived <= 0) return;
    setSavingReceive((prev) => ({ ...prev, [item.id]: true }));
    try {
      const newReceived = item.quantity_received + qtyJustReceived;
      const isFullyReceived = newReceived >= item.total_quantity;
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('garment_requirements_staging')
        .update({
          quantity_received: newReceived,
          is_received: isFullyReceived,
          received_at: new Date().toISOString(),
          received_by: user?.email || user?.id || null,
        })
        .eq('id', item.id);

      if (error) throw error;

      setReceiveQtyDraft((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });

      // Reload so fully-received rows drop off the list and partial rows
      // show the updated counter.
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id || '')
        .maybeSingle();
      if (profile?.company_id) {
        await loadMarkedOrderedItems(profile.company_id);
      }
    } catch (err) {
      console.error('Quick receive failed:', err);
      alert('Failed to record receipt. Please try again.');
    } finally {
      setSavingReceive((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const loadMarkedOrderedItems = async (companyId: string) => {
    // Items flagged "Ordered" in Garment Order Report that have NOT been
    // turned into a formal PO and have NOT been fully received yet.
    // Pulls customer / quote number from the linked quote so the dashboard
    // row is meaningful at a glance.
    const { data, error } = await supabase
      .from('garment_requirements_staging')
      .select(`
        id, quote_id, work_order_id,
        style_number, style_name, color,
        total_quantity, quantity_received,
        sizes, quantity_received_by_size,
        ordered_at, supplier_name,
        is_po_created, is_received,
        quotes!garment_requirements_staging_quote_id_fkey (
          quote_number,
          customer_name
        )
      `)
      .eq('company_id', companyId)
      .eq('is_ordered', true)
      .eq('is_received', false)
      .or('is_po_created.is.null,is_po_created.eq.false')
      .order('ordered_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error loading marked-ordered items:', error);
      setMarkedOrderedItems([]);
      return;
    }

    // Pull WO numbers two ways:
    // 1) By work_order_id (preferred — fast direct lookup)
    // 2) By quote_id (fallback for staging rows where the cascade
    //    trigger or Mark Ordered insert didn't populate work_order_id —
    //    client reported rows showing "—" instead of WO# on 2026-05-20)
    const woIds = [...new Set((data || []).map((r: any) => r.work_order_id).filter(Boolean))] as string[];
    const quoteIds = [...new Set((data || []).map((r: any) => r.quote_id).filter(Boolean))] as string[];
    const woNumberById = new Map<string, string>();
    const woNumberByQuote = new Map<string, string>();
    if (woIds.length > 0) {
      const { data: wos } = await supabase
        .from('work_orders')
        .select('id, work_order_number')
        .in('id', woIds);
      (wos || []).forEach((w: any) => woNumberById.set(w.id, w.work_order_number));
    }
    if (quoteIds.length > 0) {
      const { data: wosByQuote } = await supabase
        .from('work_orders')
        .select('quote_id, work_order_number')
        .in('quote_id', quoteIds);
      (wosByQuote || []).forEach((w: any) => {
        if (w.quote_id) woNumberByQuote.set(w.quote_id, w.work_order_number);
      });
    }

    setMarkedOrderedItems(
      (data || []).map((row: any) => {
        const fromWoId = row.work_order_id ? woNumberById.get(row.work_order_id) : undefined;
        const fromQuoteId = row.quote_id ? woNumberByQuote.get(row.quote_id) : undefined;
        return {
          id: row.id,
          quote_id: row.quote_id,
          work_order_id: row.work_order_id,
          style_number: row.style_number,
          style_name: row.style_name,
          color: row.color,
          total_quantity: row.total_quantity || 0,
          quantity_received: row.quantity_received || 0,
          ordered_at: row.ordered_at,
          supplier_name: row.supplier_name,
          customer_name: row.quotes?.customer_name,
          quote_number: row.quotes?.quote_number,
          work_order_number: fromWoId || fromQuoteId,
          sizes: row.sizes || null,
          quantity_received_by_size: row.quantity_received_by_size || null,
        };
      })
    );
  };

  const loadClosedPOs = async (companyId: string) => {
    const { data: pos, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        expected_delivery_date,
        status,
        receiving_status,
        created_at,
        vendors!purchase_orders_vendor_id_fkey (
          vendor_name
        )
      `)
      .eq('company_id', companyId)
      .in('status', ['fully_received', 'closed'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const posWithCounts = await Promise.all(
      (pos || []).map(async (po: any) => {
        const { data: lineItems } = await supabase
          .from('purchase_order_line_items')
          .select('quantity_ordered, quantity_received')
          .eq('po_id', po.id);

        const total = lineItems?.reduce((sum, item) => sum + item.quantity_ordered, 0) || 0;
        const received = lineItems?.reduce((sum, item) => sum + item.quantity_received, 0) || 0;

        return {
          ...po,
          vendor_name: po.vendors?.vendor_name || 'Unknown',
          total_items: total,
          received_items: received,
        };
      })
    );

    setClosedPOs(posWithCounts);
  };

  const loadOverduePOs = async (companyId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: pos, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        expected_delivery_date,
        status,
        receiving_status,
        created_at,
        vendors!purchase_orders_vendor_id_fkey (
          vendor_name
        )
      `)
      .eq('company_id', companyId)
      .lt('expected_delivery_date', today)
      .in('status', ['sent', 'confirmed', 'in_transit', 'partially_received'])
      .not('expected_delivery_date', 'is', null)
      .order('expected_delivery_date');

    if (error) throw error;

    const posWithCounts = await Promise.all(
      (pos || []).map(async (po: any) => {
        const { data: lineItems } = await supabase
          .from('purchase_order_line_items')
          .select('quantity_ordered, quantity_received')
          .eq('po_id', po.id);

        const total = lineItems?.reduce((sum, item) => sum + item.quantity_ordered, 0) || 0;
        const received = lineItems?.reduce((sum, item) => sum + item.quantity_received, 0) || 0;

        return {
          ...po,
          vendor_name: po.vendors?.vendor_name || 'Unknown',
          total_items: total,
          received_items: received,
        };
      })
    );

    setOverduePOs(posWithCounts);
  };

  const loadOpenPOs = async (companyId: string) => {
    const { data: pos, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        expected_delivery_date,
        status,
        receiving_status,
        created_at,
        vendors!purchase_orders_vendor_id_fkey (
          vendor_name
        )
      `)
      .eq('company_id', companyId)
      .in('status', ['sent', 'confirmed', 'in_transit', 'partially_received'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const posWithCounts = await Promise.all(
      (pos || []).map(async (po: any) => {
        const { data: lineItems } = await supabase
          .from('purchase_order_line_items')
          .select('quantity_ordered, quantity_received')
          .eq('po_id', po.id);

        const total = lineItems?.reduce((sum, item) => sum + item.quantity_ordered, 0) || 0;
        const received = lineItems?.reduce((sum, item) => sum + item.quantity_received, 0) || 0;

        return {
          ...po,
          vendor_name: po.vendors?.vendor_name || 'Unknown',
          total_items: total,
          received_items: received,
        };
      })
    );

    setOpenPOs(posWithCounts);
  };

  const loadRecentReceiving = async (companyId: string) => {
    const { data, error } = await supabase
      .from('receiving_logs')
      .select(`
        id,
        received_at,
        status,
        notes,
        purchase_orders!po_id (
          po_number
        ),
        user_profiles!received_by (
          full_name
        )
      `)
      .eq('company_id', companyId)
      .order('received_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    const logsWithCounts = await Promise.all(
      (data || []).map(async (log: any) => {
        const { data: lineItems } = await supabase
          .from('receiving_line_items')
          .select('quantity_received, quantity_damaged, quantity_short')
          .eq('receiving_log_id', log.id);

        const totalReceived = lineItems?.reduce((sum, item) => sum + item.quantity_received, 0) || 0;
        const totalDamaged = lineItems?.reduce((sum, item) => sum + item.quantity_damaged, 0) || 0;
        const totalShort = lineItems?.reduce((sum, item) => sum + item.quantity_short, 0) || 0;

        return {
          ...log,
          po_number: log.purchase_orders?.po_number || 'Unknown',
          received_by_name: log.user_profiles?.full_name || 'Unknown',
          total_received: totalReceived,
          total_damaged: totalDamaged,
          total_short: totalShort,
        };
      })
    );

    setRecentReceiving(logsWithCounts);
  };

  const performSearch = async () => {
    setSearching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      const term = searchTerm.toLowerCase();

      const { data: pos, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          expected_delivery_date,
          status,
          receiving_status,
          created_at,
          vendors!purchase_orders_vendor_id_fkey (
            vendor_name
          )
        `)
        .eq('company_id', profile.company_id)
        .in('status', ['sent', 'confirmed', 'in_transit', 'partially_received'])
        .or(`po_number.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const posWithCounts = await Promise.all(
        (pos || []).map(async (po: any) => {
          const { data: lineItems } = await supabase
            .from('purchase_order_line_items')
            .select('quantity_ordered, quantity_received')
            .eq('po_id', po.id);

          const total = lineItems?.reduce((sum, item) => sum + item.quantity_ordered, 0) || 0;
          const received = lineItems?.reduce((sum, item) => sum + item.quantity_received, 0) || 0;

          return {
            ...po,
            vendor_name: po.vendors?.vendor_name || 'Unknown',
            total_items: total,
            received_items: received,
          };
        })
      );

      setSearchResults(posWithCounts);
    } catch (error) {
      console.error('Error searching POs:', error);
    } finally {
      setSearching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      pending: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-400', label: 'Pending' },
      partial: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'Partial' },
      complete: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', label: 'Complete' },
    };

    const config = configs[status as keyof typeof configs] || configs.pending;

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getDaysOverdue = (date: string) => {
    const deliveryDate = parseISO(date);
    const today = new Date();
    const diffTime = today.getTime() - deliveryDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Receiving Dashboard</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Receive goods, track deliveries, and manage inventory
        </p>
      </div>

      {/* 2026-05-20 — replaced "Overdue POs" stat card with "Items to
          Check In" per client. The marked-ordered table below is the
          primary work surface here; surface its count up top so the
          admin can see at-a-glance how many items are waiting. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-amber-300 dark:border-amber-700 p-4 ring-1 ring-amber-300 dark:ring-amber-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Items to Check In</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {markedOrderedItems.length}
              </p>
            </div>
            <Package className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending POs</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {openPOs.length}
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Recent Activity</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {recentReceiving.length}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>

      {/* 2026-05-20 — empty-state placeholder for the marked-ordered
          section. Without this, when there are zero marked-ordered
          items the section just vanishes and the admin (Jamie) is
          left scrolling past the stats wondering where the check-in
          UI went. Routes them to the right path (PO Receive button
          on the table below) so the distinction between
          marked-ordered and on-a-PO is obvious. */}
      {markedOrderedItems.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-5">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              <p className="font-medium text-gray-900 dark:text-white mb-1">No marked-ordered items waiting check-in.</p>
              <p>
                Items appear here when you click <span className="font-medium">Mark Ordered</span> on the Garment Report (no PO created).
                Anything already on a Purchase Order belongs in <span className="font-medium">Open Purchase Orders</span> below —
                click the green <span className="font-medium">Receive</span> button next to each PO to check those in.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Marked Ordered (no PO) — Quick Receive section.
          Per client 2026-05-08 (Path C): items flagged Ordered in
          Garment Order Report that don't have a formal PO show up here
          so the user has one place to receive. */}
      {markedOrderedItems.length > 0 && (() => {
        // 2026-05-15 — client asked for search in the receiving module.
        // Filter client-side across the visible columns + WO#.
        const needle = markedOrderedSearch.trim().toLowerCase();
        const filteredMarked = needle === ''
          ? markedOrderedItems
          : markedOrderedItems.filter((item) => {
              const hay = [
                item.work_order_number,
                item.customer_name,
                item.quote_number,
                item.style_number,
                item.style_name,
                item.color,
                item.supplier_name,
              ].filter(Boolean).join(' ').toLowerCase();
              return hay.includes(needle);
            });
        return (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-amber-50/50 dark:bg-amber-900/10 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Awaiting Check-In
              </h3>
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 rounded-full">
                {filteredMarked.length}{filteredMarked.length !== markedOrderedItems.length ? ` / ${markedOrderedItems.length}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-1 justify-end">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search WO / customer / style / color…"
                  value={markedOrderedSearch}
                  onChange={(e) => setMarkedOrderedSearch(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                From Garment Order Report (no PO)
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Work Order</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Customer / Quote</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Style</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Color</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Ordered</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Received</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Quick Receive</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarked.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No items match "{markedOrderedSearch}".
                    </td>
                  </tr>
                )}
                {/* 2026-05-22 — re-instated date grouping. Client clarified:
                    "i never said to remove the dates. i want them in order
                    by date". Sorted newest-first to match the screenshot
                    he approved. */}
                {(() => {
                  const groups = new Map<string, MarkedOrderedItem[]>();
                  filteredMarked.forEach((item) => {
                    const key = item.ordered_at ? item.ordered_at.slice(0, 10) : 'unknown';
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(item);
                  });
                  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
                    if (a === 'unknown') return 1;
                    if (b === 'unknown') return -1;
                    return b.localeCompare(a);
                  });
                  return sortedKeys.flatMap((key) => {
                    const items = groups.get(key)!;
                    const label = key === 'unknown'
                      ? 'MARKED ORDERED - DATE UNKNOWN'
                      : `MARKED ORDERED - ${new Date(key + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        }).toUpperCase()}`;
                    const headerRow = (
                      <tr key={`hdr-${key}`} className="bg-amber-50/40 dark:bg-amber-900/10">
                        <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold tracking-wide text-amber-700 dark:text-amber-400">
                          {label}
                        </td>
                      </tr>
                    );
                    const rows = items.map((item) => {
                  const remaining = Math.max(0, item.total_quantity - item.quantity_received);
                  const isPartial = item.quantity_received > 0 && item.quantity_received < item.total_quantity;
                  const draftValue = receiveQtyDraft[item.id] ?? '';
                  const draftNum = parseInt(draftValue, 10);
                  const validDraft = !isNaN(draftNum) && draftNum > 0 && draftNum <= remaining;
                  return (
                    <tr key={item.id} className="border-t border-gray-200 dark:border-slate-700">
                        <td className="px-4 py-2 text-gray-900 dark:text-white font-medium whitespace-nowrap">
                          {item.work_order_number && item.work_order_id && onNavigateToWorkOrder ? (
                            <button
                              onClick={() => onNavigateToWorkOrder(item.work_order_id!)}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                              title={`Open ${item.work_order_number}`}
                            >
                              {item.work_order_number}
                            </button>
                          ) : (
                            <span>{item.work_order_number || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {item.customer_name || '—'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.quote_number || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          <div>{item.style_number || '—'}</div>
                          {item.style_name && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{item.style_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{item.color || '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{item.total_quantity}</td>
                        <td className="px-4 py-2 text-right">
                          <span className={
                            isPartial
                              ? 'text-amber-600 dark:text-amber-400 font-medium'
                              : 'text-gray-700 dark:text-gray-300'
                          }>
                            {item.quantity_received}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2 justify-end">
                            {item.sizes && Object.keys(item.sizes).length > 0 ? (
                              <button
                                onClick={() => setReceiveModalTarget(item)}
                                className="px-3 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                              >
                                Receive
                              </button>
                            ) : (
                              <>
                                <input
                                  type="number"
                                  min="1"
                                  max={remaining}
                                  placeholder={String(remaining)}
                                  value={draftValue}
                                  onChange={(e) =>
                                    setReceiveQtyDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                                  }
                                  className="w-20 px-2 py-1 text-right text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                                />
                                <button
                                  onClick={() => {
                                    const qty = parseInt(receiveQtyDraft[item.id] || String(remaining), 10);
                                    if (qty > 0 && qty <= remaining) {
                                      handleQuickReceive(item, qty);
                                    }
                                  }}
                                  disabled={savingReceive[item.id] || (!!draftValue && !validDraft)}
                                  className="px-3 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {savingReceive[item.id] ? 'Saving...' : 'Receive'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                    });
                    return [headerRow, ...rows];
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* Search */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by PO number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-blue-600" />
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Search Results</h3>
            {searchResults.map((po) => (
              <div
                key={po.id}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{po.po_number}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{po.vendor_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(po.receiving_status)}
                  <button
                    onClick={() => onReceivePO(po.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Receive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open Purchase Orders */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Open Purchase Orders</h3>
            <span className="ml-auto px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm font-medium rounded">
              {openPOs.length} POs
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Expected Date
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {openPOs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No purchase orders awaiting receipt</p>
                  </td>
                </tr>
              ) : (
                openPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {po.po_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {po.vendor_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        po.status === 'sent'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : po.status === 'confirmed'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          : po.status === 'in_transit'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {po.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {po.expected_delivery_date ? format(parseISO(po.expected_delivery_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-medium ${
                          po.received_items === po.total_items
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {po.received_items} / {po.total_items}
                        </span>
                        <div className="w-24 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              po.received_items === po.total_items
                                ? 'bg-green-500'
                                : 'bg-blue-500'
                            }`}
                            style={{ width: `${(po.received_items / po.total_items) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onViewPO(po.id)}
                          className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium transition-all"
                        >
                          View
                        </button>
                        {po.received_items < po.total_items && (
                          <button
                            onClick={() => onReceivePO(po.id)}
                            className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium transition-all"
                          >
                            Receive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2026-05-20 — removed "Overdue Deliveries" section per client.
          The Marked Ordered ("Items to Check In") table at the top is
          the primary work surface here; Overdue Deliveries was prime
          real estate that displaced the check-in workflow. Closed
          Purchase Orders kept as a single full-width archive card. */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Closed Purchase Orders</h3>
            <span className="ml-auto px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded">
              {closedPOs.length}
            </span>
          </div>
        </div>
        <div className="p-4">
          {closedPOs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No closed purchase orders</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {closedPOs.map((po) => (
                <div
                  key={po.id}
                  className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{po.po_number}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{po.vendor_name}</p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {po.status === 'closed' ? 'CLOSED' : po.status === 'sent' ? 'SENT' : 'FULLY RECEIVED'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{po.received_items}</span> / {po.total_items} items received
                    </div>
                    <button
                      onClick={() => onViewPO(po.id)}
                      className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Receiving Activity */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Receiving Activity</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  PO Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Received By
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Received
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Damaged
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Short
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {recentReceiving.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No receiving activity yet
                  </td>
                </tr>
              ) : (
                recentReceiving.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {format(parseISO(log.received_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {log.po_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {log.received_by_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400 font-medium">
                      {log.total_received}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                      {log.total_damaged || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">
                      {log.total_short || 0}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(log.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Size-level Mark Ordered receive modal — 2026-05-14 */}
      {receiveModalTarget && (
        <ReceiveMarkedOrderedModal
          item={{
            id: receiveModalTarget.id,
            quote_id: receiveModalTarget.quote_id,
            work_order_id: receiveModalTarget.work_order_id,
            work_order_number: receiveModalTarget.work_order_number,
            style_number: receiveModalTarget.style_number,
            style_name: receiveModalTarget.style_name,
            color: receiveModalTarget.color,
            total_quantity: receiveModalTarget.total_quantity,
            quantity_received: receiveModalTarget.quantity_received,
            sizes: receiveModalTarget.sizes || null,
            quantity_received_by_size: receiveModalTarget.quantity_received_by_size || null,
            customer_name: receiveModalTarget.customer_name,
            quote_number: receiveModalTarget.quote_number,
          }}
          onClose={() => setReceiveModalTarget(null)}
          onSuccess={async () => {
            // Refresh the marked-ordered list so partials show the new
            // counter and fully-received rows drop off.
            const { data: { user } } = await supabase.auth.getUser();
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('company_id')
              .eq('id', user?.id || '')
              .maybeSingle();
            if (profile?.company_id) {
              await loadMarkedOrderedItems(profile.company_id);
            }
          }}
        />
      )}
    </div>
  );
}
