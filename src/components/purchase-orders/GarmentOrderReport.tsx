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
  FileText,
  Search,
  AlertCircle,
  ShoppingCart,
  Users,
  Layers,
  FileDown,
  Plus,
  CheckCircle,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

interface Vendor {
  id: string;
  vendor_name: string;
  vendor_type: string;
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
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; company_name: string }>>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorModalItems, setVendorModalItems] = useState<GarmentNeed[]>([]);
  const [modalVendorId, setModalVendorId] = useState('');
  const [addingToPO, setAddingToPO] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [garments, searchTerm, selectedVendor, selectedCustomer, showMissingOnly]);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 4000);
  };

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
      setCompanyId(profile.company_id);

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
        qty_5xl,
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
      .in('quotes.status', ['approved', 'converted', 'in_production']);

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
          vendors!purchase_orders_vendor_id_fkey (
            vendor_name
          )
        )
      `)
      .eq('purchase_orders.company_id', companyId);

    if (poError) throw poError;

    const garmentMap = new Map<string, GarmentNeed>();

    quoteLineItems?.forEach((item: any) => {
      const sizeQuantities: Record<string, number> = {
        'XS': item.qty_xs || 0,
        'S': item.qty_s || 0,
        'M': item.qty_m || 0,
        'L': item.qty_l || 0,
        'XL': item.qty_xl || 0,
        '2XL': item.qty_2xl || 0,
        '3XL': item.qty_3xl || 0,
        '4XL': item.qty_4xl || 0,
        '5XL': item.qty_5xl || 0,
        'YXS': item.qty_yxs || 0,
        'YS': item.qty_ys || 0,
        'YM': item.qty_ym || 0,
        'YL': item.qty_yl || 0,
        'YXL': item.qty_yxl || 0,
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
          vendor_name: item.purchase_orders.vendors?.vendor_name || 'Unknown',
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
      .select('id, vendor_name, vendor_type')
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

  const getItemKey = (g: GarmentNeed) => `${g.style_number}-${g.color}-${g.size}`;

  const toggleItemSelection = (garment: GarmentNeed) => {
    const key = getItemKey(garment);
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const remainingItems = filteredGarments.filter((g) => g.remaining > 0);
    if (selectedItems.size === remainingItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(remainingItems.map(getItemKey)));
    }
  };

  const openAddToPOModal = (items: GarmentNeed[]) => {
    if (items.length === 0) {
      alert('No items selected');
      return;
    }
    setVendorModalItems(items);
    setModalVendorId('');
    setShowVendorModal(true);
  };

  const handleAddToPO = async () => {
    if (!modalVendorId || !companyId) return;

    try {
      setAddingToPO(true);

      const itemsPayload = vendorModalItems.map((item) => ({
        style_number: item.style_number,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        quantity: item.remaining,
      }));

      const { data, error } = await supabase.rpc('add_garment_items_to_po', {
        p_company_id: companyId,
        p_vendor_id: modalVendorId,
        p_items: itemsPayload,
      });

      if (error) throw error;

      setShowVendorModal(false);
      setSelectedItems(new Set());
      showToast(`Added to ${data.po_number}`);

      await loadGarmentNeeds(companyId);
    } catch (error: any) {
      console.error('Error adding to PO:', error);
      alert(`Failed to add items to PO: ${error.message}`);
    } finally {
      setAddingToPO(false);
    }
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
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Garment Order Report', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy')}`, 14, 30);

    const tableData = filteredGarments.map((g) => [
      g.style_number,
      g.product_name,
      g.color,
      g.size,
      g.supplier,
      g.total_needed.toString(),
      g.on_po.toString(),
      g.received.toString(),
      g.remaining.toString(),
    ]);

    (doc as any).autoTable({
      head: [['Style', 'Description', 'Color', 'Size', 'Supplier', 'Needed', 'On PO', 'Received', 'Remaining']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
    });

    doc.save(`garment-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedVendor('all');
    setSelectedCustomer('all');
    setShowMissingOnly(false);
  };

  const groupGarments = () => {
    const grouped = new Map<string, GarmentNeed[]>();

    filteredGarments.forEach((garment) => {
      let key = '';
      switch (groupBy) {
        case 'style':
          key = garment.style_number;
          break;
        case 'vendor':
          key = garment.supplier;
          break;
        case 'customer':
          key = garment.jobs[0]?.customer_name || 'Unknown';
          break;
        case 'job':
          key = garment.jobs[0]?.quote_number || 'Unknown';
          break;
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(garment);
    });

    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const stats = getTotalStats();
  const groupedData = groupGarments();
  const remainingItems = filteredGarments.filter((g) => g.remaining > 0);
  const allRemainingSelected = remainingItems.length > 0 && selectedItems.size === remainingItems.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast.visible && (
        <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-right">
          <div className="flex items-center gap-3 px-5 py-3 bg-green-600 text-white rounded-lg shadow-xl">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

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
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
          {selectedItems.size > 0 && (
            <button
              onClick={() => {
                const items = filteredGarments.filter((g) => selectedItems.has(getItemKey(g)) && g.remaining > 0);
                openAddToPOModal(items);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Selected to PO ({selectedItems.size})
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 dark:bg-slate-900 rounded-lg border border-slate-700 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 dark:text-gray-400">Total Needed</p>
              <p className="text-2xl font-bold text-white dark:text-white mt-1">
                {stats.totalNeeded.toLocaleString()}
              </p>
            </div>
            <Package className="w-8 h-8 text-blue-400 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-slate-900 dark:bg-slate-900 rounded-lg border border-slate-700 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 dark:text-gray-400">On PO</p>
              <p className="text-2xl font-bold text-blue-400 dark:text-blue-400 mt-1">
                {stats.onPO.toLocaleString()}
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-400 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-slate-900 dark:bg-slate-900 rounded-lg border border-slate-700 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 dark:text-gray-400">Received</p>
              <p className="text-2xl font-bold text-green-400 dark:text-green-400 mt-1">
                {stats.received.toLocaleString()}
              </p>
            </div>
            <Package className="w-8 h-8 text-green-400 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-slate-900 dark:bg-slate-900 rounded-lg border border-slate-700 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 dark:text-gray-400">Remaining to Order</p>
              <p className="text-2xl font-bold text-orange-400 dark:text-orange-400 mt-1">
                {stats.remaining.toLocaleString()}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-400 dark:text-orange-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by style, product, or color..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 text-white transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-700 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                Group By
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
              >
                <option value="style">Style</option>
                <option value="vendor">Vendor</option>
                <option value="job">Job</option>
                <option value="customer">Customer</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                Vendor
              </label>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
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
              <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 dark:bg-slate-700 border border-slate-600 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white"
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
              <label className="block text-sm font-medium text-gray-300 dark:text-gray-300 mb-2">
                Options
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showMissingOnly}
                  onChange={(e) => setShowMissingOnly(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300 dark:text-gray-300">
                  Show missing items only
                </span>
              </label>
            </div>

            {(searchTerm || selectedVendor !== 'all' || selectedCustomer !== 'all' || showMissingOnly) && (
              <div className="col-span-full">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
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
      <div className="bg-slate-900 dark:bg-slate-800 rounded-lg border border-slate-700 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-950 dark:bg-slate-900 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allRemainingSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                    title="Select all items with remaining quantities"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                  Style Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                  Color
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                  Total Needed
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                  On PO
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                  Received
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                  Remaining
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 dark:divide-slate-700">
              {filteredGarments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Package className="w-16 h-16 text-gray-600 dark:text-gray-600 mb-4" />
                      <p className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                        No garments match your filters
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-500 mb-4">
                        {garments.length === 0
                          ? 'Approve quotes with garments to see them here.'
                          : 'Try adjusting your search criteria or filters.'}
                      </p>
                      {(searchTerm || selectedVendor !== 'all' || selectedCustomer !== 'all' || showMissingOnly) && (
                        <button
                          onClick={clearFilters}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Reset Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                groupedData.map(([groupKey, items]) => (
                  <React.Fragment key={groupKey}>
                    <tr className="bg-slate-800 dark:bg-slate-900">
                      <td colSpan={11} className="px-4 py-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          {groupBy === 'style' && <Layers className="w-4 h-4" />}
                          {groupBy === 'vendor' && <ShoppingCart className="w-4 h-4" />}
                          {groupBy === 'customer' && <Users className="w-4 h-4" />}
                          {groupBy === 'job' && <FileText className="w-4 h-4" />}
                          <span>{groupKey}</span>
                          <span className="text-xs text-gray-400">({items.length} items)</span>
                        </div>
                      </td>
                    </tr>
                    {items.map((garment, index) => {
                      const hasRemaining = garment.remaining > 0;
                      const isSelected = selectedItems.has(getItemKey(garment));
                      return (
                        <tr
                          key={`${groupKey}-${index}`}
                          className={`hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors ${
                            hasRemaining ? 'bg-yellow-900/10' : ''
                          } ${isSelected ? 'bg-blue-900/20' : ''}`}
                        >
                          <td className="px-4 py-3">
                            {hasRemaining && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItemSelection(garment)}
                                className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-white">
                            {garment.style_number}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {garment.product_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {garment.color}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {garment.size}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {garment.supplier}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-white">
                            {garment.total_needed}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-blue-400">
                            {garment.on_po}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-green-400">
                            {garment.received}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span
                              className={`font-semibold ${
                                garment.remaining === 0
                                  ? 'text-gray-500'
                                  : 'text-orange-400'
                              }`}
                            >
                              {garment.remaining}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {hasRemaining && (
                                <button
                                  onClick={() => openAddToPOModal([garment])}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-400 hover:bg-green-900/30 rounded transition-colors"
                                  title="Add to Purchase Order"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add to PO
                                </button>
                              )}
                              <button
                                onClick={() => handleDrillDown(garment)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {filteredGarments.length > 0 && (
        <div className="text-sm text-gray-400 dark:text-gray-400">
          Showing {filteredGarments.length} garment variants
        </div>
      )}

      {/* Vendor Selection Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 dark:bg-slate-800 rounded-lg max-w-lg w-full border border-slate-700 shadow-2xl">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Add to Purchase Order</h3>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {vendorModalItems.length} item{vendorModalItems.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVendorModal(false)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="max-h-40 overflow-y-auto space-y-2">
                {vendorModalItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 bg-slate-800 rounded-lg text-sm"
                  >
                    <div className="text-gray-300">
                      <span className="font-medium text-white">{item.style_number}</span>
                      {' '}/{' '}{item.color}{' '}/{' '}{item.size}
                    </div>
                    <span className="text-orange-400 font-medium">{item.remaining} units</span>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Vendor
                </label>
                <select
                  value={modalVendorId}
                  onChange={(e) => setModalVendorId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-white text-sm"
                >
                  <option value="">Choose a vendor...</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendor_name} ({vendor.vendor_type})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  If a draft PO already exists for this vendor today, items will be added to it.
                  Otherwise a new PO will be created.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowVendorModal(false)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToPO}
                disabled={!modalVendorId || addingToPO}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addingToPO ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {addingToPO ? 'Adding...' : 'Add to PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drill-Down Modal */}
      {showDrillDown && selectedGarment && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden border border-slate-700">
            <div className="p-6 border-b border-slate-700 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white dark:text-white">
                    Garment Details
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">
                    {selectedGarment.style_number} - {selectedGarment.color} - {selectedGarment.size}
                  </p>
                </div>
                <button
                  onClick={() => setShowDrillDown(false)}
                  className="p-2 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400 dark:text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-white dark:text-white mb-4">
                    Jobs Requiring This Garment
                  </h4>
                  <div className="space-y-3">
                    {selectedGarment.jobs.map((job, idx) => (
                      <div
                        key={idx}
                        className="border border-slate-700 dark:border-slate-700 rounded-lg p-3 bg-slate-800"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-white dark:text-white">
                              {job.quote_number}
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-400">
                              {job.customer_name}
                            </p>
                          </div>
                          <span className="px-2 py-1 bg-blue-900/40 text-blue-400 text-xs font-medium rounded">
                            {job.quantity} units
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-white dark:text-white mb-4">
                    Purchase Orders
                  </h4>
                  {selectedGarment.pos.length === 0 ? (
                    <div className="border border-slate-700 dark:border-slate-700 rounded-lg p-6 text-center bg-slate-800">
                      <Package className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                      <p className="text-sm text-gray-400 dark:text-gray-400">
                        No purchase orders yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedGarment.pos.map((po, idx) => (
                        <div
                          key={idx}
                          className="border border-slate-700 dark:border-slate-700 rounded-lg p-3 bg-slate-800"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-white dark:text-white">
                                {po.po_number}
                              </p>
                              <p className="text-sm text-gray-400 dark:text-gray-400">
                                {po.vendor_name}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-400 dark:text-gray-400">Ordered:</span>
                              <span className="ml-2 font-medium text-white dark:text-white">
                                {po.quantity_ordered}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-400 dark:text-gray-400">Received:</span>
                              <span className="ml-2 font-medium text-green-400 dark:text-green-400">
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

              <div className="mt-6 pt-6 border-t border-slate-700 dark:border-slate-700">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-400 dark:text-gray-400">Total Needed</p>
                    <p className="text-2xl font-bold text-white dark:text-white mt-1">
                      {selectedGarment.total_needed}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 dark:text-gray-400">On PO</p>
                    <p className="text-2xl font-bold text-blue-400 dark:text-blue-400 mt-1">
                      {selectedGarment.on_po}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 dark:text-gray-400">Received</p>
                    <p className="text-2xl font-bold text-green-400 dark:text-green-400 mt-1">
                      {selectedGarment.received}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 dark:text-gray-400">Remaining</p>
                    <p className="text-2xl font-bold text-orange-400 dark:text-orange-400 mt-1">
                      {selectedGarment.remaining}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 dark:border-slate-700 flex gap-3 justify-end">
              {selectedGarment.remaining > 0 && (
                <button
                  onClick={() => {
                    setShowDrillDown(false);
                    openAddToPOModal([selectedGarment]);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add to PO
                </button>
              )}
              <button
                onClick={() => setShowDrillDown(false)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
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
