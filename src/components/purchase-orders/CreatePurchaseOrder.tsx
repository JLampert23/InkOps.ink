import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Search,
  Loader2,
  Building2,
  Package,
  DollarSign,
  Calendar,
  FileText,
  Upload,
} from 'lucide-react';

interface Vendor {
  id: string;
  vendor_name: string;
  vendor_type: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
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
  unit_cost: number;
  extended_cost: number;
  vendor_product_id?: string;
  notes?: string;
}

interface CreatePurchaseOrderProps {
  onBack: () => void;
  onSave: (poId: string) => void;
}

export function CreatePurchaseOrder({ onBack, onSave }: CreatePurchaseOrderProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      line_number: 1,
      sku: '',
      style_number: '',
      product_name: '',
      color: '',
      size: '',
      quantity_ordered: 1,
      unit_cost: 0,
      extended_cost: 0,
      notes: '',
    },
  ]);
  const [notesToVendor, setNotesToVendor] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [taxAmount, setTaxAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);

  useEffect(() => {
    loadVendors();
    generatePONumber();
  }, []);

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('vendor_name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
      alert('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const generatePONumber = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_po_number');
      if (error) throw error;
      setPoNumber(data);
    } catch (error) {
      console.error('Error generating PO number:', error);
      setPoNumber('PO-00001');
    }
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.extended_cost, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + taxAmount + shippingCost;
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity_ordered' || field === 'unit_cost') {
      updated[index].extended_cost = updated[index].quantity_ordered * updated[index].unit_cost;
    }

    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: crypto.randomUUID(),
        line_number: lineItems.length + 1,
        sku: '',
        style_number: '',
        product_name: '',
        color: '',
        size: '',
        quantity_ordered: 1,
        unit_cost: 0,
        extended_cost: 0,
        notes: '',
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) {
      alert('At least one line item is required');
      return;
    }
    const updated = lineItems.filter((_, i) => i !== index);
    updated.forEach((item, i) => {
      item.line_number = i + 1;
    });
    setLineItems(updated);
  };

  const handleSearchProduct = async (index: number) => {
    setActiveLineIndex(index);
    setShowProductSearch(true);
  };

  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
    if (!selectedVendor) {
      alert('Please select a vendor');
      return;
    }

    if (lineItems.length === 0 || lineItems.every((item) => !item.product_name)) {
      alert('Please add at least one line item');
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

      const subtotal = calculateSubtotal();
      const total = calculateTotal();

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert([
          {
            company_id: profile.company_id,
            po_number: poNumber,
            vendor_id: selectedVendor,
            status,
            subtotal,
            tax_amount: taxAmount,
            shipping_cost: shippingCost,
            total_cost: total,
            notes_to_vendor: notesToVendor || null,
            internal_notes: internalNotes || null,
            expected_delivery_date: expectedDeliveryDate || null,
            sent_at: status === 'sent' ? new Date().toISOString() : null,
            created_by: user.id,
          },
        ])
        .select()
        .single();

      if (poError) throw poError;

      const lineItemsData = lineItems
        .filter((item) => item.product_name)
        .map((item) => ({
          company_id: profile.company_id,
          po_id: po.id,
          line_number: item.line_number,
          sku: item.sku || null,
          style_number: item.style_number || null,
          product_name: item.product_name,
          color: item.color || null,
          size: item.size || null,
          quantity_ordered: item.quantity_ordered,
          quantity_received: 0,
          unit_cost: item.unit_cost,
          extended_cost: item.extended_cost,
          vendor_product_id: item.vendor_product_id || null,
          notes: item.notes || null,
        }));

      const { error: lineItemsError } = await supabase
        .from('purchase_order_line_items')
        .insert(lineItemsData);

      if (lineItemsError) throw lineItemsError;

      await supabase.from('purchase_order_activity_log').insert([
        {
          company_id: profile.company_id,
          po_id: po.id,
          action: status === 'sent' ? 'sent' : 'created',
          performed_by: user.id,
          performed_by_name: user.email || 'Unknown',
          notes: status === 'sent' ? 'Purchase order sent to vendor' : 'Purchase order created',
        },
      ]);

      alert(`Purchase order ${status === 'sent' ? 'sent' : 'saved'} successfully!`);
      onSave(po.id);
    } catch (error) {
      console.error('Error saving purchase order:', error);
      alert('Failed to save purchase order');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedVendorData = vendors.find((v) => v.id === selectedVendor);

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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Purchase Order</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{poNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSave('draft')}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button
            onClick={() => handleSave('sent')}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            Save & Send
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vendor Selection */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Vendor Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Vendor *
                </label>
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                >
                  <option value="">Choose a vendor...</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendor_name} ({vendor.vendor_type})
                    </option>
                  ))}
                </select>
              </div>

              {selectedVendorData && (
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 space-y-2 text-sm">
                  {selectedVendorData.contact_name && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Contact:</span> {selectedVendorData.contact_name}
                    </p>
                  )}
                  {selectedVendorData.contact_email && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Email:</span> {selectedVendorData.contact_email}
                    </p>
                  )}
                  {selectedVendorData.contact_phone && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Phone:</span> {selectedVendorData.contact_phone}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Line Items
              </h3>
              <button
                onClick={addLineItem}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div
                  key={item.id}
                  className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Line {item.line_number}
                    </span>
                    {lineItems.length > 1 && (
                      <button
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Style Number
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={item.style_number}
                          onChange={(e) => updateLineItem(index, 'style_number', e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                          placeholder="e.g., 18500"
                        />
                        <button
                          onClick={() => handleSearchProduct(index)}
                          className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                          title="Search vendor catalog"
                        >
                          <Search className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        SKU / Product ID
                      </label>
                      <input
                        type="text"
                        value={item.sku}
                        onChange={(e) => updateLineItem(index, 'sku', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={(e) => updateLineItem(index, 'product_name', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., Gildan Heavy Cotton T-Shirt"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Color
                      </label>
                      <input
                        type="text"
                        value={item.color}
                        onChange={(e) => updateLineItem(index, 'color', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., Navy"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Size
                      </label>
                      <input
                        type="text"
                        value={item.size}
                        onChange={(e) => updateLineItem(index, 'size', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                        placeholder="e.g., XL"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity_ordered}
                        onChange={(e) =>
                          updateLineItem(index, 'quantity_ordered', parseInt(e.target.value) || 1)
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Unit Cost *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) =>
                            updateLineItem(index, 'unit_cost', parseFloat(e.target.value) || 0)
                          }
                          className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                        placeholder="Any special instructions..."
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Extended Cost:</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      ${item.extended_cost.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Details */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Additional Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes to Vendor
                </label>
                <textarea
                  value={notesToVendor}
                  onChange={(e) => setNotesToVendor(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Any special instructions for the vendor..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Internal Notes
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Internal notes (not visible to vendor)..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          {/* Delivery Date */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Expected Delivery
            </h3>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
            />
          </div>

          {/* Cost Summary */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Cost Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${calculateSubtotal().toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tax Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Shipping Cost
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                    Total
                  </span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    ${calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
