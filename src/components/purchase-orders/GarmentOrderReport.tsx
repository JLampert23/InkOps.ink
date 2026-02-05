import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  Download,
  Filter,
  ChevronDown,
  X,
  Package,
  Loader2,
  Eye,
  Plus,
  FileText,
  Search,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface GarmentNeed {
  style_number: string;
  product_name: string;
  color: string;
  size: string;
  supplier: string;
  total_needed: number;
  on_po: number;
  received: number;
  remaining: number;
  jobs: Array<{
    quote_id: string;
    quote_number: string;
    customer_name: string;
    quantity: number;
  }>;
  pos: Array<{
    po_id: string;
    po_number: string;
    vendor_name: string;
    quantity_ordered: number;
    quantity_received: number;
  }>;
}

interface GarmentOrderReportProps {
  onCreatePO?: (items: GarmentNeed[]) => void;
}

export function GarmentOrderReport({ onCreatePO }: GarmentOrderReportProps) {
  const [garments, setGarments] = useState<GarmentNeed[]>([]);
  const [filteredGarments, setFilteredGarments] = useState<GarmentNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'style' | 'vendor' | 'job' | 'customer'>('style');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState<GarmentNeed | null>(null);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [vendors, setVendors] = useState<Array<{ id: string; vendor_name: string }>>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; company_name: string }>>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [garments, searchTerm, selectedVendor, selectedCustomer, showMissingOnly]);

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
        loadGarmentNeeds(profile.company_id),
        loadVendors(profile.company_id),
        loadCustomers(profile.company_id),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load garment report data');
    } finally {
      setLoading(false);
    }
  };

  const loadGarmentNeeds = async (companyId: string) => {
    const { data: quoteLineItems, error: quoteError } = await supabase
      .from('quote_line_items')
      .select(`
        item_number,
        description,
        color,
        supplier_name,
        quote_id,
        qty_xs,
        qty_s,
        qty_m,
        qty_l,
        qty_xl,
        qty_2xl,
        qty_3xl,
        qty_4xl,
        qty_yxs,
        qty_ys,
        qty_ym,
        qty_yl,
        qty_yxl,
        quotes!inner (
          id,
          quote_number,
          customer_name,
          status,
          company_id
        )
      `)
      .eq('quotes.company_id', companyId)
      .in('quotes.status', ['pending', 'approved', 'in_production']);

    if (quoteError) throw quoteError;

    const { data: poLineItems, error: poError } = await supabase
      .from('purchase_order_line_items')
      .select(`
        item_number:style_number,
        product_name,
        color,
        size,
        quantity_ordered,
        quantity_received,
        po_id,
        purchase_orders!inner (
          id,
          po_number,
          company_id,
          vendor:vendors!vendor_id (
            vendor_name
          )
        )
      `)
      .eq('purchase_orders.company_id', companyId);

    if (poError) throw poError;

    const garmentMap = new Map<string, GarmentNeed>();

    quoteLineItems?.forEach((item: any) => {
      const sizeQuantities = {
        'XS': item.qty_xs || 0,
        'S': item.qty_s || 0,
        'M': item.qty_m || 0,
        'L': item.qty_l || 0,
        'XL': item.qty_xl || 0,
        '2XL': item.qty_2xl || 0,
        '3XL': item.qty_3xl || 0,
        '4XL': item.qty_4xl || 0,
        'Youth XS': item.qty_yxs || 0,
        'Youth S': item.qty_ys || 0,
        'Youth M': item.qty_ym || 0,
        'Youth L': item.qty_yl || 0,
        'Youth XL': item.qty_yxl || 0,
      };

      Object.entries(sizeQuantities).forEach(([size, quantity]) => {
        if (quantity > 0) {
          const key = `${item.item_number || 'N/A'}-${item.color || 'N/A'}-${size}`;

          if (!garmentMap.has(key)) {
            garmentMap.set(key, {
              style_number: item.item_number || 'N/A',
              product_name: item.description || 'Unknown Product',
              color: item.color || 'N/A',
              size: size,
              supplier: item.supplier_name || 'Unknown',
              total_needed: 0,
              on_po: 0,
              received: 0,
              remaining: 0,
              jobs: [],
              pos: [],
            });
          }

          const garment = garmentMap.get(key)!;
          garment.total_needed += quantity;
          garment.jobs.push({
            quote_id: item.quotes.id,
            quote_number: item.quotes.quote_number,
            customer_name: item.quotes.customer_name,
            quantity: quantity,
          });
        }
      });
    });

    poLineItems?.forEach((item: any) => {
      const key = `${item.item_number || 'N/A'}-${item.color || 'N/A'}-${item.size || 'N/A'}`;

      if (garmentMap.has(key)) {
        const garment = garmentMap.get(key)!;
        garment.on_po += item.quantity_ordered;
        garment.received += item.quantity_received;
        garment.pos.push({
          po_id: item.purchase_orders.id,
          po_number: item.purchase_orders.po_number,
          vendor_name: item.purchase_orders.vendor?.vendor_name || 'Unknown',
          quantity_ordered: item.quantity_ordered,
          quantity_received: item.quantity_received,
        });
      }
    });

    const garmentList = Array.from(garmentMap.values()).map((garment) => ({
      ...garment,
      remaining: Math.max(0, garment.total_needed - garment.received),
    }));

    setGarments(garmentList);
  };

  const loadVendors = async (companyId: string) => {
    const { data, error } = await supabase
      .from('vendors')
      .select('id, vendor_name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('vendor_name');

    if (error) throw error;
    setVendors(data || []);
  };

  const loadCustomers = async (companyId: string) => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, company_name')
      .eq('company_id', companyId)
      .order('company_name');

    if (error) throw error;
    setCustomers(data || []);
  };

  const applyFilters = () => {
    let filtered = [...garments];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.style_number.toLowerCase().includes(term) ||
          g.product_name.toLowerCase().includes(term) ||
          g.color.toLowerCase().includes(term)
      );
    }

    if (selectedVendor !== 'all') {
      filtered = filtered.filter((g) => g.supplier === selectedVendor);
    }

    if (selectedCustomer !== 'all') {
      filtered = filtered.filter((g) =>
        g.jobs.some((job) => job.customer_name === selectedCustomer)
      );
    }

    if (showMissingOnly) {
      filtered = filtered.filter((g) => g.remaining > 0);
    }

    setFilteredGarments(filtered);
  };

  const handleDrillDown = (garment: GarmentNeed) => {
    setSelectedGarment(garment);
    setShowDrillDown(true);
  };

  const exportToCSV = () => {
    const csv = [
      ['Style Number', 'Description', 'Color', 'Size', 'Supplier', 'Total Needed', 'On PO', 'Received', 'Remaining to Order'],
      ...filteredGarments.map((g) => [
        g.style_number,
        g.product_name,
        g.color,
        g.size,
        g.supplier,
        g.total_needed.toString(),
        g.on_po.toString(),
        g.received.toString(),
        g.remaining.toString(),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garment-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getTotalStats = () => {
    return filteredGarments.reduce(
      (acc, g) => ({
        totalNeeded: acc.totalNeeded + g.total_needed,
        onPO: acc.onPO + g.on_po,
        received: acc.received + g.received,
        remaining: acc.remaining + g.remaining,
      }),
      { totalNeeded: 0, onPO: 0, received: 0, remaining: 0 }
    );
  };

  const toggleSelection = (garment: GarmentNeed) => {
    const key = `${garment.style_number}-${garment.color}-${garment.size}`;
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedItems(newSelected);
  };

  const handleCreatePOForRemaining = () => {
    const itemsWithRemaining = filteredGarments.filter((g) => g.remaining > 0);
    if (itemsWithRemaining.length === 0) {
      alert('No items with remaining quantities to order');
      return;
    }
    if (onCreatePO) {
      onCreatePO(itemsWithRemaining);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedVendor('all');
    setSelectedCustomer('all');
    setShowMissingOnly(false);
  };

  const stats = getTotalStats();

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Garment Order Report</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track garment needs across jobs and purchase orders
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={handleCreatePOForRemaining}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create PO for Remaining
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Needed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.totalNeeded.toLocaleString()}
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">On PO</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {stats.onPO.toLocaleString()}
              </p>
            </div>
            <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Received</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {stats.received.toLocaleString()}
              </p>
            </div>
            <Package className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Remaining to Order</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                {stats.remaining.toLocaleString()}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by style, product, or color..."
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
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Group By
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              >
                <option value="style">Style</option>
                <option value="vendor">Vendor</option>
                <option value="job">Job</option>
                <option value="customer">Customer</option>
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
                  <option key={vendor.id} value={vendor.vendor_name}>
                    {vendor.vendor_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              >
                <option value="all">All Customers</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.company_name}>
                    {customer.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Options
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showMissingOnly}
                  onChange={(e) => setShowMissingOnly(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Show missing items only
                </span>
              </label>
            </div>

            {(searchTerm || selectedVendor !== 'all' || selectedCustomer !== 'all' || showMissingOnly) && (
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

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Style Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Color
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Total Needed
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  On PO
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Received
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Remaining
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {filteredGarments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {garments.length === 0 ? (
                      <div>
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>No garment data available. Create quotes with garments to see the report.</p>
                      </div>
                    ) : (
                      <p>No garments match your filters.</p>
                    )}
                  </td>
                </tr>
              ) : (
                filteredGarments.map((garment, index) => {
                  const key = `${garment.style_number}-${garment.color}-${garment.size}`;
                  const isLow = garment.remaining > garment.total_needed * 0.5;
                  return (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {garment.style_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {garment.product_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {garment.color}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {garment.size}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {garment.supplier}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                        {garment.total_needed}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">
                        {garment.on_po}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                        {garment.received}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={`font-medium ${
                            garment.remaining === 0
                              ? 'text-gray-400'
                              : isLow
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {garment.remaining}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDrillDown(garment)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors dark:text-blue-400"
                        >
                          <Eye className="w-4 h-4" />
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {filteredGarments.length > 0 && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredGarments.length} garment variants
        </div>
      )}

      {/* Drill-Down Modal */}
      {showDrillDown && selectedGarment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Garment Details
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {selectedGarment.style_number} - {selectedGarment.color} - {selectedGarment.size}
                  </p>
                </div>
                <button
                  onClick={() => setShowDrillDown(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              <div className="grid grid-cols-2 gap-6">
                {/* Jobs Requiring This Garment */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Jobs Requiring This Garment
                  </h4>
                  <div className="space-y-3">
                    {selectedGarment.jobs.map((job, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 dark:border-slate-700 rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {job.quote_number}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {job.customer_name}
                            </p>
                          </div>
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs font-medium rounded">
                            {job.quantity} units
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Purchase Orders */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Purchase Orders
                  </h4>
                  {selectedGarment.pos.length === 0 ? (
                    <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-6 text-center">
                      <Package className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        No purchase orders yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedGarment.pos.map((po, idx) => (
                        <div
                          key={idx}
                          className="border border-gray-200 dark:border-slate-700 rounded-lg p-3"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {po.po_number}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {po.vendor_name}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Ordered:</span>
                              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                {po.quantity_ordered}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Received:</span>
                              <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                                {po.quantity_received}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Needed</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                      {selectedGarment.total_needed}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">On PO</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                      {selectedGarment.on_po}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Received</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                      {selectedGarment.received}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Remaining</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                      {selectedGarment.remaining}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowDrillDown(false)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
