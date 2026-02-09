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
}

export function ReceivingDashboard({ onReceivePO, onViewPO }: ReceivingDashboardProps) {
  const [closedPOs, setClosedPOs] = useState<PurchaseOrder[]>([]);
  const [overduePOs, setOverduePOs] = useState<PurchaseOrder[]>([]);
  const [openPOs, setOpenPOs] = useState<PurchaseOrder[]>([]);
  const [recentReceiving, setRecentReceiving] = useState<any[]>([]);
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
      ]);
    } catch (error) {
      console.error('Error loading receiving dashboard:', error);
      alert('Failed to load receiving data');
    } finally {
      setLoading(false);
    }
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
      .in('status', ['sent', 'fully_received', 'closed'])
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
      .in('status', ['confirmed', 'in_transit', 'partially_received'])
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

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <p className="text-sm text-gray-600 dark:text-gray-400">Overdue POs</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                {overduePOs.length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Arriving Today */}
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
              <div className="space-y-3">
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

        {/* Overdue POs */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Overdue Deliveries</h3>
            </div>
          </div>
          <div className="p-4">
            {overduePOs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>No overdue purchase orders</p>
              </div>
            ) : (
              <div className="space-y-3">
                {overduePOs.map((po) => (
                  <div
                    key={po.id}
                    className="border border-orange-200 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-900/10 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{po.po_number}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{po.vendor_name}</p>
                        {po.expected_delivery_date && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {getDaysOverdue(po.expected_delivery_date)} days overdue
                          </p>
                        )}
                      </div>
                      {getStatusBadge(po.receiving_status)}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{po.received_items}</span> / {po.total_items} items received
                      </div>
                      <button
                        onClick={() => onReceivePO(po.id)}
                        className="px-3 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
                      >
                        Receive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
    </div>
  );
}
