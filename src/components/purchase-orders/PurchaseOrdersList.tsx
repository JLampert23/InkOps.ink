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
  Loader2,
  Calendar,
  DollarSign,
  Building2,
  ChevronDown,
  X,
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
          vendor:vendors!vendor_id (
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
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      confirmed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      in_transit: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      partially_received: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      fully_received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.draft}`}>
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

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('all');
    setSelectedVendor('all');
    setDateRange({ start: '', end: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Purchase Orders</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage vendor purchase orders and track deliveries
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create PO
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PO number or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-white"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={handleBulkExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 dark:text-white"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
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
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                />
              </div>
            </div>

            {(searchTerm || selectedStatus !== 'all' || selectedVendor !== 'all' || dateRange.start || dateRange.end) && (
              <div className="col-span-full">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
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
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
              {selectedPos.size} purchase order(s) selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkMarkAsSent}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Send className="w-4 h-4" />
                Mark as Sent
              </button>
              <button
                onClick={() => setSelectedPos(new Set())}
                className="px-3 py-1.5 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-900 dark:text-blue-300 text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedPos.size === filteredPos.length && filteredPos.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-slate-600"
                  />
                </th>
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
                  Total Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Expected Delivery
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {filteredPos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {pos.length === 0 ? (
                      <div>
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No purchase orders yet. Create your first PO to get started.</p>
                      </div>
                    ) : (
                      <p>No purchase orders match your filters.</p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredPos.map((po) => (
                  <tr
                    key={po.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedPos.has(po.id)}
                        onChange={() => toggleSelection(po.id)}
                        className="rounded border-gray-300 dark:border-slate-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onViewDetail(po.id)}
                        className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {po.po_number}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {po.vendor.vendor_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(po.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          ${po.total_cost.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {po.expected_delivery_date ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {format(new Date(po.expected_delivery_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(po.created_at), 'MMM dd, yyyy')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onViewDetail(po.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 rounded transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {filteredPos.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredPos.length} of {pos.length} purchase orders
        </div>
      )}
    </div>
  );
}
