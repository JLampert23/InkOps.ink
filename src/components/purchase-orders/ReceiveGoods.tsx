import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  X,
  Package,
  Save,
  Loader2,
  AlertCircle,
  Plus,
  Minus,
  CheckCircle2,
} from 'lucide-react';
import { ReceivingService } from '../../services/receiving-service';

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
  vendor_name: string;
  expected_delivery_date: string | null;
  receiving_status: string;
  status: string;
  confirmed_at: string | null;
  vendor?: {
    vendor_name: string;
  };
}

interface GroupedItem {
  style_number: string;
  product_name: string;
  color: string;
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
          id,
          po_number,
          vendor_name,
          expected_delivery_date,
          receiving_status,
          status,
          confirmed_at,
          vendors!vendor_id (
            vendor_name
          )
        `)
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      const poWithVendorName = {
        ...poData,
        vendor_name: poData.vendors?.vendor_name || poData.vendor_name,
      };
      setPo(poWithVendorName);

      const settings = await ReceivingService.getSettings();
      if (settings.require_vendor_confirmation && !poData.confirmed_at) {
        setValidationError(
          'This PO has not been confirmed by the vendor yet. Please wait for vendor confirmation before receiving goods.'
        );
      }

      const { data: items, error: itemsError } = await supabase
        .from('po_line_items')
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
    } catch (error) {
      console.error('Error loading PO details:', error);
      alert('Failed to load PO details');
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
          items: [],
        };
      }
      groups[key].items.push(item);
    });

    Object.values(groups).forEach((group) => {
      group.items.sort((a, b) => sortSizes(a.size, b.size));
    });

    return Object.values(groups);
  }, [lineItems]);

  const updateQuantity = (itemId: string, delta: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const remaining = item.quantity_ordered - item.quantity_received;
          const newQty = Math.max(0, Math.min(remaining, item.receiving_quantity + delta));
          return { ...item, receiving_quantity: newQty };
        }
        return item;
      })
    );
  };

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

      await ReceivingService.recordReceipt(poId, receivingLineItems, user.id);

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
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
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
          <div className="space-y-6">
            {groupedItems.map((group) => {
              const groupTotal = group.items.reduce((sum, item) => sum + item.receiving_quantity, 0);
              const groupOrdered = group.items.reduce((sum, item) => sum + item.quantity_ordered, 0);
              const groupPrevReceived = group.items.reduce((sum, item) => sum + item.quantity_received, 0);
              const groupRemaining = groupOrdered - groupPrevReceived;

              return (
                <div
                  key={`${group.style_number}-${group.color}`}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                            {group.product_name}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Style: <span className="font-medium text-gray-900 dark:text-white">{group.style_number}</span>
                            </span>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-600 dark:text-gray-400">
                              Color: <span className="font-medium text-gray-900 dark:text-white">{group.color}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                            Remaining
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {groupRemaining}
                          </div>
                        </div>
                        {groupTotal > 0 && (
                          <div className="text-center">
                            <div className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">
                              Receiving
                            </div>
                            <div className="text-xl font-bold text-green-600 dark:text-green-400">
                              {groupTotal}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Size
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Ordered
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Previously Received
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Remaining
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Receive Now
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                        {group.items.map((item) => {
                          const remaining = item.quantity_ordered - item.quantity_received;
                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <td className="px-4 py-4">
                                <span className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold rounded-lg text-sm shadow-sm">
                                  {item.size}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center text-gray-900 dark:text-white font-medium">
                                {item.quantity_ordered}
                              </td>
                              <td className="px-4 py-4 text-center text-gray-600 dark:text-gray-400">
                                {item.quantity_received}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                                  {remaining}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-center gap-3">
                                  <button
                                    onClick={() => updateQuantity(item.id, -1)}
                                    disabled={item.receiving_quantity <= 0}
                                    className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Minus className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    max={remaining}
                                    value={item.receiving_quantity}
                                    onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)}
                                    className="w-20 px-3 py-2 text-center text-lg font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                  />
                                  <button
                                    onClick={() => updateQuantity(item.id, 1)}
                                    disabled={item.receiving_quantity >= remaining}
                                    className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Plus className="w-4 h-4 text-green-700 dark:text-green-400" />
                                  </button>
                                  {remaining > 0 && item.receiving_quantity !== remaining && (
                                    <button
                                      onClick={() => setQuantity(item.id, remaining)}
                                      className="ml-2 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                    >
                                      All
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
