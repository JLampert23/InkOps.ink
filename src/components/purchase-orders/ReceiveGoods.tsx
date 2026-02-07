import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  X,
  Package,
  CheckCircle2,
  AlertTriangle,
  Scan,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { POSettingsService } from '../../services/po-settings-service';
import { ReceivingService } from '../../services/receiving-service';

interface LineItem {
  id: string;
  style_number: string;
  product_name: string;
  color: string;
  size: string;
  quantity_ordered: number;
  quantity_received: number;
  upc_code: string | null;
  receiving: {
    quantity_received: number;
    quantity_damaged: number;
    quantity_short: number;
    variance_notes: string;
  };
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
  key: string;
  style_number: string;
  product_name: string;
  color: string;
  items: number[];
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

function getSizeStatus(needed: number, received: number): 'none' | 'partial' | 'full' {
  if (needed <= 0) return 'full';
  if (received <= 0) return 'none';
  if (received >= needed) return 'full';
  return 'partial';
}

function StatusDot({ needed, received }: { needed: number; received: number }) {
  const status = getSizeStatus(needed, received);
  const colors = {
    none: 'bg-red-500',
    partial: 'bg-yellow-500',
    full: 'bg-green-500',
  };
  const labels = {
    none: 'Not received',
    partial: 'Partially received',
    full: 'Fully received',
  };
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`}
      title={labels[status]}
    />
  );
}

export function ReceiveGoods({ poId, onClose, onSuccess }: ReceiveGoodsProps) {
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [notes, setNotes] = useState('');
  const [markAsComplete, setMarkAsComplete] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPOData();
  }, [poId]);

  useEffect(() => {
    if (scanMode && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [scanMode]);

  const loadPOData = async () => {
    try {
      setLoading(true);

      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          status,
          confirmed_at,
          expected_delivery_date,
          receiving_status,
          vendors!vendor_id (
            vendor_name
          )
        `)
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      const validation = await POSettingsService.canReceiveGoods({
        status: poData.status,
        confirmed_at: poData.confirmed_at,
      });

      if (!validation.allowed) {
        setValidationError(validation.reason || 'Cannot receive goods for this PO.');
      }

      const { data: items, error: itemsError } = await supabase
        .from('purchase_order_line_items')
        .select('*')
        .eq('po_id', poId)
        .order('line_number');

      if (itemsError) throw itemsError;

      setPO({
        ...poData,
        vendor_name: poData.vendors?.vendor_name || 'Unknown',
      });

      setLineItems(
        (items || []).map((item) => ({
          ...item,
          receiving: {
            quantity_received: 0,
            quantity_damaged: 0,
            quantity_short: 0,
            variance_notes: '',
          },
        }))
      );
    } catch (error) {
      console.error('Error loading PO data:', error);
      alert('Failed to load purchase order');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo<GroupedItem[]>(() => {
    const map = new Map<string, GroupedItem>();
    lineItems.forEach((item, idx) => {
      const key = `${item.style_number}||${item.color}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          style_number: item.style_number,
          product_name: item.product_name,
          color: item.color,
          items: [],
        });
      }
      map.get(key)!.items.push(idx);
    });
    const groups = Array.from(map.values());
    groups.forEach(g => {
      g.items.sort((a, b) => sortSizes(lineItems[a].size, lineItems[b].size));
    });
    return groups;
  }, [lineItems]);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const itemIndex = lineItems.findIndex(
      (item) => item.upc_code === scanInput.trim() || item.style_number === scanInput.trim()
    );

    if (itemIndex !== -1) {
      const updatedItems = [...lineItems];
      updatedItems[itemIndex].receiving.quantity_received += 1;
      setLineItems(updatedItems);
      setScanInput('');

      const itemElement = document.getElementById(`item-${itemIndex}`);
      if (itemElement) {
        itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        itemElement.classList.add('ring-2', 'ring-green-500');
        setTimeout(() => {
          itemElement.classList.remove('ring-2', 'ring-green-500');
        }, 1000);
      }
    } else {
      alert('Item not found in this PO');
      setScanInput('');
    }
  };

  const updateReceiving = (index: number, field: keyof LineItem['receiving'], value: number) => {
    const updatedItems = [...lineItems];
    updatedItems[index].receiving[field] = Math.max(0, value) as never;
    setLineItems(updatedItems);
  };

  const updateNotes = (index: number, notesVal: string) => {
    const updatedItems = [...lineItems];
    updatedItems[index].receiving.variance_notes = notesVal;
    setLineItems(updatedItems);
  };

  const handleReceiveSize = (index: number) => {
    const updatedItems = [...lineItems];
    const item = updatedItems[index];
    const remaining = item.quantity_ordered - item.quantity_received;
    updatedItems[index].receiving.quantity_received = Math.max(0, remaining);
    setLineItems(updatedItems);
  };

  const handleReceiveAllSizes = (group: GroupedItem) => {
    const updatedItems = [...lineItems];
    group.items.forEach(idx => {
      const item = updatedItems[idx];
      const remaining = item.quantity_ordered - item.quantity_received;
      updatedItems[idx].receiving.quantity_received = Math.max(0, remaining);
    });
    setLineItems(updatedItems);
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
        (sum, item) => sum + item.receiving.quantity_received,
        0
      );

      if (totalReceiving === 0) {
        alert('Please enter at least one received quantity');
        return;
      }

      const receivingLineItems = lineItems
        .filter(
          (item) =>
            item.receiving.quantity_received > 0 ||
            item.receiving.quantity_damaged > 0 ||
            item.receiving.quantity_short > 0
        )
        .map((item) => ({
          po_line_item_id: item.id,
          quantity_received: item.receiving.quantity_received,
          quantity_damaged: item.receiving.quantity_damaged,
          quantity_short: item.receiving.quantity_short,
          variance_notes: item.receiving.variance_notes || '',
        }));

      const { data: result, error } = await ReceivingService.processReceiving(
        poId,
        user.id,
        receivingLineItems,
        notes
      );

      if (error) throw error;

      if (!result?.success) {
        if (result?.error === 'vendor_confirmation_required') {
          alert(
            'This PO requires vendor confirmation before receiving. Please confirm the PO first.'
          );
        } else {
          alert(result?.message || 'Failed to process receiving');
        }
        return;
      }

      alert(result.message || 'Goods received successfully');
      onSuccess();
    } catch (error) {
      console.error('Error saving receiving:', error);
      alert('Failed to save receiving data');
    } finally {
      setSaving(false);
    }
  };

  const getTotalStats = () => {
    return lineItems.reduce(
      (acc, item) => ({
        ordered: acc.ordered + item.quantity_ordered,
        previouslyReceived: acc.previouslyReceived + item.quantity_received,
        receiving: acc.receiving + item.receiving.quantity_received,
        damaged: acc.damaged + item.receiving.quantity_damaged,
        short: acc.short + item.receiving.quantity_short,
      }),
      { ordered: 0, previouslyReceived: 0, receiving: 0, damaged: 0, short: 0 }
    );
  };

  const getGroupStatus = (group: GroupedItem): 'none' | 'partial' | 'full' => {
    let allFull = true;
    let anyReceived = false;
    group.items.forEach(idx => {
      const item = lineItems[idx];
      const needed = item.quantity_ordered - item.quantity_received;
      if (item.receiving.quantity_received > 0) anyReceived = true;
      if (item.receiving.quantity_received < needed) allFull = false;
    });
    if (allFull) return 'full';
    if (anyReceived) return 'partial';
    return 'none';
  };

  const stats = getTotalStats();

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
      <div className="bg-white dark:bg-slate-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Receive Goods
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                PO: {po.po_number} | Vendor: {po.vendor_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {validationError && (
          <div className="p-6 border-b border-gray-200 dark:border-slate-700 bg-red-50 dark:bg-red-900/20">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900 dark:text-red-200">Cannot Receive Goods</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{validationError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Ordered</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.ordered}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Previously</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.previouslyReceived}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Receiving Now</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.receiving}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Damaged</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.damaged}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 uppercase mb-1">Short</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.short}</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setScanMode(!scanMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                scanMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600'
              }`}
            >
              <Scan className="w-5 h-5" />
              {scanMode ? 'Scanning Active' : 'Enable Scan Mode'}
            </button>
            {scanMode && (
              <form onSubmit={handleScan} className="flex-1">
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Scan barcode or enter SKU..."
                  className="w-full px-4 py-2 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                />
              </form>
            )}
          </div>
          {scanMode && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              Scan items or enter SKU to automatically increment received quantity
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {grouped.map((group) => {
              const groupStatus = getGroupStatus(group);
              const groupTotalOrdered = group.items.reduce((s, idx) => s + lineItems[idx].quantity_ordered, 0);
              const groupTotalPrev = group.items.reduce((s, idx) => s + lineItems[idx].quantity_received, 0);
              const groupTotalReceiving = group.items.reduce((s, idx) => s + lineItems[idx].receiving.quantity_received, 0);
              const groupRemaining = groupTotalOrdered - groupTotalPrev;
              const allFullyReceived = group.items.every(idx => {
                const item = lineItems[idx];
                return item.receiving.quantity_received >= (item.quantity_ordered - item.quantity_received);
              });

              return (
                <div
                  key={group.key}
                  className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-4 bg-gray-50 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          groupStatus === 'full'
                            ? 'bg-green-500'
                            : groupStatus === 'partial'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {group.style_number}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {group.product_name} &mdash; {group.color}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                        <span>Ordered: <span className="font-semibold text-gray-900 dark:text-white">{groupTotalOrdered}</span></span>
                        <span className="mx-2">|</span>
                        <span>Prev: <span className="font-semibold text-blue-600 dark:text-blue-400">{groupTotalPrev}</span></span>
                        <span className="mx-2">|</span>
                        <span>Receiving: <span className="font-semibold text-green-600 dark:text-green-400">{groupTotalReceiving}</span></span>
                      </div>
                      {!allFullyReceived && groupRemaining > 0 && (
                        <button
                          onClick={() => handleReceiveAllSizes(group)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Receive All Sizes
                        </button>
                      )}
                      {allFullyReceived && (
                        <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-4 h-4" />
                          All Received
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
                    <div className="grid grid-cols-12 gap-2 px-5 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-slate-800/50">
                      <div className="col-span-1">Status</div>
                      <div className="col-span-1">Size</div>
                      <div className="col-span-1 text-center">Needed</div>
                      <div className="col-span-1 text-center">Prev</div>
                      <div className="col-span-3 text-center">Receiving</div>
                      <div className="col-span-1 text-center">Damaged</div>
                      <div className="col-span-1 text-center">Short</div>
                      <div className="col-span-3">Notes</div>
                    </div>

                    {group.items.map((itemIdx) => {
                      const item = lineItems[itemIdx];
                      const needed = item.quantity_ordered - item.quantity_received;
                      const isFullyReceived = item.receiving.quantity_received >= needed && needed > 0;
                      const hasVariance = item.receiving.quantity_damaged > 0 || item.receiving.quantity_short > 0;

                      return (
                        <div
                          key={item.id}
                          id={`item-${itemIdx}`}
                          className={`grid grid-cols-12 gap-2 px-5 py-3 items-center transition-colors ${
                            isFullyReceived
                              ? 'bg-green-50/50 dark:bg-green-900/10'
                              : hasVariance
                              ? 'bg-orange-50/50 dark:bg-orange-900/10'
                              : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'
                          }`}
                        >
                          <div className="col-span-1 flex items-center">
                            <StatusDot needed={needed} received={item.receiving.quantity_received} />
                          </div>

                          <div className="col-span-1">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 text-sm font-semibold rounded bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 min-w-[3rem] text-center">
                              {item.size}
                            </span>
                          </div>

                          <div className="col-span-1 text-center">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{needed}</span>
                          </div>

                          <div className="col-span-1 text-center">
                            <span className="text-sm text-blue-600 dark:text-blue-400">{item.quantity_received}</span>
                          </div>

                          <div className="col-span-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={item.receiving.quantity_received}
                                onChange={(e) =>
                                  updateReceiving(
                                    itemIdx,
                                    'quantity_received',
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className={`w-20 px-2 py-1.5 border rounded text-center text-sm font-medium dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                  isFullyReceived
                                    ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                                    : 'border-gray-300 dark:border-slate-600'
                                }`}
                              />
                              {!isFullyReceived && needed > 0 && (
                                <button
                                  onClick={() => handleReceiveSize(itemIdx)}
                                  className="px-2 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 rounded transition-colors whitespace-nowrap"
                                >
                                  Receive All
                                </button>
                              )}
                              {isFullyReceived && (
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                              )}
                            </div>
                          </div>

                          <div className="col-span-1">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={item.receiving.quantity_damaged}
                              onChange={(e) =>
                                updateReceiving(itemIdx, 'quantity_damaged', parseInt(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-center text-sm dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div className="col-span-1">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={item.receiving.quantity_short}
                              onChange={(e) =>
                                updateReceiving(itemIdx, 'quantity_short', parseInt(e.target.value) || 0)
                              }
                              className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-center text-sm dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div className="col-span-3">
                            <input
                              type="text"
                              value={item.receiving.variance_notes}
                              onChange={(e) => updateNotes(itemIdx, e.target.value)}
                              placeholder="Optional..."
                              className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {grouped.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg font-medium">No line items found</p>
                <p className="text-sm mt-1">This purchase order has no items to receive.</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Receiving Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add any notes about this receiving..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={markAsComplete}
                  onChange={(e) => setMarkAsComplete(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Mark PO as fully received (close PO)
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="px-6 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || stats.receiving === 0}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Receiving
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
