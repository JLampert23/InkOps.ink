import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  X,
  Package,
  CheckCircle2,
  AlertTriangle,
  Scan,
  Plus,
  Minus,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { POSettingsService } from '../../services/po-settings-service';

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

interface ReceiveGoodsProps {
  poId: string;
  onClose: () => void;
  onSuccess: () => void;
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
        .order('style_number');

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

  const updateNotes = (index: number, notes: string) => {
    const updatedItems = [...lineItems];
    updatedItems[index].receiving.variance_notes = notes;
    setLineItems(updatedItems);
  };

  const handleQuickReceiveAll = (index: number) => {
    const updatedItems = [...lineItems];
    const item = updatedItems[index];
    const remaining = item.quantity_ordered - item.quantity_received;
    updatedItems[index].receiving.quantity_received = remaining;
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

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      const totalReceiving = lineItems.reduce(
        (sum, item) => sum + item.receiving.quantity_received,
        0
      );

      if (totalReceiving === 0) {
        alert('Please enter at least one received quantity');
        return;
      }

      const allFullyReceived = lineItems.every(
        (item) =>
          item.quantity_received + item.receiving.quantity_received >= item.quantity_ordered
      );

      const status = markAsComplete || allFullyReceived ? 'complete' : 'partial';

      const { data: receivingLog, error: logError } = await supabase
        .from('receiving_logs')
        .insert({
          company_id: profile.company_id,
          po_id: poId,
          received_by: user.id,
          status: status,
          notes: notes,
        })
        .select()
        .single();

      if (logError) throw logError;

      for (const item of lineItems) {
        if (item.receiving.quantity_received > 0 ||
            item.receiving.quantity_damaged > 0 ||
            item.receiving.quantity_short > 0) {

          const { error: lineItemError } = await supabase
            .from('receiving_line_items')
            .insert({
              receiving_log_id: receivingLog.id,
              po_line_item_id: item.id,
              quantity_received: item.receiving.quantity_received,
              quantity_damaged: item.receiving.quantity_damaged,
              quantity_short: item.receiving.quantity_short,
              variance_notes: item.receiving.variance_notes,
            });

          if (lineItemError) throw lineItemError;

          const newTotal = item.quantity_received + item.receiving.quantity_received;
          const { error: updateError } = await supabase
            .from('purchase_order_line_items')
            .update({
              quantity_received: newTotal,
              quantity_damaged: (item.quantity_damaged || 0) + item.receiving.quantity_damaged,
              quantity_short: (item.quantity_short || 0) + item.receiving.quantity_short,
            })
            .eq('id', item.id);

          if (updateError) throw updateError;
        }
      }

      alert('Goods received successfully');
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
        {/* Header */}
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

        {/* Validation Error */}
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

        {/* Stats */}
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

        {/* Scan Mode */}
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

        {/* Line Items */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {lineItems.map((item, index) => {
              const remaining = item.quantity_ordered - item.quantity_received;
              const hasVariance =
                item.receiving.quantity_damaged > 0 || item.receiving.quantity_short > 0;

              return (
                <div
                  key={item.id}
                  id={`item-${index}`}
                  className={`border rounded-lg p-4 transition-all ${
                    hasVariance
                      ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/10'
                      : 'border-gray-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {item.style_number}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.product_name} - {item.color} - {item.size}
                      </p>
                      {item.upc_code && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          UPC: {item.upc_code}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Ordered: <span className="font-medium">{item.quantity_ordered}</span>
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Previously: <span className="font-medium">{item.quantity_received}</span>
                      </p>
                      <p className="text-sm text-orange-600 dark:text-orange-400">
                        Remaining: <span className="font-medium">{remaining}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {/* Received */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Received
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateReceiving(
                              index,
                              'quantity_received',
                              item.receiving.quantity_received - 1
                            )
                          }
                          className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          value={item.receiving.quantity_received}
                          onChange={(e) =>
                            updateReceiving(
                              index,
                              'quantity_received',
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-center dark:bg-slate-700 dark:text-white"
                        />
                        <button
                          onClick={() =>
                            updateReceiving(
                              index,
                              'quantity_received',
                              item.receiving.quantity_received + 1
                            )
                          }
                          className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {remaining > 0 && (
                        <button
                          onClick={() => handleQuickReceiveAll(index)}
                          className="w-full mt-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          Receive All ({remaining})
                        </button>
                      )}
                    </div>

                    {/* Damaged */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Damaged
                      </label>
                      <input
                        type="number"
                        value={item.receiving.quantity_damaged}
                        onChange={(e) =>
                          updateReceiving(index, 'quantity_damaged', parseInt(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-center dark:bg-slate-700 dark:text-white"
                      />
                    </div>

                    {/* Short */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Short
                      </label>
                      <input
                        type="number"
                        value={item.receiving.quantity_short}
                        onChange={(e) =>
                          updateReceiving(index, 'quantity_short', parseInt(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-center dark:bg-slate-700 dark:text-white"
                      />
                    </div>

                    {/* Variance Notes */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={item.receiving.variance_notes}
                        onChange={(e) => updateNotes(index, e.target.value)}
                        placeholder="Optional..."
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded dark:bg-slate-700 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
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
