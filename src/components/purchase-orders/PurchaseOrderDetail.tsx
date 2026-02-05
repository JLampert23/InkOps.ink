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
  Edit,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  User,
} from 'lucide-react';
import { format } from 'date-fns';

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
}

export function PurchaseOrderDetail({ poId, onBack, onEdit }: PurchaseOrderDetailProps) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingQuantities, setReceivingQuantities] = useState<{ [key: string]: number }>({});

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
          vendor:vendors!vendor_id (
            vendor_name,
            vendor_type,
            contact_name,
            contact_email,
            contact_phone
          ),
          created_by_user:user_profiles!created_by (
            full_name,
            email
          )
        `)
        .eq('id', poId)
        .single();

      if (poError) throw poError;
      setPo(poData);

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

      const { data: logs, error: logsError } = await supabase
        .from('purchase_order_activity_log')
        .select('*')
        .eq('po_id', poId)
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;
      setActivityLog(logs || []);
    } catch (error) {
      console.error('Error loading purchase order:', error);
      alert('Failed to load purchase order');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!po) return;

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
          company_id: po.vendor ? await getUserCompanyId() : null,
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

  const handleReceiveGoods = async () => {
    if (!po) return;

    const itemsToUpdate = Object.entries(receivingQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = lineItems.find((li) => li.id === itemId);
        return { id: itemId, newReceived: (item?.quantity_received || 0) + qty };
      });

    if (itemsToUpdate.length === 0) {
      alert('Please enter quantities to receive');
      return;
    }

    try {
      setUpdating(true);

      for (const { id, newReceived } of itemsToUpdate) {
        const { error } = await supabase
          .from('purchase_order_line_items')
          .update({ quantity_received: newReceived })
          .eq('id', id);

        if (error) throw error;
      }

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('purchase_order_activity_log').insert([
        {
          company_id: await getUserCompanyId(),
          po_id: poId,
          action: 'goods_received',
          performed_by: user?.id,
          performed_by_name: user?.email || 'Unknown',
          notes: `Received ${itemsToUpdate.length} item(s)`,
          meta: { items: itemsToUpdate },
        },
      ]);

      alert('Goods received successfully');
      setShowReceiveModal(false);
      loadPurchaseOrder();
    } catch (error) {
      console.error('Error receiving goods:', error);
      alert('Failed to receive goods');
    } finally {
      setUpdating(false);
    }
  };

  const exportPDF = () => {
    alert('PDF export will be implemented');
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
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles] || styles.draft}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  if (loading || !po) {
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
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{po.po_number}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {po.vendor.vendor_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(po.status)}
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
          >
            <Download className="w-4 h-4" />
            Print PO
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {po.status === 'draft' && (
          <button
            onClick={() => updateStatus('sent')}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send PO
          </button>
        )}
        {po.status === 'sent' && (
          <button
            onClick={() => updateStatus('confirmed')}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Mark as Confirmed
          </button>
        )}
        {(po.status === 'confirmed' || po.status === 'sent') && (
          <button
            onClick={() => updateStatus('in_transit')}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
            Mark as In Transit
          </button>
        )}
        {['sent', 'confirmed', 'in_transit', 'partially_received'].includes(po.status) && (
          <button
            onClick={() => setShowReceiveModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Package className="w-4 h-4" />
            Receive Goods
          </button>
        )}
        {po.status === 'fully_received' && (
          <button
            onClick={() => updateStatus('closed')}
            disabled={updating}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Close PO
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vendor Info */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Vendor Information
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Name:</span> {po.vendor.vendor_name}
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">Type:</span> {po.vendor.vendor_type}
              </p>
              {po.vendor.contact_name && (
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Contact:</span> {po.vendor.contact_name}
                </p>
              )}
              {po.vendor.contact_email && (
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Email:</span> {po.vendor.contact_email}
                </p>
              )}
              {po.vendor.contact_phone && (
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Phone:</span> {po.vendor.contact_phone}
                </p>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Line Items
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                      Color / Size
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                      Ordered
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                      Received
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                      Unit Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {item.line_number}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.product_name}
                          </p>
                          {item.style_number && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Style: {item.style_number}
                            </p>
                          )}
                          {item.sku && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              SKU: {item.sku}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {item.color && item.size ? `${item.color} / ${item.size}` : item.color || item.size || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                        {item.quantity_ordered}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={item.quantity_received >= item.quantity_ordered ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-900 dark:text-white'}>
                          {item.quantity_received}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                        ${item.unit_cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                        ${item.extended_cost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {(po.notes_to_vendor || po.internal_notes) && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notes</h3>
              {po.notes_to_vendor && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes to Vendor:
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {po.notes_to_vendor}
                  </p>
                </div>
              )}
              {po.internal_notes && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Internal Notes:
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {po.internal_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Activity Log */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Activity Log
            </h3>
            <div className="space-y-4">
              {activityLog.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No activity recorded yet
                </p>
              ) : (
                activityLog.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 dark:text-white">
                        <span className="font-medium">{log.performed_by_name}</span>{' '}
                        {log.action.replace(/_/g, ' ')}
                      </p>
                      {log.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{log.notes}</p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {format(new Date(log.created_at), 'MMM dd, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Status Timeline
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Created</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(po.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
              {po.sent_at && (
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Sent</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(po.sent_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              )}
              {po.confirmed_at && (
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Confirmed</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(po.confirmed_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              )}
              {po.received_at && (
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Received</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(po.received_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Date */}
          {po.expected_delivery_date && (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Expected Delivery
              </h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {format(new Date(po.expected_delivery_date), 'MMM dd, yyyy')}
              </p>
            </div>
          )}

          {/* Cost Summary */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Cost Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${po.subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Tax</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${po.tax_amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Shipping</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${po.shipping_cost.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900 dark:text-white">Total</span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    ${po.total_cost.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receive Goods Modal */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Receive Goods
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Enter the quantities received for each item
              </p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
              <div className="space-y-4">
                {lineItems.map((item) => {
                  const remaining = item.quantity_ordered - item.quantity_received;
                  if (remaining <= 0) return null;

                  return (
                    <div
                      key={item.id}
                      className="border border-gray-200 dark:border-slate-700 rounded-lg p-4"
                    >
                      <div className="flex justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.product_name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {item.color && item.size ? `${item.color} / ${item.size}` : item.color || item.size || ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Remaining: <span className="font-medium">{remaining}</span>
                          </p>
                        </div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        value={receivingQuantities[item.id] || 0}
                        onChange={(e) =>
                          setReceivingQuantities({
                            ...receivingQuantities,
                            [item.id]: Math.min(parseInt(e.target.value) || 0, remaining),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                        placeholder="Quantity received"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex gap-2">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleReceiveGoods}
                disabled={updating}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
