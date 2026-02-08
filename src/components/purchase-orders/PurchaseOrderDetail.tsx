import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Truck,
  Package,
  XCircle,
  Download,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  User,
  Upload,
  File,
  X,
  Printer,
  Edit,
} from 'lucide-react';
import { format } from 'date-fns';
import { POSettingsService } from '../../services/po-settings-service';
import { POValidationModal } from './POValidationModal';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  total_cost: number;
  notes_to_vendor: string | null;
  internal_notes: string | null;
  expected_delivery_date: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  received_at: string | null;
  closed_at: string | null;
  created_at: string;
  vendor: {
    vendor_name: string;
    vendor_type: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
  };
  created_by_user?: {
    full_name?: string;
    email: string;
  };
}

interface LineItem {
  id: string;
  line_number: number;
  sku: string;
  style_number: string;
  product_name: string;
  color: string;
  size: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  extended_cost: number;
  notes: string | null;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
  uploaded_by_user?: {
    email: string;
  };
}

interface ActivityLog {
  id: string;
  action: string;
  performed_by_name: string;
  notes: string | null;
  created_at: string;
}

interface PurchaseOrderDetailProps {
  poId: string;
  onBack: () => void;
  onEdit?: () => void;
  onReceiveGoods?: (poId: string) => void;
}

export function PurchaseOrderDetail({ poId, onBack, onReceiveGoods }: PurchaseOrderDetailProps) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [validationModal, setValidationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    requiresJustification?: boolean;
    onConfirm?: (justification?: string) => void;
  }>({ isOpen: false, title: '', message: '' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadPurchaseOrder();
  }, [poId]);

  const loadPurchaseOrder = async () => {
    try {
      setLoading(true);

      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (
            vendor_name,
            vendor_type,
            contact_name,
            contact_email,
            contact_phone
          ),
          user_profiles!purchase_orders_created_by_fkey (
            full_name,
            email
          )
        `)
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      const formattedPo = {
        ...poData,
        vendor: poData.vendors,
        created_by_user: poData.user_profiles
      };
      setPo(formattedPo);

      const { data: items, error: itemsError } = await supabase
        .from('purchase_order_line_items')
        .select('*')
        .eq('po_id', poId)
        .order('line_number');

      if (itemsError) throw itemsError;
      setLineItems(items || []);

      const initialQuantities: { [key: string]: number } = {};
      items?.forEach((item) => {
        initialQuantities[item.id] = 0;
      });
      setReceivingQuantities(initialQuantities);

      const { data: attachmentData, error: attachmentError } = await supabase
        .from('purchase_order_attachments')
        .select(`
          *,
          uploaded_by_user:user_profiles!uploaded_by (
            email
          )
        `)
        .eq('po_id', poId)
        .order('created_at', { ascending: false });

      if (attachmentError) throw attachmentError;
      setAttachments(attachmentData || []);

      const { data: logs, error: logsError } = await supabase
        .from('purchase_order_activity_log')
        .select('*')
        .eq('po_id', poId)
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;
      setActivityLog(logs || []);
    } catch (error: any) {
      console.error('Error loading purchase order:', error);
      console.error('Error message:', error?.message);
      console.error('Error details:', JSON.stringify(error, null, 2));
      alert(`Failed to load purchase order: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!po) return;

    if (newStatus === 'sent') {
      const hasPdf = attachments.some((a) => a.file_type === 'application/pdf');
      const validation = await POSettingsService.canSendPO({
        status: po.status,
        approved_by: null,
        has_pdf: hasPdf,
      });

      if (!validation.allowed) {
        setValidationModal({
          isOpen: true,
          title: 'Cannot Send PO',
          message: validation.reason || 'This PO cannot be sent at this time.',
        });
        return;
      }
    }

    try {
      setUpdating(true);

      const updateData: any = { status: newStatus };

      if (newStatus === 'sent') {
        updateData.sent_at = new Date().toISOString();
      } else if (newStatus === 'confirmed') {
        updateData.confirmed_at = new Date().toISOString();
      } else if (newStatus === 'in_transit') {
        if (!po.confirmed_at) {
          updateData.confirmed_at = new Date().toISOString();
        }
      } else if (newStatus === 'closed') {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('purchase_orders')
        .update(updateData)
        .eq('id', poId);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('purchase_order_activity_log').insert([
        {
          company_id: await getUserCompanyId(),
          po_id: poId,
          action: `status_changed_to_${newStatus}`,
          performed_by: user?.id,
          performed_by_name: user?.email || 'Unknown',
          notes: `Status changed to ${newStatus}`,
        },
      ]);

      alert(`Purchase order marked as ${newStatus}`);
      loadPurchaseOrder();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const getUserCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    return profile?.company_id || null;
  };

  const handleEditClick = async () => {
    if (!po) return;

    const validation = await POSettingsService.canEditPO({
      status: po.status,
      sent_at: po.sent_at,
    });

    if (!validation.allowed) {
      setValidationModal({
        isOpen: true,
        title: 'Cannot Edit PO',
        message: validation.reason || 'This PO cannot be edited.',
      });
      return;
    }

    if (validation.requiresJustification) {
      setValidationModal({
        isOpen: true,
        title: 'Edit Justification Required',
        message: 'This PO has already been sent. Please provide a justification for editing it.',
        requiresJustification: true,
        onConfirm: async (justification) => {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('purchase_order_activity_log').insert([
            {
              company_id: await getUserCompanyId(),
              po_id: poId,
              action: 'po_edited_after_sending',
              performed_by: user?.id,
              performed_by_name: user?.email || 'Unknown',
              notes: justification || 'No justification provided',
            },
          ]);
          setIsEditing(true);
        },
      });
    } else {
      setIsEditing(true);
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !po) return;

    try {
      setUploading(true);
      const file = e.target.files[0];
      const companyId = await getUserCompanyId();

      const fileName = `${companyId}/${po.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('po-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('po-attachments')
        .getPublicUrl(fileName);

      const { data: { user } } = await supabase.auth.getUser();
      const { error: dbError } = await supabase
        .from('purchase_order_attachments')
        .insert([
          {
            company_id: companyId,
            po_id: po.id,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user?.id,
          },
        ]);

      if (dbError) throw dbError;

      await supabase.from('purchase_order_activity_log').insert([
        {
          company_id: companyId,
          po_id: po.id,
          action: 'attachment_uploaded',
          performed_by: user?.id,
          performed_by_name: user?.email || 'Unknown',
          notes: `Uploaded file: ${file.name}`,
        },
      ]);

      alert('File uploaded successfully');
      loadPurchaseOrder();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachment: Attachment) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;

    try {
      const { error: dbError } = await supabase
        .from('purchase_order_attachments')
        .delete()
        .eq('id', attachment.id);

      if (dbError) throw dbError;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('purchase_order_activity_log').insert([
        {
          company_id: await getUserCompanyId(),
          po_id: po?.id,
          action: 'attachment_deleted',
          performed_by: user?.id,
          performed_by_name: user?.email || 'Unknown',
          notes: `Deleted file: ${attachment.file_name}`,
        },
      ]);

      alert('Attachment deleted successfully');
      loadPurchaseOrder();
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert('Failed to delete attachment');
    }
  };

  const exportPDF = () => {
    alert('PDF export will be implemented');
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-400',
      confirmed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-2 border-purple-600 dark:border-purple-400',
      in_transit: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-2 border-yellow-600 dark:border-yellow-400',
      partially_received: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-2 border-orange-600 dark:border-orange-400',
      fully_received: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-2 border-green-600 dark:border-green-400',
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
      <span className={`px-4 py-2 rounded-lg text-sm font-bold ${styles[status as keyof typeof styles] || styles.draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading || !po) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  const statusTimeline = [
    { key: 'draft', label: 'Draft', date: po.created_at, active: true },
    { key: 'sent', label: 'Sent', date: po.sent_at, active: !!po.sent_at },
    { key: 'confirmed', label: 'Confirmed', date: po.confirmed_at, active: !!po.confirmed_at },
    { key: 'in_transit', label: 'In Transit', date: null, active: po.status === 'in_transit' },
    { key: 'partially_received', label: 'Receiving', date: po.received_at, active: ['partially_received', 'fully_received'].includes(po.status) },
    { key: 'fully_received', label: 'Received', date: po.received_at, active: po.status === 'fully_received' },
    { key: 'closed', label: 'Closed', date: po.closed_at, active: !!po.closed_at },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{po.po_number}</h2>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {po.vendor.vendor_name}
                </p>
                <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(po.created_at), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(po.status)}
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                ${po.total_cost.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Status Timeline - Horizontal */}
        <div className="relative">
          <div className="flex items-center justify-between">
            {statusTimeline.map((step, index) => (
              <React.Fragment key={step.key}>
                <div className="flex flex-col items-center flex-1 relative z-10">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all ${
                      step.active
                        ? 'bg-green-500 text-white shadow-lg ring-4 ring-green-500/20'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {step.active ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-current" />
                    )}
                  </div>
                  <span
                    className={`text-xs font-medium text-center ${
                      step.active
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.date && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {format(new Date(step.date), 'MMM dd')}
                    </span>
                  )}
                </div>
                {index < statusTimeline.length - 1 && (
                  <div
                    className={`h-1 flex-1 -mx-2 mb-8 transition-all ${
                      statusTimeline[index + 1].active
                        ? 'bg-green-500'
                        : 'bg-gray-200 dark:bg-slate-700'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {po.status === 'draft' && (
          <button
            onClick={() => updateStatus('sent')}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send PO
          </button>
        )}
        {po.status === 'sent' && (
          <button
            onClick={() => updateStatus('confirmed')}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Mark as Confirmed
          </button>
        )}
        {(po.status === 'confirmed' || po.status === 'sent') && (
          <button
            onClick={() => updateStatus('in_transit')}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-all"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            Mark as In Transit
          </button>
        )}
        {['sent', 'confirmed', 'in_transit', 'partially_received'].includes(po.status) && onReceiveGoods && (
          <button
            onClick={() => onReceiveGoods(po.id)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
          >
            <Package className="w-4 h-4" />
            Receive Goods
          </button>
        )}
        {po.status === 'fully_received' && (
          <button
            onClick={() => updateStatus('closed')}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-all"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Close PO
          </button>
        )}
        <button
          onClick={exportPDF}
          className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-all ml-auto"
        >
          <Printer className="w-4 h-4" />
          Print PO PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line Items */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Line Items ({(() => {
                  const grouped = lineItems.reduce((acc, item) => {
                    const key = `${item.style_number || item.product_name}|||${item.color}`;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {} as Record<string, typeof lineItems>);
                  return Object.keys(grouped).length;
                })()})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#1A1A1A] dark:bg-[#0A0A0A]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[#EDEDED] uppercase tracking-wider">
                      Style
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[#EDEDED] uppercase tracking-wider">
                      Color
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-[#EDEDED] uppercase tracking-wider">
                      Size Breakdown
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#EDEDED] uppercase tracking-wider">
                      Total Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#EDEDED] uppercase tracking-wider">
                      Received
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#EDEDED] uppercase tracking-wider">
                      Remaining
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#EDEDED] uppercase tracking-wider">
                      Unit Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-[#EDEDED] uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-[#1A1A1A] divide-y divide-[#2A2A2A]">
                  {(() => {
                    const SIZE_ORDER = ['XS', '2XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', '6XL', 'YXS', 'YS', 'YM', 'YL', 'YXL'];

                    const grouped = lineItems.reduce((acc, item) => {
                      const key = `${item.style_number || item.product_name}|||${item.color}`;
                      if (!acc[key]) {
                        acc[key] = {
                          style_number: item.style_number,
                          product_name: item.product_name,
                          color: item.color,
                          unit_cost: item.unit_cost,
                          sizes: []
                        };
                      }
                      acc[key].sizes.push({
                        size: item.size || 'N/A',
                        quantity_ordered: item.quantity_ordered,
                        quantity_received: item.quantity_received,
                        extended_cost: item.extended_cost
                      });
                      return acc;
                    }, {} as Record<string, {
                      style_number: string | null;
                      product_name: string;
                      color: string | null;
                      unit_cost: number;
                      sizes: Array<{ size: string; quantity_ordered: number; quantity_received: number; extended_cost: number }>;
                    }>);

                    return Object.values(grouped).map((group, idx) => {
                      const sortedSizes = [...group.sizes].sort((a, b) => {
                        const aIdx = SIZE_ORDER.indexOf(a.size);
                        const bIdx = SIZE_ORDER.indexOf(b.size);
                        if (aIdx === -1 && bIdx === -1) return a.size.localeCompare(b.size);
                        if (aIdx === -1) return 1;
                        if (bIdx === -1) return -1;
                        return aIdx - bIdx;
                      });

                      const totalOrdered = sortedSizes.reduce((sum, s) => sum + s.quantity_ordered, 0);
                      const totalReceived = sortedSizes.reduce((sum, s) => sum + s.quantity_received, 0);
                      const remaining = totalOrdered - totalReceived;
                      const totalCost = sortedSizes.reduce((sum, s) => sum + s.extended_cost, 0);

                      return (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="px-4 py-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-[#EDEDED]">
                                {group.style_number || '—'}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {group.product_name}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 dark:text-[#EDEDED]">
                            {group.color || '—'}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              {sortedSizes.map((sizeInfo, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded text-xs"
                                  title={`Received: ${sizeInfo.quantity_received}`}
                                >
                                  <span className="font-semibold text-gray-900 dark:text-[#EDEDED]">
                                    {sizeInfo.size}
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400">
                                    ×{sizeInfo.quantity_ordered}
                                  </span>
                                  {sizeInfo.quantity_received > 0 && (
                                    <span className="text-green-600 dark:text-green-400 font-medium">
                                      ({sizeInfo.quantity_received})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-right font-medium text-gray-900 dark:text-[#EDEDED]">
                            {totalOrdered}
                          </td>
                          <td className="px-4 py-4 text-sm text-right">
                            <span
                              className={
                                totalReceived >= totalOrdered
                                  ? 'text-green-600 dark:text-green-400 font-bold'
                                  : 'text-gray-900 dark:text-[#EDEDED] font-medium'
                              }
                            >
                              {totalReceived}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-right">
                            <span
                              className={
                                remaining === 0
                                  ? 'text-green-600 dark:text-green-400 font-bold'
                                  : remaining < totalOrdered * 0.5
                                  ? 'text-yellow-600 dark:text-yellow-400 font-medium'
                                  : 'text-gray-900 dark:text-[#EDEDED] font-medium'
                              }
                            >
                              {remaining}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-right text-gray-900 dark:text-[#EDEDED]">
                            ${group.unit_cost.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-sm text-right font-bold text-gray-900 dark:text-[#EDEDED]">
                            ${totalCost.toFixed(2)}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Attachments ({attachments.length})
              </h3>
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-all">
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Upload File
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>

            {attachments.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg">
                <File className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">No attachments uploaded</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                        <File className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {attachment.file_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>{formatFileSize(attachment.file_size)}</span>
                          <span>·</span>
                          <span>{format(new Date(attachment.created_at), 'MMM dd, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={attachment.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </a>
                      <button
                        onClick={() => handleDeleteAttachment(attachment)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Activity Log
            </h3>
            <div className="space-y-4">
              {activityLog.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center py-8">
                  No activity recorded yet
                </p>
              ) : (
                activityLog.map((log) => (
                  <div key={log.id} className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">
                        <span className="font-semibold">{log.performed_by_name}</span>{' '}
                        <span className="text-gray-600 dark:text-gray-400">
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </p>
                      {log.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{log.notes}</p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(log.created_at), 'MMM dd, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Notes */}
          {(po.notes_to_vendor || po.internal_notes) && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notes</h3>
              {po.notes_to_vendor && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    Notes to Vendor:
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {po.notes_to_vendor}
                  </p>
                </div>
              )}
              {po.internal_notes && (
                <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Internal Notes:
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {po.internal_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Vendor Info */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Vendor
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Name</p>
                <p className="font-semibold text-gray-900 dark:text-white">{po.vendor.vendor_name}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Type</p>
                <p className="text-gray-700 dark:text-gray-300 capitalize">{po.vendor.vendor_type}</p>
              </div>
              {po.vendor.contact_name && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Contact</p>
                  <p className="text-gray-700 dark:text-gray-300">{po.vendor.contact_name}</p>
                </div>
              )}
              {po.vendor.contact_email && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Email</p>
                  <p className="text-gray-700 dark:text-gray-300">{po.vendor.contact_email}</p>
                </div>
              )}
              {po.vendor.contact_phone && (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Phone</p>
                  <p className="text-gray-700 dark:text-gray-300">{po.vendor.contact_phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Date */}
          {po.expected_delivery_date && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border-2 border-blue-200 dark:border-blue-800 p-6">
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Expected Delivery
              </h3>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-200">
                {format(new Date(po.expected_delivery_date), 'MMM dd')}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {format(new Date(po.expected_delivery_date), 'yyyy')}
              </p>
            </div>
          )}

          {/* Cost Summary */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Cost Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ${po.subtotal.toFixed(2)}
                </span>
              </div>
              {po.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Tax</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ${po.tax_amount.toFixed(2)}
                  </span>
                </div>
              )}
              {po.shipping_cost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Shipping</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ${po.shipping_cost.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="pt-3 border-t-2 border-gray-200 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="font-bold text-gray-900 dark:text-white">Total</span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${po.total_cost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Modal */}
      <POValidationModal
        isOpen={validationModal.isOpen}
        onClose={() => setValidationModal({ ...validationModal, isOpen: false })}
        title={validationModal.title}
        message={validationModal.message}
        requiresJustification={validationModal.requiresJustification}
        onConfirm={validationModal.onConfirm}
      />
    </div>
  );
}
