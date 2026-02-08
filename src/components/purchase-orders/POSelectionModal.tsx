import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  Loader2,
  Plus,
  X,
  FileText,
  Building2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { POSettingsService } from '../../services/po-settings-service';

interface LineItemPayload {
  style_number: string;
  product_name: string;
  color: string;
  size: string;
  quantity: number;
}

interface POSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorName: string;
  vendorId: string | null;
  companyId: string;
  items: LineItemPayload[];
  onSuccess: (poNumber: string) => void;
}

interface OpenPO {
  id: string;
  po_number: string;
  status: string;
  created_at: string;
  total_cost: number;
}

export function POSelectionModal({
  isOpen,
  onClose,
  vendorName,
  vendorId,
  companyId,
  items,
  onSuccess,
}: POSelectionModalProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [openPOs, setOpenPOs] = useState<OpenPO[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<string>('');

  useEffect(() => {
    if (isOpen && vendorId) {
      loadOpenPOs();
    } else if (isOpen) {
      setLoading(false);
      setOpenPOs([]);
    }
  }, [isOpen, vendorId]);

  const loadOpenPOs = async () => {
    try {
      setLoading(true);
      setSelectedPOId('');
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number, status, created_at, total_cost')
        .eq('company_id', companyId)
        .eq('vendor_id', vendorId!)
        .in('status', ['draft', 'sent'])
        .gte('created_at', `${todayStr}T00:00:00`)
        .lte('created_at', `${todayStr}T23:59:59.999`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOpenPOs(data || []);
    } catch (error) {
      console.error('Error loading open POs:', error);
      setOpenPOs([]);
    } finally {
      setLoading(false);
    }
  };

  const insertLineItems = async (poId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: maxLine } = await supabase
      .from('purchase_order_line_items')
      .select('line_number')
      .eq('po_id', poId)
      .order('line_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    let lineNumber = maxLine?.line_number || 0;

    const rows = items.map((item) => ({
      company_id: companyId,
      po_id: poId,
      line_number: ++lineNumber,
      style_number: item.style_number,
      product_name: item.product_name,
      color: item.color,
      size: item.size,
      quantity_ordered: item.quantity,
      quantity_received: 0,
      unit_cost: 0,
      extended_cost: 0,
    }));

    const { error } = await supabase
      .from('purchase_order_line_items')
      .insert(rows);

    if (error) throw error;

    await supabase.from('purchase_order_activity_log').insert({
      company_id: companyId,
      po_id: poId,
      action: 'items_added_from_report',
      performed_by: user.id,
      performed_by_name: user.email || 'User',
      notes: `Added ${items.length} item(s) from Garment Purchase Report`,
    });
  };

  const handleAddToExisting = async (poId: string) => {
    try {
      setProcessing(true);
      await insertLineItems(poId);
      const po = openPOs.find((p) => p.id === poId);
      onSuccess(po?.po_number || 'PO');
      onClose();
    } catch (error: any) {
      console.error('Error adding to PO:', error);
      alert(`Failed to add items: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      setProcessing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const poNumber = await POSettingsService.generatePONumber();

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          company_id: companyId,
          po_number: poNumber,
          vendor_id: vendorId,
          status: 'draft',
          subtotal: 0,
          tax_amount: 0,
          shipping_cost: 0,
          total_cost: 0,
          internal_notes: 'Created from Garment Purchase Report',
          created_by: user.id,
        })
        .select()
        .single();

      if (poError) throw poError;

      let lineNumber = 0;
      const rows = items.map((item) => ({
        company_id: companyId,
        po_id: po.id,
        line_number: ++lineNumber,
        style_number: item.style_number,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        quantity_ordered: item.quantity,
        quantity_received: 0,
        unit_cost: 0,
        extended_cost: 0,
      }));

      const { error } = await supabase
        .from('purchase_order_line_items')
        .insert(rows);

      if (error) throw error;

      await supabase.from('purchase_order_activity_log').insert({
        company_id: companyId,
        po_id: po.id,
        action: 'created',
        performed_by: user.id,
        performed_by_name: user.email || 'User',
        notes: 'PO created from Garment Purchase Report',
      });

      onSuccess(poNumber);
      onClose();
    } catch (error: any) {
      console.error('Error creating PO:', error);
      alert(`Failed to create PO: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg max-w-lg w-full border border-slate-700 shadow-2xl">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Add to Purchase Order
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">
                  {vendorName} &middot; {items.length} line items &middot;{' '}
                  {totalQty} units
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={processing}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : !vendorId ? (
            <div className="text-center py-6">
              <AlertCircle className="w-10 h-10 text-orange-400 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">Vendor Not Found</p>
              <p className="text-sm text-gray-400">
                &quot;{vendorName}&quot; does not match any vendor in your
                system. Please add this vendor first.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          ) : openPOs.length === 0 ? (
            <div className="text-center py-4">
              <FileText className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">No Open PO Found</p>
              <p className="text-sm text-gray-400 mb-6">
                No open purchase order found for {vendorName} today. Create a
                new one?
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onClose}
                  disabled={processing}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNew}
                  disabled={processing}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create New PO
                </button>
              </div>
            </div>
          ) : openPOs.length === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                Add these garments to{' '}
                <span className="font-semibold text-white">
                  {openPOs[0].po_number}
                </span>{' '}
                or create a new PO?
              </p>
              <div className="p-3 bg-slate-800 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">
                      {openPOs[0].po_number}
                    </p>
                    <p className="text-xs text-gray-400">
                      {openPOs[0].status === 'draft' ? 'Draft' : 'Sent'}{' '}
                      &middot; Created{' '}
                      {format(new Date(openPOs[0].created_at), 'h:mm a')}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">
                    ${openPOs[0].total_cost.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={processing}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNew}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  New PO
                </button>
                <button
                  onClick={() => handleAddToExisting(openPOs[0].id)}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex-1 justify-center"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Add to {openPOs[0].po_number}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-300">
                Select a PO to add garments to, or create a new PO.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {openPOs.map((po) => (
                  <button
                    key={po.id}
                    onClick={() => setSelectedPOId(po.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedPOId === po.id
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">
                          {po.po_number}
                        </p>
                        <p className="text-xs text-gray-400">
                          {po.status === 'draft' ? 'Draft' : 'Sent'} &middot;{' '}
                          {format(new Date(po.created_at), 'h:mm a')}
                        </p>
                      </div>
                      <span className="text-sm text-gray-400">
                        ${po.total_cost.toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  disabled={processing}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNew}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  New PO
                </button>
                <button
                  onClick={() =>
                    selectedPOId && handleAddToExisting(selectedPOId)
                  }
                  disabled={!selectedPOId || processing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-1 justify-center"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Add to Selected PO
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
