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
} from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { POSelectionModal } from './POSelectionModal';

const ALL_SIZES = [
  'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL',
  'YXS', 'YS', 'YM', 'YL', 'YXL',
];

interface SizeData {
  needed: number;
  on_po: number;
  received: number;
  remaining: number;
}

interface GarmentRow {
  style_number: string;
  product_name: string;
  color: string;
  supplier: string;
  sizes: Record<string, SizeData>;
  total_needed: number;
  total_on_po: number;
  total_received: number;
  total_remaining: number;
  requires_review?: boolean;
  change_reason?: string;
  original_data?: any;
  is_po_created?: boolean;
  is_ordered?: boolean;
  ordered_at?: string | null;
  jobs: Array<{
    quote_id: string;
    quote_number: string;
    customer_name: string;
    quantity: number;
    work_order_id?: string;
    work_order_number?: string;
  }>;
  pos: Array<{
    po_id: string;
    po_number: string;
    vendor_name: string;
    size: string;
    quantity_ordered: number;
    quantity_received: number;
    work_order_id?: string;
    work_order_number?: string;
  }>;
}

interface Vendor {
  id: string;
  vendor_name: string;
  vendor_type: string;
}

interface GarmentOrderReportProps {
  onCreatePO?: (items: GarmentRow[]) => void;
  onNavigate?: (tab: string, view?: string, id?: string) => void;
}

export function GarmentOrderReport({ onCreatePO, onNavigate }: GarmentOrderReportProps) {
  const [garments, setGarments] = useState<GarmentRow[]>([]);
  const [filteredGarments, setFilteredGarments] = useState<GarmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'style' | 'vendor' | 'job' | 'customer'>('style');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [showReviewOnly, setShowReviewOnly] = useState(false);
  const [showItemsOnPO, setShowItemsOnPO] = useState(false);
  const [hideFullyOnPO, setHideFullyOnPO] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState<GarmentRow | null>(null);
  const [showDrillDown, setShowDrillDown] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; company_name: string }>>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });
  const [poModal, setPOModal] = useState<{
    isOpen: boolean;
    vendorName: string;
    vendorId: string | null;
    items: Array<{
      style_number: string;
      product_name: string;
      color: string;
      size: string;
      quantity: number;
    }>;
  }>({
    isOpen: false,
    vendorName: '',
    vendorId: null,
    items: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [garments, searchTerm, selectedVendor, selectedCustomer, showMissingOnly, showReviewOnly, showItemsOnPO, hideFullyOnPO]);

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
    } finally {
      setLoading(false);
    }
  };

  const loadGarmentNeeds = async (cid: string) => {
    const { data: quoteLineItems, error: quoteError } = await supabase
      .from('quote_line_items')
      .select(`
        item_number, description, color, supplier_name, quote_id,
        qty_xs, qty_s, qty_m, qty_l, qty_xl,
        qty_2xl, qty_3xl, qty_4xl, qty_5xl,
        qty_yxs, qty_ys, qty_ym, qty_yl, qty_yxl,
        quotes!inner (id, quote_number, customer_name, status, company_id)
      `)
      .eq('quotes.company_id', cid)
      .in('quotes.status', ['approved', 'converted', 'in_production']);

    if (quoteError) throw quoteError;

    const { data: workOrders, error: woError } = await supabase
      .from('work_orders')
      .select('id, work_order_number, quote_id')
      .eq('company_id', cid);

    if (woError) throw woError;

    const workOrderMap = new Map<string, { id: string; work_order_number: string }>();
    workOrders?.forEach(wo => {
      if (wo.quote_id) {
        workOrderMap.set(wo.quote_id, { id: wo.id, work_order_number: wo.work_order_number });
      }
    });

    const { data: poLineItems, error: poError } = await supabase
      .from('purchase_order_line_items')
      .select(`
        item_number:style_number, product_name, color, size,
        quantity_ordered, quantity_received, po_id,
        purchase_orders!inner (
          id, po_number, status, company_id,
          vendors!purchase_orders_vendor_id_fkey (vendor_name)
        )
      `)
      .eq('purchase_orders.company_id', cid)
      .in('purchase_orders.status', ['draft', 'sent', 'partially_received', 'received']);

    if (poError) throw poError;

    const { data: stagingData, error: stagingError } = await supabase
      .from('garment_requirements_staging')
      .select(`
        style_number, color, supplier_name, requires_review, change_reason, original_data, is_po_created,
        is_ordered, ordered_at,
        po_id, work_order_id,
        work_orders!garment_requirements_staging_work_order_id_fkey (
          work_order_number
        )
      `)
      .eq('company_id', cid);

    if (stagingError) console.error('Error loading staging data:', stagingError);

    const stagingMap = new Map<string, { requires_review: boolean; change_reason: string; original_data: any; is_po_created: boolean; is_ordered: boolean; ordered_at: string | null }>();
    stagingData?.forEach((item: any) => {
      const key = `${item.style_number || 'N/A'}||${item.color || 'N/A'}||${item.supplier_name || 'Unknown'}`;
      const existing = stagingMap.get(key);
      stagingMap.set(key, {
        requires_review: item.requires_review || existing?.requires_review || false,
        change_reason: item.change_reason || existing?.change_reason,
        original_data: item.original_data || existing?.original_data,
        is_po_created: item.is_po_created || existing?.is_po_created || false,
        // is_ordered = true if ANY staging row for this style is marked ordered
        is_ordered: item.is_ordered || existing?.is_ordered || false,
        ordered_at: item.ordered_at || existing?.ordered_at || null,
      });
    });

    // Create a map of PO ID to work order info
    const poToWorkOrderMap = new Map<string, { work_order_id: string; work_order_number: string }>();
    stagingData?.forEach((item: any) => {
      if (item.po_id && item.work_order_id && item.work_orders) {
        poToWorkOrderMap.set(item.po_id, {
          work_order_id: item.work_order_id,
          work_order_number: item.work_orders.work_order_number,
        });
      }
    });

    const garmentMap = new Map<string, GarmentRow>();

    const sizeFieldMap: Record<string, string> = {
      XS: 'qty_xs', S: 'qty_s', M: 'qty_m', L: 'qty_l', XL: 'qty_xl',
      '2XL': 'qty_2xl', '3XL': 'qty_3xl', '4XL': 'qty_4xl', '5XL': 'qty_5xl',
      YXS: 'qty_yxs', YS: 'qty_ys', YM: 'qty_ym', YL: 'qty_yl', YXL: 'qty_yxl',
    };

    const sizeUpperMap = new Map(ALL_SIZES.map((s) => [s.toUpperCase(), s]));

    quoteLineItems?.forEach((item: any) => {
      const styleNum = item.item_number || 'N/A';
      const colorVal = item.color || 'N/A';
      const supplierVal = item.supplier_name || 'Unknown';
      const key = `${styleNum}||${colorVal}||${supplierVal}`;

      if (!garmentMap.has(key)) {
        const stagingInfo = stagingMap.get(key);
        garmentMap.set(key, {
          style_number: styleNum,
          product_name: item.description || 'Unknown Product',
          color: colorVal,
          supplier: supplierVal,
          sizes: {},
          total_needed: 0,
          total_on_po: 0,
          total_received: 0,
          total_remaining: 0,
          requires_review: stagingInfo?.requires_review || false,
          change_reason: stagingInfo?.change_reason,
          original_data: stagingInfo?.original_data,
          is_po_created: stagingInfo?.is_po_created || false,
          is_ordered: stagingInfo?.is_ordered || false,
          ordered_at: stagingInfo?.ordered_at || null,
          jobs: [],
          pos: [],
        });
      }

      const row = garmentMap.get(key)!;
      let rowJobQty = 0;

      ALL_SIZES.forEach((size) => {
        const qty = item[sizeFieldMap[size]] || 0;
        if (qty > 0) {
          if (!row.sizes[size]) {
            row.sizes[size] = { needed: 0, on_po: 0, received: 0, remaining: 0 };
          }
          row.sizes[size].needed += qty;
          row.total_needed += qty;
          rowJobQty += qty;
        }
      });

      if (rowJobQty > 0) {
        const workOrder = workOrderMap.get(item.quotes.id);
        row.jobs.push({
          quote_id: item.quotes.id,
          quote_number: item.quotes.quote_number,
          customer_name: item.quotes.customer_name,
          quantity: rowJobQty,
          work_order_id: workOrder?.id,
          work_order_number: workOrder?.work_order_number,
        });
      }
    });

    poLineItems?.forEach((item: any) => {
      const styleNum = (item.item_number || 'N/A').trim();
      const colorVal = (item.color || 'N/A').trim();
      const rawSize = (item.size || '').trim();
      const normalizedSize = sizeUpperMap.get(rawSize.toUpperCase()) || rawSize;

      for (const [, row] of garmentMap) {
        if (
          row.style_number.toLowerCase() === styleNum.toLowerCase() &&
          row.color.toLowerCase() === colorVal.toLowerCase()
        ) {
          if (row.sizes[normalizedSize]) {
            row.sizes[normalizedSize].on_po += item.quantity_ordered;
            row.sizes[normalizedSize].received += item.quantity_received;
          }
          row.total_on_po += item.quantity_ordered;
          row.total_received += item.quantity_received;

          const workOrderInfo = poToWorkOrderMap.get(item.purchase_orders.id);
          row.pos.push({
            po_id: item.purchase_orders.id,
            po_number: item.purchase_orders.po_number,
            vendor_name: item.purchase_orders.vendors?.vendor_name || 'Unknown',
            size: normalizedSize || rawSize || 'N/A',
            quantity_ordered: item.quantity_ordered,
            quantity_received: item.quantity_received,
            work_order_id: workOrderInfo?.work_order_id,
            work_order_number: workOrderInfo?.work_order_number,
          });
          break;
        }
      }
    });

    const garmentList = Array.from(garmentMap.values()).map((row) => {
      let totalRemaining = 0;
      Object.values(row.sizes).forEach((sd) => {
        sd.remaining = Math.max(0, sd.needed - sd.received);
        totalRemaining += sd.remaining;
      });
      return { ...row, total_remaining: totalRemaining };
    });

    setGarments(garmentList);
  };

  const loadVendors = async (cid: string) => {
    const { data, error } = await supabase
      .from('vendors')
      .select('id, vendor_name, vendor_type')
      .eq('company_id', cid)
      .eq('is_active', true)
      .order('vendor_name');
    if (error) throw error;
    setVendors(data || []);
  };

  const loadCustomers = async (cid: string) => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, company_name')
      .eq('company_id', cid)
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

    // Filter out items that have been added to POs (unless user wants to see them)
    if (!showItemsOnPO) {
      filtered = filtered.filter((g) => !g.is_po_created);
    }

    if (selectedVendor !== 'all') {
      filtered = filtered.filter((g) => g.supplier === selectedVendor);
    }

    if (selectedCustomer !== 'all') {
      filtered = filtered.filter((g) =>
        g.jobs.some((job) => job.customer_name === selectedCustomer)
      );
    }

    if (hideFullyOnPO) {
      filtered = filtered.filter((g) => g.total_on_po < g.total_needed);
    }

    if (showMissingOnly) {
      filtered = filtered.filter((g) => g.total_remaining > 0);
    }

    if (showReviewOnly) {
      filtered = filtered.filter((g) => g.requires_review === true);
    }

    setFilteredGarments(filtered);
  };

  const activeSizes = ALL_SIZES.filter((size) =>
    filteredGarments.some((g) => g.sizes[size] && g.sizes[size].needed > 0)
  );

  const handleAddToPO = (garment: GarmentRow) => {
    const itemsForPO = ALL_SIZES
      .filter((size) => garment.sizes[size]?.remaining > 0)
      .map((size) => ({
        style_number: garment.style_number,
        product_name: garment.product_name,
        color: garment.color,
        size,
        quantity: garment.sizes[size].remaining,
      }));

    if (itemsForPO.length === 0) return;

    const matchedVendor = vendors.find(
      (v) => v.vendor_name.toLowerCase() === garment.supplier.toLowerCase()
    );

    setPOModal({
      isOpen: true,
      vendorName: garment.supplier,
      vendorId: matchedVendor?.id || null,
      items: itemsForPO,
    });
  };

  const handlePOSuccess = async (poNumber: string) => {
    showToast(`Added to ${poNumber}`);
    if (companyId) {
      await loadGarmentNeeds(companyId);
    }
  };

  const handleMarkOrdered = async (garment: GarmentRow) => {
    if (!companyId) return;
    try {
      const now = new Date().toISOString();
      // 2026-05-14 — also flow the report's total_needed onto the staging
      // row so the Receiving Dashboard (Quick Receive) knows how many units
      // to expect. Previously the qty wasn't carrying over and Receiving
      // showed "Needed: 0", per client feedback.
      const qtyNeeded = garment.total_needed || 0;

      // Update any existing staging rows for this style+color. We bring
      // total_quantity along too — there are legacy rows where the cascade
      // inserted with 0, and there's no harm in normalising on Mark Ordered.
      const { data: updated, error: updateError } = await supabase
        .from('garment_requirements_staging')
        .update({
          is_ordered: true,
          ordered_at: now,
          total_quantity: qtyNeeded,
        })
        .eq('company_id', companyId)
        .eq('style_number', garment.style_number)
        .eq('color', garment.color)
        .select('id');

      if (updateError) throw updateError;

      // If no staging row exists yet (quote was approved without auto-PO
      // creation, or the cascade skipped items without item_number), insert
      // one so the flag persists across refreshes AND total_quantity is set.
      if (!updated || updated.length === 0) {
        const firstJob = garment.jobs[0];
        if (!firstJob?.quote_id) {
          showToast('Cannot mark ordered: no linked quote found for this garment.');
          return;
        }
        const { error: insertError } = await supabase
          .from('garment_requirements_staging')
          .insert([{
            company_id: companyId,
            quote_id: firstJob.quote_id,
            work_order_id: firstJob.work_order_id || null,
            supplier_name: garment.supplier === 'Unknown' ? null : garment.supplier,
            style_number: garment.style_number,
            style_name: garment.product_name || null,
            color: garment.color,
            total_quantity: qtyNeeded,
            is_ordered: true,
            ordered_at: now,
          }]);
        if (insertError) throw insertError;
      }

      setGarments(prev =>
        prev.map(g =>
          g.style_number === garment.style_number && g.color === garment.color
            ? { ...g, is_ordered: true, ordered_at: now }
            : g
        )
      );
      showToast(`✓ ${garment.style_number} ${garment.color} marked as ordered`);
    } catch (err) {
      console.error('Error marking as ordered:', err);
      showToast('Failed to update — please try again.');
    }
  };

  // MF-8: Undo mark as ordered
  const handleUnmarkOrdered = async (garment: GarmentRow) => {
    if (!companyId) return;
    try {
      const { error } = await supabase
        .from('garment_requirements_staging')
        .update({ is_ordered: false, ordered_at: null })
        .eq('company_id', companyId)
        .eq('style_number', garment.style_number)
        .eq('color', garment.color);

      if (error) throw error;

      setGarments(prev =>
        prev.map(g =>
          g.style_number === garment.style_number && g.color === garment.color
            ? { ...g, is_ordered: false, ordered_at: undefined }
            : g
        )
      );
      showToast(`↩ ${garment.style_number} ${garment.color} unmarked`);
    } catch (err) {
      console.error('Error unmarking as ordered:', err);
      showToast('Failed to update — please try again.');
    }
  };

  const groupGarments = () => {
    const grouped = new Map<string, GarmentRow[]>();

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
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(garment);
    });

    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const exportToCSV = () => {
    const headers = [
      'Style Number', 'Description', 'Color', 'Supplier',
      ...activeSizes, 'Total Needed', 'On PO', 'Received', 'Remaining',
    ];
    const rows = filteredGarments.map((g) => [
      g.style_number, g.product_name, g.color, g.supplier,
      ...activeSizes.map((s) => (g.sizes[s]?.needed || 0).toString()),
      g.total_needed.toString(), g.total_on_po.toString(),
      g.total_received.toString(), g.total_remaining.toString(),
    ]);

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garment-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 14;

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 18, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Garment Order Report', margin, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(format(new Date(), 'MMM dd, yyyy h:mm a'), pageWidth - margin - 50, 12);
    y = 24;

    const summaryItems = [
      { label: 'Total Needed', value: stats.totalNeeded.toLocaleString() },
      { label: 'On PO', value: stats.onPO.toLocaleString() },
      { label: 'Received', value: stats.received.toLocaleString() },
      { label: 'Remaining', value: stats.remaining.toLocaleString() },
    ];
    const boxW = (pageWidth - margin * 2 - 12) / 4;
    summaryItems.forEach((item, i) => {
      const x = margin + i * (boxW + 4);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, boxW, 14, 1.5, 1.5, 'F');
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text(item.label, x + 3, y + 5);
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value, x + 3, y + 11);
      doc.setFont('helvetica', 'normal');
    });
    y += 20;

    const headers = [
      'Style', 'Description', 'Color', 'Vendor',
      ...activeSizes.map((s) => s),
      'Total', 'On PO', 'Remain',
    ];

    const body = filteredGarments.map((g) => {
      const remaining = g.total_needed - g.total_on_po;
      return [
        g.style_number,
        g.product_name.length > 25 ? g.product_name.substring(0, 25) + '...' : g.product_name,
        g.color,
        g.supplier,
        ...activeSizes.map((s) => {
          const qty = g.sizes[s]?.needed || 0;
          return qty > 0 ? qty.toString() : '-';
        }),
        g.total_needed.toString(),
        g.total_on_po.toString(),
        (remaining > 0 ? remaining : 0).toString(),
      ];
    });

    const sizeColWidth = Math.min(12, (pageWidth - margin * 2 - 110) / Math.max(activeSizes.length, 1));

    (doc as any).autoTable({
      startY: y,
      head: [headers],
      body,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [237, 237, 237],
        fontSize: 6.5,
        fontStyle: 'bold',
        cellPadding: 2,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 6.5,
        textColor: [30, 41, 59],
        cellPadding: 1.8,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 22 },
        ...Object.fromEntries(
          activeSizes.map((_, i) => [i + 4, { cellWidth: sizeColWidth, halign: 'center' as const }])
        ),
        [activeSizes.length + 4]: { cellWidth: 14, halign: 'right' as const, fontStyle: 'bold' },
        [activeSizes.length + 5]: { cellWidth: 14, halign: 'right' as const, textColor: [37, 99, 235] },
        [activeSizes.length + 6]: { cellWidth: 14, halign: 'right' as const },
      },
      didParseCell: (data: any) => {
        const colIdx = data.column.index;
        const remainIdx = activeSizes.length + 6;
        if (data.section === 'body' && colIdx === remainIdx) {
          const val = parseInt(data.cell.raw, 10);
          if (val > 0) {
            data.cell.styles.textColor = [234, 88, 12];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [156, 163, 175];
          }
        }
      },
      margin: { left: margin, right: margin },
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      const footerY = doc.internal.pageSize.getHeight() - 6;
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175);
      doc.text(`Page ${p} of ${totalPages}`, margin, footerY);
      doc.text(
        `${filteredGarments.length} line items`,
        pageWidth - margin - 25,
        footerY
      );
    }

    doc.save(`garment-order-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedVendor('all');
    setSelectedCustomer('all');
    setShowMissingOnly(false);
    setShowReviewOnly(false);
    setShowItemsOnPO(false);
    setHideFullyOnPO(true);
  };

  const stats = filteredGarments.reduce(
    (acc, g) => ({
      totalNeeded: acc.totalNeeded + g.total_needed,
      onPO: acc.onPO + g.total_on_po,
      received: acc.received + g.total_received,
      remaining: acc.remaining + g.total_remaining,
    }),
    { totalNeeded: 0, onPO: 0, received: 0, remaining: 0 }
  );

  const groupedData = groupGarments();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast.visible && (
        <div className="fixed top-6 right-6 z-[100] animate-in slide-in-from-right">
          <div className="flex items-center gap-3 px-5 py-3 bg-green-600 text-white rounded-lg shadow-xl">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Garment Order Report
          </h2>
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
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Needed', value: stats.totalNeeded, color: 'text-gray-900 dark:text-white', icon: <Package className="w-8 h-8 text-blue-500 dark:text-blue-400" /> },
          { label: 'On PO', value: stats.onPO, color: 'text-blue-600 dark:text-blue-400', icon: <FileText className="w-8 h-8 text-blue-500 dark:text-blue-400" /> },
          { label: 'Received', value: stats.received, color: 'text-green-600 dark:text-green-400', icon: <Package className="w-8 h-8 text-green-500 dark:text-green-400" /> },
          { label: 'Remaining to Order', value: stats.remaining, color: 'text-orange-600 dark:text-orange-400', icon: <AlertCircle className="w-8 h-8 text-orange-500 dark:text-orange-400" /> },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color} mt-1`}>
                  {stat.value.toLocaleString()}
                </p>
              </div>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by style, product, or color..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-white transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Group By</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              >
                <option value="style">Style</option>
                <option value="vendor">Vendor</option>
                <option value="job">Job</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vendor</label>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              >
                <option value="all">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.vendor_name}>{v.vendor_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
              >
                <option value="all">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.company_name}>{c.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Options</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hideFullyOnPO}
                    onChange={(e) => setHideFullyOnPO(e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Hide items fully on PO</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showMissingOnly}
                    onChange={(e) => setShowMissingOnly(e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Show missing items only</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showReviewOnly}
                    onChange={(e) => setShowReviewOnly(e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-orange-600 dark:text-orange-300 font-medium">Show items requiring review</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showItemsOnPO}
                    onChange={(e) => setShowItemsOnPO(e.target.checked)}
                    className="rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Show items already on PO</span>
                </label>
              </div>
            </div>
            {(searchTerm || selectedVendor !== 'all' || selectedCustomer !== 'all' || showMissingOnly || showReviewOnly || showItemsOnPO) && (
              <div className="col-span-full">
                <button onClick={clearFilters} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                  <X className="w-4 h-4" />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Style
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Color
                </th>

                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Vendor
                </th>
                {activeSizes.map((size) => (
                  <th
                    key={size}
                    className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {size}
                  </th>
                ))}
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Total
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  On PO
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Remaining
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {filteredGarments.length === 0 ? (
                <tr>
                  <td colSpan={activeSizes.length + 8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Package className="w-16 h-16 text-gray-600 mb-4" />
                      <p className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                        No garments match your filters
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-500 mb-4">
                        {garments.length === 0
                          ? 'Approve quotes with garments to see them here.'
                          : 'Try adjusting your search criteria or filters.'}
                      </p>
                      {(searchTerm || selectedVendor !== 'all' || selectedCustomer !== 'all' || showMissingOnly || showReviewOnly || showItemsOnPO) && (
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
                    <tr className="bg-gray-100 dark:bg-slate-900">
                      <td colSpan={activeSizes.length + 7} className="px-4 py-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                          {groupBy === 'style' && <Layers className="w-4 h-4" />}
                          {groupBy === 'vendor' && <ShoppingCart className="w-4 h-4" />}
                          {groupBy === 'customer' && <Users className="w-4 h-4" />}
                          {groupBy === 'job' && <FileText className="w-4 h-4" />}
                          <span>{groupKey}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({items.length} {items.length === 1 ? 'line' : 'lines'})
                          </span>
                        </div>
                      </td>
                    </tr>
                    {items.map((garment, index) => {
                      const hasRemaining = garment.total_remaining > 0;
                      return (
                        <tr
                          key={`${groupKey}-${index}`}
                          className={`hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                            garment.requires_review
                              ? 'bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500'
                              : garment.is_ordered
                              ? 'bg-emerald-50 dark:bg-emerald-900/10 border-l-4 border-emerald-500'
                              : garment.is_po_created
                              ? 'bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500'
                              : hasRemaining
                              ? 'bg-yellow-50 dark:bg-yellow-900/10'
                              : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {garment.requires_review && (
                                <AlertCircle
                                  className="w-4 h-4 text-orange-400 flex-shrink-0"
                                  title={garment.change_reason || 'Changed After PO'}
                                />
                              )}
                              {garment.is_po_created && !garment.requires_review && (
                                <CheckCircle
                                  className="w-4 h-4 text-green-400 flex-shrink-0"
                                  title="Added to Purchase Order"
                                />
                              )}
                              <span>{garment.style_number}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{garment.color}</span>
                              {garment.requires_review && (
                                <span
                                  className="text-xs text-orange-600 dark:text-orange-400 font-medium"
                                  title={garment.change_reason}
                                >
                                  (Review Required)
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                            {garment.supplier}
                          </td>
                          {activeSizes.map((size) => {
                            const sd = garment.sizes[size];
                            const qty = sd?.needed || 0;
                            return (
                              <td
                                key={size}
                                className="px-2 py-3 text-center text-sm tabular-nums"
                              >
                                {qty > 0 ? (
                                  <span className="text-gray-900 dark:text-white font-medium">{qty}</span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-600">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white tabular-nums whitespace-nowrap">
                            {garment.total_needed}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-blue-600 dark:text-blue-400 tabular-nums whitespace-nowrap">
                            {garment.total_on_po}
                          </td>
                          <td className="px-3 py-3 text-sm text-right tabular-nums whitespace-nowrap">
                            <span
                              className={`font-semibold ${
                                garment.total_remaining === 0
                                  ? 'text-gray-400 dark:text-gray-500'
                                  : 'text-orange-600 dark:text-orange-400'
                              }`}
                            >
                              {garment.total_remaining}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1 flex-wrap">
                              {garment.is_ordered ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded font-semibold">
                                    <CheckCircle className="w-4 h-4" />
                                    Ordered
                                  </span>
                                  <button
                                    onClick={() => handleUnmarkOrdered(garment)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-300 dark:border-red-700 rounded transition-colors"
                                    title="Undo mark as ordered"
                                  >
                                    ↩ Undo
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleMarkOrdered(garment)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 rounded transition-colors font-medium"
                                  title="Mark this item as ordered from supplier"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  Mark Ordered
                                </button>
                              )}
                              {hasRemaining && !garment.is_ordered && (
                                <button
                                  onClick={() => handleAddToPO(garment)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors font-medium"
                                  title="Add remaining garments to a Purchase Order"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add to PO
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedGarment(garment);
                                  setShowDrillDown(true);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
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

      {filteredGarments.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredGarments.length} garment lines
        </div>
      )}

      <POSelectionModal
        isOpen={poModal.isOpen}
        onClose={() => setPOModal({ ...poModal, isOpen: false })}
        vendorName={poModal.vendorName}
        vendorId={poModal.vendorId}
        companyId={companyId || ''}
        items={poModal.items}
        vendors={vendors}
        onSuccess={handlePOSuccess}
      />

      {showDrillDown && selectedGarment && (
        <DrillDownModal
          garment={selectedGarment}
          activeSizes={activeSizes}
          onClose={() => setShowDrillDown(false)}
          onAddToPO={() => {
            setShowDrillDown(false);
            handleAddToPO(selectedGarment);
          }}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

function DrillDownModal({
  garment,
  activeSizes,
  onClose,
  onAddToPO,
  onNavigate,
}: {
  garment: GarmentRow;
  activeSizes: string[];
  onClose: () => void;
  onAddToPO: () => void;
  onNavigate?: (tab: string, view?: string, id?: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg max-w-5xl w-full max-h-[80vh] overflow-hidden border border-gray-200 dark:border-slate-700">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Garment Details</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {garment.style_number} - {garment.color} - {garment.supplier}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)] space-y-6">
          <div className="bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Size</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Needed</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">On PO</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Received</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {activeSizes
                  .filter((s) => garment.sizes[s])
                  .map((size) => {
                    const sd = garment.sizes[size];
                    return (
                      <tr key={size}>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{size}</td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-white">{sd.needed}</td>
                        <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">{sd.on_po}</td>
                        <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{sd.received}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${sd.remaining > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'}`}>
                          {sd.remaining}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Jobs Requiring This Garment
              </h4>
              <div className="space-y-3">
                {garment.jobs.map((job, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 bg-gray-50 dark:bg-slate-800"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{job.quote_number}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{job.customer_name}</p>
                        {job.work_order_number && (
                          <button
                            onClick={() => onNavigate?.('work-orders', 'detail', job.work_order_id)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline mt-1"
                          >
                            WO: {job.work_order_number}
                          </button>
                        )}
                      </div>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs font-medium rounded">
                        {job.quantity} units
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Purchase Orders
              </h4>
              {garment.pos.length === 0 ? (
                <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-6 text-center bg-gray-50 dark:bg-slate-800">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No purchase orders yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {garment.pos.map((po, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 bg-gray-50 dark:bg-slate-800"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{po.po_number}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {po.vendor_name} &middot; Size {po.size}
                          </p>
                          {po.work_order_number && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              WO: {po.work_order_number}
                            </p>
                          )}
                        </div>
                        {po.work_order_id && po.work_order_number && (
                          <button
                            onClick={() => onNavigate?.('work-orders', 'detail', po.work_order_id)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Ordered:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">{po.quantity_ordered}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Received:</span>
                          <span className="ml-2 font-medium text-green-600 dark:text-green-400">{po.quantity_received}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Needed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {garment.total_needed}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">On PO</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {garment.total_on_po}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Received</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {garment.total_received}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Remaining</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {garment.total_remaining}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex gap-3 justify-end">
          {garment.total_remaining > 0 && (
            <button
              onClick={onAddToPO}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add to PO
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
