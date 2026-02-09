import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  FileText,
  PlusCircle,
  ShoppingCart,
  Calendar,
  Loader2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { format, isToday, parseISO, isPast } from 'date-fns';

interface DashboardKPIs {
  garmentsNeededToday: number;
  posAwaitingConfirmation: number;
  posArrivingToday: number;
  itemsShortOrBackordered: number;
  jobsBlocked: number;
}

interface Alert {
  id: string;
  type: 'overdue' | 'delay' | 'backorder' | 'blocked';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action?: string;
}

interface RecentPO {
  id: string;
  po_number: string;
  vendor_name: string;
  total_cost: number;
  status: string;
  receiving_status: string;
  created_at: string;
}

interface ArrivingItem {
  po_number: string;
  vendor_name: string;
  expected_quantity: number;
  product_name: string;
}

interface ShortItem {
  style_number: string;
  color: string;
  size: string;
  needed: number;
  ordered: number;
  received: number;
  shortage: number;
}

interface ManageGoodsDashboardProps {
  onNavigate: (tab: string, view?: string, id?: string) => void;
}

export function ManageGoodsDashboard({ onNavigate }: ManageGoodsDashboardProps) {
  const [kpis, setKpis] = useState<DashboardKPIs>({
    garmentsNeededToday: 0,
    posAwaitingConfirmation: 0,
    posArrivingToday: 0,
    itemsShortOrBackordered: 0,
    jobsBlocked: 0,
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recentPOs, setRecentPOs] = useState<RecentPO[]>([]);
  const [arrivingItems, setArrivingItems] = useState<ArrivingItem[]>([]);
  const [shortItems, setShortItems] = useState<ShortItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
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
        loadKPIs(profile.company_id),
        loadAlerts(profile.company_id),
        loadRecentPOs(profile.company_id),
        loadArrivingItems(profile.company_id),
        loadShortItems(profile.company_id),
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async (companyId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: posConfirmation } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'draft');

    const { data: posArriving } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('company_id', companyId)
      .eq('expected_delivery_date', today)
      .neq('receiving_status', 'complete');

    const { data: lineItems } = await supabase
      .from('purchase_order_line_items')
      .select('quantity_ordered, quantity_received, po_id')
      .in('po_id', (await supabase
        .from('purchase_orders')
        .select('id')
        .eq('company_id', companyId)).data?.map(p => p.id) || []);

    const itemsShort = lineItems?.filter(
      item => item.quantity_received < item.quantity_ordered
    ).length || 0;

    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, status')
      .eq('company_id', companyId)
      .eq('status', 'approved');

    let jobsBlocked = 0;
    if (quotes) {
      for (const quote of quotes) {
        const { data: lineItems } = await supabase
          .from('quote_line_items')
          .select('*')
          .eq('quote_id', quote.id);

        const hasAllGarments = await checkIfAllGarmentsReceived(lineItems || [], companyId);
        if (!hasAllGarments) jobsBlocked++;
      }
    }

    setKpis({
      garmentsNeededToday: 0,
      posAwaitingConfirmation: posConfirmation?.length || 0,
      posArrivingToday: posArriving?.length || 0,
      itemsShortOrBackordered: itemsShort,
      jobsBlocked: jobsBlocked,
    });
  };

  const checkIfAllGarmentsReceived = async (lineItems: any[], companyId: string): Promise<boolean> => {
    for (const item of lineItems) {
      const totalNeeded = (
        (item.xs_quantity || 0) + (item.s_quantity || 0) +
        (item.m_quantity || 0) + (item.l_quantity || 0) +
        (item.xl_quantity || 0) + (item.xxl_quantity || 0) +
        (item.xxxl_quantity || 0) + (item.xxxxl_quantity || 0) +
        (item.youth_s_quantity || 0) + (item.youth_m_quantity || 0) +
        (item.youth_l_quantity || 0) + (item.youth_xl_quantity || 0) +
        (item.other_size_quantity || 0) + (item.custom_size_quantity || 0)
      );

      const { data: poItems } = await supabase
        .from('purchase_order_line_items')
        .select('quantity_received')
        .eq('style_number', item.style_number)
        .eq('color', item.color);

      const totalReceived = poItems?.reduce((sum, po) => sum + po.quantity_received, 0) || 0;

      if (totalReceived < totalNeeded) {
        return false;
      }
    }
    return true;
  };

  const loadAlerts = async (companyId: string) => {
    const alertsList: Alert[] = [];
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: overduePOs } = await supabase
      .from('purchase_orders')
      .select('po_number, expected_delivery_date')
      .eq('company_id', companyId)
      .lt('expected_delivery_date', today)
      .neq('receiving_status', 'complete')
      .not('expected_delivery_date', 'is', null);

    if (overduePOs && overduePOs.length > 0) {
      alertsList.push({
        id: 'overdue-pos',
        type: 'overdue',
        severity: 'high',
        title: `${overduePOs.length} Overdue Purchase Orders`,
        description: 'POs have passed their expected delivery date',
        action: 'View Overdue POs',
      });
    }

    const { data: backorderedItems } = await supabase
      .from('purchase_order_line_items')
      .select('id, po_id')
      .gt('quantity_short', 0);

    if (backorderedItems && backorderedItems.length > 0) {
      alertsList.push({
        id: 'backorders',
        type: 'backorder',
        severity: 'medium',
        title: `${backorderedItems.length} Items Backordered`,
        description: 'Items marked as short need attention',
        action: 'Review Shortages',
      });
    }

    if (kpis.jobsBlocked > 0) {
      alertsList.push({
        id: 'jobs-blocked',
        type: 'blocked',
        severity: 'high',
        title: `${kpis.jobsBlocked} Jobs Blocked`,
        description: 'Jobs cannot proceed due to missing garments',
        action: 'View Blocked Jobs',
      });
    }

    setAlerts(alertsList);
  };

  const loadRecentPOs = async (companyId: string) => {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        total_cost,
        status,
        receiving_status,
        created_at,
        vendors!purchase_orders_vendor_id_fkey (
          vendor_name
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    setRecentPOs(
      (data || []).map((po: any) => ({
        ...po,
        vendor_name: po.vendors?.vendor_name || 'Unknown',
      }))
    );
  };

  const loadArrivingItems = async (companyId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: pos } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        vendors!purchase_orders_vendor_id_fkey (
          vendor_name
        )
      `)
      .eq('company_id', companyId)
      .eq('expected_delivery_date', today);

    if (!pos || pos.length === 0) {
      setArrivingItems([]);
      return;
    }

    const items: ArrivingItem[] = [];

    for (const po of pos) {
      const { data: lineItems } = await supabase
        .from('purchase_order_line_items')
        .select('product_name, quantity_ordered, quantity_received')
        .eq('po_id', po.id);

      if (lineItems) {
        for (const item of lineItems) {
          const remaining = item.quantity_ordered - item.quantity_received;
          if (remaining > 0) {
            items.push({
              po_number: po.po_number,
              vendor_name: po.vendors?.vendor_name || 'Unknown',
              expected_quantity: remaining,
              product_name: item.product_name,
            });
          }
        }
      }
    }

    setArrivingItems(items);
  };

  const loadShortItems = async (companyId: string) => {
    const { data: pos } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('company_id', companyId);

    if (!pos || pos.length === 0) {
      setShortItems([]);
      return;
    }

    const { data: shortLineItems } = await supabase
      .from('purchase_order_line_items')
      .select('style_number, color, size, quantity_ordered, quantity_received, quantity_short')
      .in('po_id', pos.map(p => p.id))
      .gt('quantity_short', 0)
      .limit(20);

    if (shortLineItems) {
      setShortItems(
        shortLineItems.map(item => ({
          style_number: item.style_number,
          color: item.color,
          size: item.size,
          needed: item.quantity_ordered,
          ordered: item.quantity_ordered,
          received: item.quantity_received,
          shortage: item.quantity_ordered - item.quantity_received,
        }))
      );
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-400', label: 'Draft' },
      sent: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', label: 'Sent' },
      confirmed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', label: 'Confirmed' },
      cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400', label: 'Cancelled' },
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'Pending' },
      partial: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400', label: 'Partial' },
      complete: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', label: 'Complete' },
    };

    const config = configs[status] || configs.draft;

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'overdue':
        return <Clock className="w-5 h-5 text-red-600" />;
      case 'delay':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'backorder':
        return <XCircle className="w-5 h-5 text-yellow-600" />;
      case 'blocked':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-600" />;
    }
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Goods</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Purchase orders, receiving, and inventory management
        </p>
      </div>

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alerts</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  alert.severity === 'high'
                    ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10'
                    : alert.severity === 'medium'
                    ? 'border-orange-200 bg-orange-50 dark:border-orange-900/30 dark:bg-orange-900/10'
                    : 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-900/10'
                }`}
              >
                {getAlertIcon(alert.type)}
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {alert.title}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {alert.description}
                  </p>
                </div>
                {alert.action && (
                  <button
                    onClick={() => {
                      if (alert.type === 'overdue') onNavigate('receiving');
                      else if (alert.type === 'backorder') onNavigate('garment-report');
                      else if (alert.type === 'blocked') onNavigate('garment-report');
                    }}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap"
                  >
                    {alert.action}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('purchase-orders', 'create')}
            className="flex flex-col items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <PlusCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Create PO</span>
          </button>

          <button
            onClick={() => onNavigate('receiving')}
            className="flex flex-col items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
          >
            <Truck className="w-6 h-6 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Receive Goods</span>
          </button>

          <button
            onClick={() => onNavigate('garment-report')}
            className="flex flex-col items-center gap-2 p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
          >
            <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Garment Report</span>
          </button>

          <button
            onClick={() => onNavigate('purchase-orders')}
            className="flex flex-col items-center gap-2 p-4 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
          >
            <ShoppingCart className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">View All POs</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent POs */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Purchase Orders</h3>
            <button
              onClick={() => onNavigate('purchase-orders')}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {recentPOs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No purchase orders yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentPOs.map((po) => (
                  <button
                    key={po.id}
                    onClick={() => onNavigate('purchase-orders', 'detail', po.id)}
                    className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{po.po_number}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{po.vendor_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          ${po.total_cost?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {format(parseISO(po.created_at), 'MMM d')}
                        </p>
                      </div>
                      {getStatusBadge(po.receiving_status)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items Arriving Today */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Arriving Today</h3>
            <button
              onClick={() => onNavigate('receiving')}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
            >
              Receive
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {arrivingItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No deliveries expected today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {arrivingItems.slice(0, 8).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border-b border-gray-100 dark:border-slate-700 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {item.vendor_name} • {item.po_number}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {item.expected_quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Short */}
      {shortItems.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Items Short</h3>
            <button
              onClick={() => onNavigate('garment-report')}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
            >
              View Report
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    Style
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    Color
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    Size
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    Needed
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    Ordered
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    Received
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                    Shortage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {shortItems.slice(0, 10).map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {item.style_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {item.color}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {item.size}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                      {item.needed}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                      {item.ordered}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                      {item.received}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-600 dark:text-red-400">
                      {item.shortage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
