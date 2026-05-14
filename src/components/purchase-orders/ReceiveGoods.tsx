import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import { ReceivingService } from '../../services/receiving-service';
import {
  X,
  Package,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface LineItem {
  id: string;
  style_number: string;
  product_name: string;
  color: string;
  size: string;
  quantity_ordered: number;
  quantity_received: number;
  receiving_quantity: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_name?: string;
  expected_delivery_date: string | null;
  receiving_status: string;
  status: string;
  confirmed_at: string | null;
  vendors?: {
    vendor_name: string;
  };
}

interface GroupedItem {
  style_number: string;
  product_name: string;
  color: string;
  vendor_name: string;
  items: LineItem[];
}

interface ReceiveGoodsProps {
  poId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const SIZE_ORDER = ['XS', '2XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', '6XL', 'YXS', 'YS', 'YM', 'YL', 'YXL'];

function sortSizes(a: string, b: string): number {
  const idxA = SIZE_ORDER.findIndex(s => s.toUpperCase() === a.toUpperCase());
  const idxB = SIZE_ORDER.findIndex(s => s.toUpperCase() === b.toUpperCase());
  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
  if (idxA !== -1) return -1;
  if (idxB !== -1) return 1;
  return a.localeCompare(b);
}

export function ReceiveGoods({ poId, onClose, onSuccess }: ReceiveGoodsProps) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    loadPODetails();
  }, [poId]);

  const loadPODetails = async () => {
    try {
      setLoading(true);

      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors!purchase_orders_vendor_id_fkey (
            vendor_name
          )
        `)
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      const poWithVendorName = {
        ...poData,
        vendor_name: poData.vendors?.vendor_name || 'Unknown Vendor',
      };
      setPo(poWithVendorName);

      if (poData.company_id) {
        const { data: settings } = await supabase
          .from('receiving_settings')
          .select('require_vendor_confirmation')
          .eq('company_id', poData.company_id)
          .maybeSingle();

        if (settings?.require_vendor_confirmation && !poData.confirmed_at) {
          setValidationError(
            'This PO has not been confirmed by the vendor yet. Please wait for vendor confirmation before receiving goods.'
          );
        }
      }

      const { data: items, error: itemsError } = await supabase
        .from('purchase_order_line_items')
        .select('*')
        .eq('po_id', poId)
        .order('style_number')
        .order('color')
        .order('size');

      if (itemsError) throw itemsError;

      setLineItems(
        (items || []).map((item) => ({
          ...item,
          receiving_quantity: 0,
        }))
      );
    } catch (error: any) {
      console.error('Error loading PO details:', error);
      alert(`Failed to load purchase order: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const groupedItems: GroupedItem[] = React.useMemo(() => {
    const groups: { [key: string]: GroupedItem } = {};

    lineItems.forEach((item) => {
      const key = `${item.style_number}-${item.color}`;
      if (!groups[key]) {
        groups[key] = {
          style_number: item.style_number,
          product_name: item.product_name,
          color: item.color,
          vendor_name: po?.vendor_name || 'Unknown Vendor',
          items: [],
        };
      }
      groups[key].items.push(item);
    });

    Object.values(groups).forEach((group) => {
      group.items.sort((a, b) => sortSizes(a.size, b.size));
    });

    return Object.values(groups);
  }, [lineItems, po]);

  const setQuantity = (itemId: string, value: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const remaining = item.quantity_ordered - item.quantity_received;
          const newQty = Math.max(0, Math.min(remaining, value));
          return { ...item, receiving_quantity: newQty };
        }
        return item;
      })
    );
  };

  const receiveAllSize = (itemId: string) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const remaining = item.quantity_ordered - item.quantity_received;
          return { ...item, receiving_quantity: remaining };
        }
        return item;
      })
    );
  };

  const receiveAllSizes = (styleNumber: string, color: string) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.style_number === styleNumber && item.color === color) {
          const remaining = item.quantity_ordered - item.quantity_received;
          return { ...item, receiving_quantity: remaining };
        }
        return item;
      })
    );
  };

  const getStatusColor = (item: LineItem): string => {
    const remaining = item.quantity_ordered - item.quantity_received;
    if (item.receiving_quantity === 0) return 'bg-red-500';
    if (item.receiving_quantity < remaining) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const handleSave = async () => {
    if (validationError) {
      alert(validationError);
      return;
    }

    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const totalReceiving = lineItems.reduce(
        (sum, item) => sum + item.receiving_quantity,
        0
      );

      if (totalReceiving === 0) {
        alert('Please enter at least one received quantity');
        return;
      }

      const receivingLineItems = lineItems
        .filter((item) => item.receiving_quantity > 0)
        .map((item) => ({
          po_line_item_id: item.id,
          quantity_received: item.receiving_quantity,
          quantity_damaged: 0,
          quantity_short: 0,
          variance_notes: '',
        }));

      const { data, error } = await ReceivingService.processReceiving(
        poId,
        user.id,
        receivingLineItems,
        'Goods received via UI'
      );

      if (error) throw error;

      // 2026-05-14 — process_receiving returns jsonb {success, error, message}
      // from inside the RPC. If success=false (e.g. vendor confirmation
      // required, or any caught exception inside the function), the outer
      // 'error' is null but the actual save was rolled back. Previously
      // this codepath swallowed those failures and showed a fake success
      // toast. Surface the real message now.
      const result = data as any;
      if (result && result.success === false) {
        throw new Error(result.message || result.error || 'Receiving failed (no message returned)');
      }

      alert('Goods received successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving receipt:', error);
      alert(`Failed to record receipt: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const totalReceiving = lineItems.reduce((sum, item) => sum + item.receiving_quantity, 0);
  const totalOrdered = lineItems.reduce((sum, item) => sum + item.quantity_ordered, 0);
  const totalPreviouslyReceived = lineItems.reduce((sum, item) => sum + item.quantity_received, 0);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (!po) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-lg">
                <Package className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Receive Goods
                </h2>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium">PO: {po.po_number}</span>
                  <span className="text-gray-400">•</span>
                  <span>{po.vendor_name}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {validationError && (
          <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 dark:text-red-200">Cannot Receive Goods</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{validationError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {groupedItems.map((group) => {
              const groupTotal = group.items.reduce((sum, item) => sum + item.receiving_quantity, 0);
              const groupOrdered = group.items.reduce((sum, item) => sum + item.quantity_ordered, 0);
              const groupPrevReceived = group.items.reduce((sum, item) => sum + item.quantity_received, 0);
              const groupRemaining = groupOrdered - groupPrevReceived;

              return (
                <div
                  key={`${group.style_number}-${group.color}`}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900 dark:text-white text-base">
                          {group.style_number}
                        </h3>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">
                          {group.product_name}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">
                          Color: <span className="font-medium text-gray-900 dark:text-white">{group.color}</span>
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">
                          Vendor: <span className="font-medium text-gray-900 dark:text-white">{group.vendor_name}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center px-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Total Needed
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                          {groupRemaining}
                        </div>
                      </div>
                      {groupTotal > 0 && (
                        <div className="text-center px-3">
                          <div className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide">
                            Receiving
                          </div>
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">
                            {groupTotal}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => receiveAllSizes(group.style_number, group.color)}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Receive All Sizes
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {group.items.map((item) => {
                      const remaining = item.quantity_ordered - item.quantity_received;
                      const statusColor = getStatusColor(item);

                      return (
                        <div
                          key={item.id}
                          className="flex-shrink-0 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 min-w-[140px]"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {item.size}
                            </span>
                            <div className={`w-3 h-3 rounded-full ${statusColor}`} title={
                              item.receiving_quantity === 0 ? 'Not received' :
                              item.receiving_quantity < remaining ? 'Partially received' : 'Fully received'
                            }></div>
                          </div>

                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                            Need: <span className="font-semibold text-gray-900 dark:text-white">{remaining}</span>
                          </div>

                          <div className="mb-2">
                            <input
                              type="number"
                              min="0"
                              max={remaining}
                              value={item.receiving_quantity}
                              onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 text-center text-sm font-bold border-2 border-gray-300 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                            />
                          </div>

                          {remaining > 0 && item.receiving_quantity !== remaining && (
                            <button
                              onClick={() => receiveAllSize(item.id)}
                              className="w-full px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                            >
                              Receive All
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Total Ordered
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalOrdered}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Previously Received
                </div>
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {totalPreviouslyReceived}
                </div>
              </div>
              <div>
                <div className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">
                  Receiving Now
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {totalReceiving}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || totalReceiving === 0 || !!validationError}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-green-500/20 transition-all flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Complete Receiving ({totalReceiving} items)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
