import { useEffect, useMemo, useState } from 'react';
import { X, Package, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface MarkedOrderedStagingRow {
  id: string;
  quote_id: string;
  work_order_id: string | null;
  work_order_number?: string;
  style_number: string | null;
  style_name: string | null;
  color: string | null;
  total_quantity: number;
  quantity_received: number;
  // {"S": 10, "M": 20, "L": 15} — what was ordered
  sizes: Record<string, number> | null;
  // {"S": 5, "M": 10, "L": 0} — what's been received so far
  quantity_received_by_size: Record<string, number> | null;
  customer_name?: string;
  quote_number?: string;
}

interface ReceiveMarkedOrderedModalProps {
  item: MarkedOrderedStagingRow;
  onClose: () => void;
  onSuccess: () => void;
}

// 2026-05-14 — Mirror of the size-level UI from ReceiveGoods.tsx (which
// receives against a formal PO via purchase_order_line_items), but
// receiving against garment_requirements_staging rows that were flagged
// via Mark Ordered. Per client: same look + behavior, just a different
// data source.
const SIZE_ORDER = ['XS', '2XS', 'XXS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL', '6XL', 'YXS', 'YS', 'YM', 'YL', 'YXL'];

function sortSizes(a: string, b: string): number {
  const idxA = SIZE_ORDER.findIndex(s => s.toUpperCase() === a.toUpperCase());
  const idxB = SIZE_ORDER.findIndex(s => s.toUpperCase() === b.toUpperCase());
  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
  if (idxA !== -1) return -1;
  if (idxB !== -1) return 1;
  return a.localeCompare(b);
}

export function ReceiveMarkedOrderedModal({ item, onClose, onSuccess }: ReceiveMarkedOrderedModalProps) {
  const [saving, setSaving] = useState(false);
  // Per-size "receiving now" qty draft (resets on save). Keyed by size.
  const [draftBySize, setDraftBySize] = useState<Record<string, number>>({});

  // Build the row list from the staging row's `sizes` JSONB.
  // Falls back to a single synthetic "All" row if no breakdown exists
  // (legacy rows pre-2026-05-14 that were inserted without sizes).
  const rows = useMemo(() => {
    const sizes = item.sizes || {};
    const received = item.quantity_received_by_size || {};
    const sizeKeys = Object.keys(sizes).filter(k => (sizes[k] || 0) > 0);
    if (sizeKeys.length === 0) {
      // Legacy fallback — single bucket using the aggregate total.
      return [{
        size: 'All',
        needed: item.total_quantity || 0,
        alreadyReceived: item.quantity_received || 0,
        remaining: Math.max(0, (item.total_quantity || 0) - (item.quantity_received || 0)),
        isFallback: true,
      }];
    }
    return sizeKeys
      .sort(sortSizes)
      .map(size => {
        const needed = sizes[size] || 0;
        const alreadyReceived = received[size] || 0;
        return {
          size,
          needed,
          alreadyReceived,
          remaining: Math.max(0, needed - alreadyReceived),
          isFallback: false,
        };
      });
  }, [item]);

  useEffect(() => {
    setDraftBySize({});
  }, [item.id]);

  const setQty = (size: string, raw: string) => {
    const row = rows.find(r => r.size === size);
    if (!row) return;
    const n = parseInt(raw, 10);
    const clean = isNaN(n) || n < 0 ? 0 : Math.min(row.remaining, n);
    setDraftBySize(prev => ({ ...prev, [size]: clean }));
  };

  const receiveAll = (size: string) => {
    const row = rows.find(r => r.size === size);
    if (!row) return;
    setDraftBySize(prev => ({ ...prev, [size]: row.remaining }));
  };

  const receiveAllSizes = () => {
    const next: Record<string, number> = {};
    rows.forEach(r => { next[r.size] = r.remaining; });
    setDraftBySize(next);
  };

  const totalDraft = Object.values(draftBySize).reduce((sum, n) => sum + (n || 0), 0);
  const totalNeeded = rows.reduce((sum, r) => sum + r.needed, 0);
  const totalAlreadyReceived = rows.reduce((sum, r) => sum + r.alreadyReceived, 0);
  const totalRemaining = rows.reduce((sum, r) => sum + r.remaining, 0);

  const handleSave = async () => {
    if (totalDraft === 0) {
      alert('Enter at least one quantity to receive.');
      return;
    }
    setSaving(true);
    try {
      // Merge per-size receipts. Each size's new value = previous +
      // draft. The aggregate quantity_received column is the SUM of all
      // per-size values so legacy code (Master Schedule stock badge,
      // etc.) keeps working.
      const previousBySize = item.quantity_received_by_size || {};
      const nextBySize: Record<string, number> = { ...previousBySize };
      Object.entries(draftBySize).forEach(([size, qty]) => {
        if (!qty) return;
        // Fallback row updates the aggregate only; don't write a fake
        // "All" key into the per-size map.
        if (size === 'All') return;
        nextBySize[size] = (nextBySize[size] || 0) + qty;
      });

      const newAggregate = (item.quantity_received || 0) + totalDraft;
      const isFullyReceived = newAggregate >= (item.total_quantity || 0);

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('garment_requirements_staging')
        .update({
          quantity_received_by_size: nextBySize,
          quantity_received: newAggregate,
          is_received: isFullyReceived,
          received_at: new Date().toISOString(),
          received_by: user?.email || user?.id || null,
        })
        .eq('id', item.id);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Receive failed:', err);
      alert(`Failed to record receipt: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-lg max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-amber-100 dark:from-slate-800 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-600 rounded-lg">
                <Package className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Receive Goods (Mark Ordered)
                </h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                  {item.work_order_number && (
                    <>
                      <span className="font-medium">{item.work_order_number}</span>
                      <span className="text-gray-400">•</span>
                    </>
                  )}
                  {item.customer_name && (
                    <>
                      <span>{item.customer_name}</span>
                      <span className="text-gray-400">•</span>
                    </>
                  )}
                  <span className="font-medium">{item.style_number || '—'}</span>
                  {item.color && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span>Color: <span className="font-medium text-gray-900 dark:text-white">{item.color}</span></span>
                    </>
                  )}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {rows[0]?.isFallback
                  ? 'No per-size breakdown was saved when this item was marked ordered. Enter the total received.'
                  : 'Enter quantities received per size. Already-received quantities are accumulated.'}
              </div>
              {!rows[0]?.isFallback && totalRemaining > 0 && (
                <button
                  onClick={receiveAllSizes}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  Receive All Sizes
                </button>
              )}
            </div>

            <div className="flex items-start gap-2 overflow-x-auto pb-2">
              {rows.map(row => {
                const draft = draftBySize[row.size] || 0;
                const isFull = row.remaining === 0;
                const statusColor = isFull
                  ? 'bg-green-500'
                  : draft === 0
                  ? 'bg-red-500'
                  : draft < row.remaining
                  ? 'bg-yellow-500'
                  : 'bg-green-500';
                return (
                  <div
                    key={row.size}
                    className="flex-shrink-0 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 min-w-[140px]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{row.size}</span>
                      <div className={`w-3 h-3 rounded-full ${statusColor}`} />
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Need: <span className="font-semibold text-gray-900 dark:text-white">{row.remaining}</span>
                    </div>
                    {row.alreadyReceived > 0 && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                        Prior: {row.alreadyReceived} / {row.needed}
                      </div>
                    )}
                    <div className="mb-2">
                      <input
                        type="number"
                        min="0"
                        max={row.remaining}
                        value={draft || ''}
                        placeholder="0"
                        onChange={(e) => setQty(row.size, e.target.value)}
                        disabled={isFull}
                        className="w-full px-2 py-1.5 text-center text-sm font-bold border-2 border-gray-300 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                      />
                    </div>
                    {row.remaining > 0 && draft !== row.remaining && (
                      <button
                        onClick={() => receiveAll(row.size)}
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
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-slate-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Total Needed</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalNeeded}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Previously Received</div>
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{totalAlreadyReceived}</div>
              </div>
              <div>
                <div className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide mb-1">Receiving Now</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{totalDraft}</div>
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
                disabled={saving || totalDraft === 0}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg shadow-green-500/20 transition-all flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Complete Receiving ({totalDraft})
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
