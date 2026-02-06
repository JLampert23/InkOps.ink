import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  ArrowLeft,
  ArrowRight,
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
  CheckCircle,
  X,
} from 'lucide-react';
import { ProductSearchModal } from './ProductSearchModal';

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

type Step = 'vendor' | 'items' | 'details' | 'review';

export function CreatePurchaseOrder({ onBack, onSave }: CreatePurchaseOrderProps) {
  const [currentStep, setCurrentStep] = useState<Step>('vendor');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notesToVendor, setNotesToVendor] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [taxAmount, setTaxAmount] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

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

  const addProductsFromSearch = (products: any[]) => {
    const newItems = products.map((product, idx) => ({
      id: crypto.randomUUID(),
      line_number: lineItems.length + idx + 1,
      sku: product.sku || '',
      style_number: product.style_number || '',
      product_name: product.product_name || '',
      color: product.color || '',
      size: product.size || '',
      quantity_ordered: product.quantity_ordered || 1,
      unit_cost: product.unit_cost || 0,
      extended_cost: product.extended_cost || 0,
      vendor_product_id: product.vendor_product_id,
      notes: '',
    }));
    setLineItems([...lineItems, ...newItems]);
  };

  const removeLineItem = (index: number) => {
    const updated = lineItems.filter((_, i) => i !== index);
    updated.forEach((item, i) => {
      item.line_number = i + 1;
    });
    setLineItems(updated);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 'vendor':
        return selectedVendor !== '';
      case 'items':
        return lineItems.length > 0 && lineItems.some((item) => item.product_name);
      case 'details':
        return true;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNextStep = () => {
    if (!canProceedToNextStep()) {
      alert('Please complete the current step before proceeding');
      return;
    }

    const steps: Step[] = ['vendor', 'items', 'details', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handlePrevStep = () => {
    const steps: Step[] = ['vendor', 'items', 'details', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
    if (!selectedVendor || lineItems.length === 0) {
      alert('Please complete all required fields');
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

      // Upload attachments if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          const fileName = `${profile.company_id}/${po.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('po-attachments')
            .upload(fileName, file);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('po-attachments')
              .getPublicUrl(fileName);

            await supabase.from('purchase_order_attachments').insert([
              {
                company_id: profile.company_id,
                po_id: po.id,
                file_name: file.name,
                file_url: publicUrl,
                file_type: file.type,
                file_size: file.size,
                uploaded_by: user.id,
              },
            ]);
          }
        }
      }

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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  const selectedVendorData = vendors.find((v) => v.id === selectedVendor);

  const steps = [
    { id: 'vendor', name: 'Vendor', icon: Building2 },
    { id: 'items', name: 'Add Items', icon: Package },
    { id: 'details', name: 'Details', icon: FileText },
    { id: 'review', name: 'Review', icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

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
      </div>

      {/* Step Indicator */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg scale-110'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-4 mb-8 transition-all ${
                      index < currentStepIndex
                        ? 'bg-green-500'
                        : 'bg-gray-200 dark:bg-slate-700'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-8 min-h-[500px]">
        {/* STEP 1: Vendor Selection */}
        {currentStep === 'vendor' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <Building2 className="w-16 h-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Select Vendor
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Choose the supplier for this purchase order
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Vendor *
              </label>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white text-lg"
              >
                <option value="">Choose a vendor...</option>
                <optgroup label="Integrated Suppliers">
                  {vendors.filter((v) => v.vendor_type !== 'independent').map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendor_name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Independent Vendors">
                  {vendors.filter((v) => v.vendor_type === 'independent').map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.vendor_name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {selectedVendorData && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">
                  Vendor Information
                </h4>
                <div className="space-y-2 text-sm">
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
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Type:</span> {selectedVendorData.vendor_type}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Add Items */}
        {currentStep === 'items' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Line Items</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Search vendor catalog or add items manually
                </p>
              </div>
              <div className="flex gap-2">
                {selectedVendorData?.vendor_type !== 'independent' && (
                  <button
                    onClick={() => setShowProductSearch(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    Search Catalog
                  </button>
                )}
                <button
                  onClick={addLineItem}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Manual Item
                </button>
              </div>
            </div>

            {lineItems.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-20 h-20 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">No items added yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Search the vendor catalog or add items manually to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 space-y-3 bg-gray-50 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 px-3 py-1 rounded">
                        Line {item.line_number}
                      </span>
                      <button
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Style Number
                        </label>
                        <input
                          type="text"
                          value={item.style_number}
                          onChange={(e) => updateLineItem(index, 'style_number', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                          placeholder="e.g., 18500"
                        />
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

                      <div className="md:col-span-2 lg:col-span-1">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          value={item.product_name}
                          onChange={(e) => updateLineItem(index, 'product_name', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                          placeholder="Product name"
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

                      <div className="flex items-end">
                        <div className="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Extended Cost</div>
                          <div className="text-lg font-bold text-gray-900 dark:text-white">
                            ${item.extended_cost.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-900 dark:text-blue-300">
                      {lineItems.length} line items · {lineItems.reduce((sum, item) => sum + item.quantity_ordered, 0)} total units
                    </span>
                    <span className="text-xl font-bold text-blue-900 dark:text-blue-300">
                      Subtotal: ${calculateSubtotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Details */}
        {currentStep === 'details' && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <FileText className="w-16 h-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                PO Details
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Add delivery date, notes, and attachments
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Expected Delivery Date
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    className="w-full pl-7 pr-3 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    className="w-full pl-7 pr-3 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes to Vendor
                </label>
                <textarea
                  value={notesToVendor}
                  onChange={(e) => setNotesToVendor(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Any special instructions for the vendor..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Internal Notes
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  placeholder="Internal notes (not visible to vendor)..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Attachments
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-6 text-center hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Click to upload files or drag and drop
                    </span>
                  </label>
                </div>

                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                          {file.name}
                        </span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Review */}
        {currentStep === 'review' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Review & Submit
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Review your purchase order before submitting
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Vendor</div>
                <div className="font-semibold text-blue-900 dark:text-blue-200">
                  {selectedVendorData?.vendor_name}
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="text-sm text-green-700 dark:text-green-300 mb-1">Line Items</div>
                <div className="font-semibold text-green-900 dark:text-green-200">
                  {lineItems.length} items · {lineItems.reduce((sum, item) => sum + item.quantity_ordered, 0)} units
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">Total Cost</div>
                <div className="font-semibold text-purple-900 dark:text-purple-200 text-xl">
                  ${calculateTotal().toFixed(2)}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Line Items</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-left">Style</th>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-left">Color</th>
                      <th className="px-3 py-2 text-left">Size</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Cost</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                    {lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 text-gray-900 dark:text-white">{item.style_number}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.product_name}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.color}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.size}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{item.quantity_ordered}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">${item.unit_cost.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 dark:text-white">${item.extended_cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
              <div className="space-y-3 max-w-sm ml-auto">
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>Subtotal</span>
                  <span className="font-medium">${calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>Tax</span>
                  <span className="font-medium">${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>Shipping</span>
                  <span className="font-medium">${shippingCost.toFixed(2)}</span>
                </div>
                <div className="pt-3 border-t border-gray-300 dark:border-slate-600 flex justify-between">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Details */}
            {(expectedDeliveryDate || notesToVendor || internalNotes || attachments.length > 0) && (
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-4 space-y-4">
                {expectedDeliveryDate && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Expected Delivery
                    </div>
                    <div className="text-gray-900 dark:text-white">
                      {new Date(expectedDeliveryDate).toLocaleDateString()}
                    </div>
                  </div>
                )}

                {notesToVendor && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Notes to Vendor
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 text-sm bg-gray-50 dark:bg-slate-800 rounded p-3">
                      {notesToVendor}
                    </div>
                  </div>
                )}

                {internalNotes && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Internal Notes
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 text-sm bg-gray-50 dark:bg-slate-800 rounded p-3">
                      {internalNotes}
                    </div>
                  </div>
                )}

                {attachments.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Attachments ({attachments.length})
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 text-sm">
                      {attachments.map((file, idx) => (
                        <div key={idx}>• {file.name}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3 justify-center pt-4">
              <button
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-4 border-2 border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold disabled:opacity-50 transition-all"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save as Draft
              </button>
              <button
                onClick={() => handleSave('sent')}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 shadow-lg hover:shadow-xl transition-all"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Package className="w-5 h-5" />}
                Save & Send to Vendor
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevStep}
          disabled={currentStep === 'vendor'}
          className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Previous
        </button>

        {currentStep !== 'review' && (
          <button
            onClick={handleNextStep}
            disabled={!canProceedToNextStep()}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Product Search Modal */}
      {showProductSearch && selectedVendorData && (
        <ProductSearchModal
          vendorId={selectedVendor}
          vendorType={selectedVendorData.vendor_type}
          onSelect={addProductsFromSearch}
          onClose={() => setShowProductSearch(false)}
        />
      )}
    </div>
  );
}
