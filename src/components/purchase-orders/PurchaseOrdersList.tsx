import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  Plus,
  Search,
  Filter,
  Download,
  Send,
  Package,
  Eye,
  Edit,
  Loader2,
  Calendar,
  DollarSign,
  Building2,
  ChevronDown,
  X,
  Archive,
  FileText,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor: {
    id: string;
    vendor_name: string;
    vendor_type: string;
  };
  status: string;
  total_cost: number;
  expected_delivery_date: string | null;
  created_at: string;
  created_by_name?: string;
}

interface PurchaseOrdersListProps {
  onCreateNew: () => void;
  onViewDetail: (poId: string) => void;
}

export function PurchaseOrdersList({ onCreateNew, onViewDetail }: PurchaseOrdersListProps) {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [filteredPos, setFilteredPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPos, setSelectedPos] = useState<Set<string>>(new Set());
  const [vendors, setVendors] = useState<Array<{ id: string; vendor_name: string }>>([]);

  useEffect(() => {
    loadPurchaseOrders();
    loadVendors();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [pos, searchTerm, selectedStatus, selectedVendor, dateRange]);

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          status,
          total_cost,
          expected_delivery_date,
          created_at,
          vendor:vendors!purchase_orders_vendor_id_fkey (
            id,
            vendor_name,
            vendor_type
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPos(data || []);
    } catch (error) {
      console.error('Error loading purchase orders:', error);
      alert('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('is_active', true)
        .order('vendor_name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...pos];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (po) =>
          po.po_number.toLowerCase().includes(term) ||
          po.vendor.vendor_name.toLowerCase().includes(term)
      );
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((po) => po.status === selectedStatus);
    }

    if (selectedVendor !== 'all') {
      filtered = filtered.filter((po) => po.vendor.id === selectedVendor);
    }

    if (dateRange.start) {
      filtered = filtered.filter((po) => new Date(po.created_at) >= new Date(dateRange.start));
    }

    if (dateRange.end) {
      filtered = filtered.filter((po) => new Date(po.created_at) <= new Date(dateRange.end));
    }

    setFilteredPos(filtered);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-[#2A2A2A] dark:text-gray-300 dark:border-[#3A3A3A]',
      sent: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
      confirmed: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
      in_transit: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
      partially_received: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
      fully_received: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      closed: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-[#2A2A2A] dark:text-gray-500 dark:border-[#3A3A3A]',
    };

    const labels = {
      draft: 'Draft',
      sent: 'Sent',
      confirmed: 'Confirmed',
      in_transit: 'In Transit',
      partially_received: 'Partially Received',
      fully_received: 'Fully Received',
      closed: 'Closed',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${styles[status as keyof typeof styles] || styles.draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const handleBulkMarkAsSent = async () => {
    if (selectedPos.size === 0) {
      alert('Please select purchase orders to mark as sent');
      return;
    }

    if (!confirm(`Mark ${selectedPos.size} purchase order(s) as sent?`)) return;

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .in('id', Array.from(selectedPos));

      if (error) throw error;
      alert('Purchase orders marked as sent');
      setSelectedPos(new Set());
      loadPurchaseOrders();
    } catch (error) {
      console.error('Error updating purchase orders:', error);
      alert('Failed to update purchase orders');
    }
  };

  const handleBulkArchive = async () => {
    if (selectedPos.size === 0) {
      alert('Please select purchase orders to archive');
      return;
    }

    if (!confirm(`Archive ${selectedPos.size} purchase order(s)?`)) return;

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'closed' })
        .in('id', Array.from(selectedPos));

      if (error) throw error;
      alert('Purchase orders archived');
      setSelectedPos(new Set());
      loadPurchaseOrders();
    } catch (error) {
      console.error('Error archiving purchase orders:', error);
      alert('Failed to archive purchase orders');
    }
  };

  const handleBulkExport = () => {
    if (filteredPos.length === 0) {
      alert('No purchase orders to export');
      return;
    }

    const csv = [
      ['PO Number', 'Vendor', 'Status', 'Total Cost', 'Expected Delivery', 'Created Date'],
      ...filteredPos.map((po) => [
        po.po_number,
        po.vendor.vendor_name,
        po.status,
        `$${po.total_cost.toFixed(2)}`,
        po.expected_delivery_date ? format(new Date(po.expected_delivery_date), 'MM/dd/yyyy') : '',
        format(new Date(po.created_at), 'MM/dd/yyyy'),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const handleSelectAll = () => {
    if (selectedPos.size === filteredPos.length) {
      setSelectedPos(new Set());
    } else {
      setSelectedPos(new Set(filteredPos.map((po) => po.id)));
    }
  };

  const toggleSelection = (poId: string) => {
    const newSelected = new Set(selectedPos);
    if (newSelected.has(poId)) {
      newSelected.delete(poId);
    } else {
      newSelected.add(poId);
    }
    setSelectedPos(newSelected);
  };

  const handleDeletePO = async (po: PurchaseOrder) => {
    if (!confirm(`Delete purchase order ${po.po_number}? This will also remove all associated records and cannot be undone.`)) return;

    try {
      await supabase.from('purchase_order_attachments').delete().eq('po_id', po.id);
      await supabase.from('purchase_order_line_items').delete().eq('po_id', po.id);
      await supabase.from('purchase_order_activity_log').delete().eq('po_id', po.id);
      await supabase.from('receiving_logs').delete().eq('po_id', po.id);
      await supabase.from('garment_requirements_staging').delete().eq('po_id', po.id);

      const { error: poError } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', po.id);

      if (poError) throw poError;

      setSelectedPos((prev) => {
        const next = new Set(prev);
        next.delete(po.id);
        return next;
      });
      loadPurchaseOrders();
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      alert('Failed to delete purchase order');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('all');
    setSelectedVendor('all');
    setDateRange({ start: '', end: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white dark:bg-[#121212] rounded-lg border border-gray-200 dark:border-[#2A2A2A]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-gray-600 dark:text-[#A0A0A0]">Loading purchase orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-[#EDEDED]">Purchase Orders</h2>
          <p className="text-sm text-gray-600 dark:text-[#A0A0A0] mt-1">
            Manage vendor purchase orders and track deliveries
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Purchase Order
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-lg border border-gray-200 dark:border-[#2A2A2A] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by PO number or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-[#121212] text-gray-900 dark:text-[#EDEDED] placeholder-gray-400 dark:placeholder-gray-600 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg font-medium transition-all ${
              showFilters
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                : 'border-gray-300 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] text-gray-700 dark:text-[#EDEDED] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={handleBulkExport}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-[#2A2A2A] rounded-lg bg-white dark:bg-[#121212] text-gray-700 dark:text-[#EDEDED] hover:bg-gray-50 dark:hover:bg-[#2A2A2A] transition-all font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-200 dark:border-[#2A2A2A]">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-[#121212] text-gray-900 dark:text-[#EDEDED]"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_transit">In Transit</option>
                <option value="partially_received">Partially Received</option>
                <option value="fully_received">Fully Received</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Vendor
              </label>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-[#121212] text-gray-900 dark:text-[#EDEDED]"
              >
                <option value="all">All Vendors</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.vendor_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-[#121212] text-gray-900 dark:text-[#EDEDED]"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#2A2A2A] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-[#121212] text-gray-900 dark:text-[#EDEDED]"
                />
              </div>
            </div>

            {(searchTerm || selectedStatus !== 'all' || selectedVendor !== 'all' || dateRange.start || dateRange.end) && (
              <div className="col-span-full">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedPos.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">
              {selectedPos.size} purchase order{selectedPos.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkMarkAsSent}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 text-sm font-medium transition-all"
              >
                <Send className="w-4 h-4" />
                Mark as Sent
              </button>
              <button
                onClick={handleBulkArchive}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1A1A1A] border border-gray-300 dark:border-[#2A2A2A] text-gray-700 dark:text-[#EDEDED] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2A2A2A] text-sm font-medium transition-all"
              >
                <Archive className="w-4 h-4" />
                Archive
              </button>
              <button
                onClick={() => setSelectedPos(new Set())}
                className="px-4 py-2 border border-blue-300 dark:border-blue-500/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-900 dark:text-blue-300 text-sm font-medium transition-all"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-lg border border-gray-200 dark:border-[#2A2A2A] overflow-hidden shadow-sm">
        {filteredPos.length === 0 && pos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mb-5">
              <Package className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-[#EDEDED] mb-2">
              No purchase orders yet
            </h3>
            <p className="text-sm text-gray-600 dark:text-[#A0A0A0] text-center mb-6 max-w-md">
              Create your first purchase order to start ordering garments and supplies from your vendors.
            </p>
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-200 font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Purchase Order
            </button>
          </div>
        ) : filteredPos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <FileText className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-[#A0A0A0]">No purchase orders match your filters.</p>
            <button
              onClick={clearFilters}
              className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#121212] border-b border-gray-200 dark:border-[#2A2A2A]">
                  <th className="px-5 py-3.5 text-left">
                    <input
                      type="checkbox"
                      checked={selectedPos.size === filteredPos.length && filteredPos.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 dark:border-[#2A2A2A] text-blue-600 focus:ring-blue-500 dark:bg-[#121212]"
                    />
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-[#A0A0A0] uppercase tracking-wider">
                    PO Number
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-[#A0A0A0] uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-[#A0A0A0] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-[#A0A0A0] uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-[#A0A0A0] uppercase tracking-wider">
                    Expected Delivery
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-[#A0A0A0] uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-[#A0A0A0] uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-[#2A2A2A]">
                {filteredPos.map((po) => (
                  <tr
                    key={po.id}
                    className="hover:bg-gray-50 dark:hover:bg-[#121212] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedPos.has(po.id)}
                        onChange={() => toggleSelection(po.id)}
                        className="rounded border-gray-300 dark:border-[#2A2A2A] text-blue-600 focus:ring-blue-500 dark:bg-[#121212]"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => onViewDetail(po.id)}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        {po.po_number}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-[#2A2A2A] rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-[#EDEDED]">
                          {po.vendor.vendor_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(po.status)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-[#EDEDED]">
                          {po.total_cost.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {po.expected_delivery_date ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                          <span className="text-sm text-gray-600 dark:text-[#A0A0A0]">
                            {format(new Date(po.expected_delivery_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-gray-600 dark:text-[#A0A0A0]">
                        {format(new Date(po.created_at), 'MMM dd, yyyy')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewDetail(po.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 dark:text-[#EDEDED] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] rounded-lg transition-all font-medium"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleDeletePO(po)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {filteredPos.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-[#A0A0A0]">
            Showing <span className="font-semibold text-gray-900 dark:text-[#EDEDED]">{filteredPos.length}</span> of{' '}
            <span className="font-semibold text-gray-900 dark:text-[#EDEDED]">{pos.length}</span> purchase orders
          </span>
        </div>
      )}
    </div>
  );
}
