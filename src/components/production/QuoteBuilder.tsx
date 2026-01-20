import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Copy, Loader2, X, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';

interface QuoteItem {
  id?: string;
  item_number: string;
  color: string;
  description: string;
  qty_yxs: number;
  qty_ys: number;
  qty_ym: number;
  qty_yl: number;
  qty_yxl: number;
  qty_xs: number;
  qty_s: number;
  qty_m: number;
  qty_l: number;
  qty_xl: number;
  qty_2xl: number;
  qty_3xl: number;
  unit_price: number;
  total_quantity: number;
  total_price: number;
  image_url?: string;
}

interface QuoteImprint {
  id?: string;
  imprint_number: string;
  decoration_method: string;
  num_colors: number;
  location: string;
  description: string;
  artwork_url?: string;
  mockup_url?: string;
}

interface QuoteFee {
  id?: string;
  fee_name: string;
  description: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
}

interface QuoteBuilderProps {
  quoteId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export function QuoteBuilder({ quoteId, onSave, onCancel }: QuoteBuilderProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  const [quoteNumber, setQuoteNumber] = useState('');
  const [title, setTitle] = useState('');
  const [createdDate, setCreatedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [terms, setTerms] = useState('Net 30');
  const [validUntil, setValidUntil] = useState('');

  const [billName, setBillName] = useState('');
  const [billContact, setBillContact] = useState('');
  const [billAddress1, setBillAddress1] = useState('');
  const [billAddress2, setBillAddress2] = useState('');
  const [billCity, setBillCity] = useState('');
  const [billState, setBillState] = useState('');
  const [billZip, setBillZip] = useState('');
  const [billPhone, setBillPhone] = useState('');
  const [billEmail, setBillEmail] = useState('');

  const [shipName, setShipName] = useState('');
  const [shipContact, setShipContact] = useState('');
  const [shipAddress1, setShipAddress1] = useState('');
  const [shipAddress2, setShipAddress2] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipZip, setShipZip] = useState('');

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [imprints, setImprints] = useState<QuoteImprint[]>([]);
  const [fees, setFees] = useState<QuoteFee[]>([]);

  const [itemTotal, setItemTotal] = useState(0);
  const [feesTotal, setFeesTotal] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadCompanySettings();
    loadCustomers();
    if (quoteId) {
      loadQuote();
    } else {
      generateQuoteNumber();
    }
  }, [quoteId]);

  useEffect(() => {
    calculateTotals();
  }, [items, fees, tax]);

  const loadCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .maybeSingle();
    setCompanySettings(data);
  };

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('status', 'active')
      .order('company_name');
    if (data) setCustomers(data);
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);

    if (!customerId) {
      return;
    }

    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setBillName(customer.company_name || '');
      setBillContact(customer.contact_name || '');
      setBillAddress1(customer.billing_address_line1 || '');
      setBillAddress2(customer.billing_address_line2 || '');
      setBillCity(customer.billing_city || '');
      setBillState(customer.billing_state || '');
      setBillZip(customer.billing_zip || '');
      setBillPhone(customer.phone || '');
      setBillEmail(customer.email || '');

      setShipName(customer.company_name || '');
      setShipContact(customer.contact_name || '');
      setShipAddress1(customer.shipping_address_line1 || '');
      setShipAddress2(customer.shipping_address_line2 || '');
      setShipCity(customer.shipping_city || '');
      setShipState(customer.shipping_state || '');
      setShipZip(customer.shipping_zip || '');

      if (customer.payment_terms) {
        setTerms(customer.payment_terms);
      }
    }
  };

  const generateQuoteNumber = async () => {
    const { data } = await supabase.rpc('generate_quote_number');
    if (data) setQuoteNumber(data);
  };

  const loadQuote = async () => {
    if (!quoteId) return;

    setLoading(true);
    try {
      const { data: quote } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quote) {
        setQuoteNumber(quote.quote_number);
        setTitle(quote.title);
        setCreatedDate(quote.created_date?.split('T')[0] || '');
        setDueDate(quote.due_date?.split('T')[0] || '');
        setTerms(quote.terms);
        setValidUntil(quote.valid_until?.split('T')[0] || '');

        if (quote.customer_id) {
          setSelectedCustomerId(quote.customer_id);
        }

        setBillName(quote.customer_billing_name || '');
        setBillContact(quote.customer_billing_contact || '');
        setBillAddress1(quote.customer_billing_address_line1 || '');
        setBillAddress2(quote.customer_billing_address_line2 || '');
        setBillCity(quote.customer_billing_city || '');
        setBillState(quote.customer_billing_state || '');
        setBillZip(quote.customer_billing_zip || '');
        setBillPhone(quote.customer_billing_phone || '');
        setBillEmail(quote.customer_billing_email || '');

        setShipName(quote.customer_shipping_name || '');
        setShipContact(quote.customer_shipping_contact || '');
        setShipAddress1(quote.customer_shipping_address_line1 || '');
        setShipAddress2(quote.customer_shipping_address_line2 || '');
        setShipCity(quote.customer_shipping_city || '');
        setShipState(quote.customer_shipping_state || '');
        setShipZip(quote.customer_shipping_zip || '');

        setTax(Number(quote.tax));
      }

      const { data: itemsData } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order');
      if (itemsData) setItems(itemsData);

      const { data: imprintsData } = await supabase
        .from('quote_imprints')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order');
      if (imprintsData) setImprints(imprintsData);

      const { data: feesData } = await supabase
        .from('quote_fees')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order');
      if (feesData) setFees(feesData);
    } catch (err) {
      console.error('Error loading quote:', err);
      alert('Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const itemsSum = items.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
    const feesSum = fees.reduce((sum, fee) => sum + Number(fee.total_amount || 0), 0);
    const sub = itemsSum + feesSum;
    const tot = sub + Number(tax);

    setItemTotal(itemsSum);
    setFeesTotal(feesSum);
    setSubtotal(sub);
    setTotal(tot);
  };

  const addItem = () => {
    setItems([...items, {
      item_number: '',
      color: '',
      description: '',
      qty_yxs: 0, qty_ys: 0, qty_ym: 0, qty_yl: 0, qty_yxl: 0,
      qty_xs: 0, qty_s: 0, qty_m: 0, qty_l: 0, qty_xl: 0, qty_2xl: 0, qty_3xl: 0,
      unit_price: 0,
      total_quantity: 0,
      total_price: 0,
    }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field.startsWith('qty_')) {
      const totalQty = ['qty_yxs', 'qty_ys', 'qty_ym', 'qty_yl', 'qty_yxl', 'qty_xs', 'qty_s', 'qty_m', 'qty_l', 'qty_xl', 'qty_2xl', 'qty_3xl']
        .reduce((sum, key) => sum + Number(updated[index][key as keyof QuoteItem] || 0), 0);
      updated[index].total_quantity = totalQty;
      updated[index].total_price = totalQty * Number(updated[index].unit_price);
    }

    if (field === 'unit_price') {
      updated[index].total_price = updated[index].total_quantity * Number(value);
    }

    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addImprint = () => {
    setImprints([...imprints, {
      imprint_number: `${quoteNumber}-${imprints.length + 1}`,
      decoration_method: 'Screen Printing - Underbase/Darks',
      num_colors: 1,
      location: '',
      description: '',
    }]);
  };

  const updateImprint = (index: number, field: string, value: any) => {
    const updated = [...imprints];
    updated[index] = { ...updated[index], [field]: value };
    setImprints(updated);
  };

  const removeImprint = (index: number) => {
    setImprints(imprints.filter((_, i) => i !== index));
  };

  const addFee = () => {
    setFees([...fees, {
      fee_name: '',
      description: '',
      quantity: 1,
      unit_amount: 0,
      total_amount: 0,
    }]);
  };

  const updateFee = (index: number, field: string, value: any) => {
    const updated = [...fees];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unit_amount') {
      updated[index].total_amount = Number(updated[index].quantity) * Number(updated[index].unit_amount);
    }

    setFees(updated);
  };

  const removeFee = (index: number) => {
    setFees(fees.filter((_, i) => i !== index));
  };

  const copyBillingToShipping = () => {
    setShipName(billName);
    setShipContact(billContact);
    setShipAddress1(billAddress1);
    setShipAddress2(billAddress2);
    setShipCity(billCity);
    setShipState(billState);
    setShipZip(billZip);
  };

  const saveQuote = async () => {
    if (!title.trim()) {
      alert('Please enter a quote title');
      return;
    }

    setSaving(true);
    try {
      const quoteData = {
        quote_number: quoteNumber,
        title,
        created_date: createdDate,
        due_date: dueDate || null,
        terms,
        valid_until: validUntil || null,
        customer_id: selectedCustomerId || null,
        customer_billing_name: billName,
        customer_billing_contact: billContact,
        customer_billing_address_line1: billAddress1,
        customer_billing_address_line2: billAddress2,
        customer_billing_city: billCity,
        customer_billing_state: billState,
        customer_billing_zip: billZip,
        customer_billing_phone: billPhone,
        customer_billing_email: billEmail,
        customer_shipping_name: shipName,
        customer_shipping_contact: shipContact,
        customer_shipping_address_line1: shipAddress1,
        customer_shipping_address_line2: shipAddress2,
        customer_shipping_city: shipCity,
        customer_shipping_state: shipState,
        customer_shipping_zip: shipZip,
        item_total: itemTotal,
        fees_total: feesTotal,
        subtotal: subtotal,
        tax: tax,
        total: total,
        paid: 0,
        outstanding: total,
        status: 'draft',
        created_by: user?.id,
      };

      let savedQuoteId = quoteId;

      if (quoteId) {
        await supabase
          .from('quotes')
          .update(quoteData)
          .eq('id', quoteId);
      } else {
        const { data, error } = await supabase
          .from('quotes')
          .insert([quoteData])
          .select()
          .single();

        if (error) throw error;
        savedQuoteId = data.id;
      }

      if (savedQuoteId) {
        await supabase.from('quote_items').delete().eq('quote_id', savedQuoteId);
        if (items.length > 0) {
          await supabase.from('quote_items').insert(
            items.map((item, idx) => ({
              ...item,
              quote_id: savedQuoteId,
              sort_order: idx,
            }))
          );
        }

        await supabase.from('quote_imprints').delete().eq('quote_id', savedQuoteId);
        if (imprints.length > 0) {
          await supabase.from('quote_imprints').insert(
            imprints.map((imprint, idx) => ({
              ...imprint,
              quote_id: savedQuoteId,
              sort_order: idx,
            }))
          );
        }

        await supabase.from('quote_fees').delete().eq('quote_id', savedQuoteId);
        if (fees.length > 0) {
          await supabase.from('quote_fees').insert(
            fees.map((fee, idx) => ({
              ...fee,
              quote_id: savedQuoteId,
              sort_order: idx,
            }))
          );
        }
      }

      alert('Quote saved successfully!');
      if (onSave) onSave();
    } catch (err) {
      console.error('Error saving quote:', err);
      alert('Failed to save quote');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">
            {quoteId ? 'Edit Quote' : 'Create New Quote'}
          </h2>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={saveQuote}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Quote
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-8">
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quote Number
              </label>
              <input
                type="text"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                readOnly
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., FAITH LION TEE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Created Date
              </label>
              <input
                type="date"
                value={createdDate}
                onChange={(e) => setCreatedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Terms
              </label>
              <input
                type="text"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Net 30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valid Until
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Customer Information</h3>
            <button
              onClick={copyBillingToShipping}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              <Copy className="w-4 h-4" />
              Copy Billing to Shipping
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Existing Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a customer or enter manually --</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.company_name} {customer.contact_name && `(${customer.contact_name})`}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Billing Address</h4>
              <input
                type="text"
                value={billName}
                onChange={(e) => setBillName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Company Name"
              />
              <input
                type="text"
                value={billContact}
                onChange={(e) => setBillContact(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Contact Name"
              />
              <input
                type="text"
                value={billAddress1}
                onChange={(e) => setBillAddress1(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Address Line 1"
              />
              <input
                type="text"
                value={billAddress2}
                onChange={(e) => setBillAddress2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Address Line 2"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={billCity}
                  onChange={(e) => setBillCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="City"
                />
                <input
                  type="text"
                  value={billState}
                  onChange={(e) => setBillState(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="State"
                />
              </div>
              <input
                type="text"
                value={billZip}
                onChange={(e) => setBillZip(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="ZIP Code"
              />
              <input
                type="tel"
                value={billPhone}
                onChange={(e) => setBillPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Phone"
              />
              <input
                type="email"
                value={billEmail}
                onChange={(e) => setBillEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Email"
              />
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Shipping Address</h4>
              <input
                type="text"
                value={shipName}
                onChange={(e) => setShipName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Company Name"
              />
              <input
                type="text"
                value={shipContact}
                onChange={(e) => setShipContact(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Contact Name"
              />
              <input
                type="text"
                value={shipAddress1}
                onChange={(e) => setShipAddress1(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Address Line 1"
              />
              <input
                type="text"
                value={shipAddress2}
                onChange={(e) => setShipAddress2(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Address Line 2"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={shipCity}
                  onChange={(e) => setShipCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="City"
                />
                <input
                  type="text"
                  value={shipState}
                  onChange={(e) => setShipState(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="State"
                />
              </div>
              <input
                type="text"
                value={shipZip}
                onChange={(e) => setShipZip(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="ZIP Code"
              />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
            <button
              onClick={addItem}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No items added yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-medium text-gray-900">Item {idx + 1}</h4>
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <input
                      type="text"
                      value={item.item_number}
                      onChange={(e) => updateItem(idx, 'item_number', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Item #"
                    />
                    <input
                      type="text"
                      value={item.color}
                      onChange={(e) => updateItem(idx, 'color', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Color"
                    />
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Description"
                    />
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Sizes:</p>
                    <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                      {['yxs', 'ys', 'ym', 'yl', 'yxl', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl'].map((size) => (
                        <div key={size}>
                          <label className="block text-xs text-gray-600 mb-1 uppercase">
                            {size}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item[`qty_${size}` as keyof QuoteItem] || 0}
                            onChange={(e) => updateItem(idx, `qty_${size}`, parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Qty
                      </label>
                      <input
                        type="number"
                        value={item.total_quantity}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Price
                      </label>
                      <input
                        type="text"
                        value={`$${item.total_price.toFixed(2)}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Imprints / Decorations</h3>
            <button
              onClick={addImprint}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Imprint
            </button>
          </div>

          {imprints.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No imprints added yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {imprints.map((imprint, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium text-gray-900">Imprint {idx + 1}</h4>
                    <button
                      onClick={() => removeImprint(idx)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={imprint.imprint_number}
                      onChange={(e) => updateImprint(idx, 'imprint_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Imprint Number"
                    />
                    <select
                      value={imprint.decoration_method}
                      onChange={(e) => updateImprint(idx, 'decoration_method', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option>Screen Printing - Underbase/Darks</option>
                      <option>Screen Printing - Standard</option>
                      <option>DTG - Direct to Garment</option>
                      <option>Embroidery</option>
                      <option>Heat Transfer</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="1"
                        value={imprint.num_colors}
                        onChange={(e) => updateImprint(idx, 'num_colors', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="# Colors"
                      />
                      <input
                        type="text"
                        value={imprint.location}
                        onChange={(e) => updateImprint(idx, 'location', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Location"
                      />
                    </div>
                    <textarea
                      value={imprint.description}
                      onChange={(e) => updateImprint(idx, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      rows={2}
                      placeholder="Description"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Additional Fees</h3>
            <button
              onClick={addFee}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Fee
            </button>
          </div>

          {fees.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No fees added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fees.map((fee, idx) => (
                <div key={idx} className="flex gap-3 items-center border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <input
                    type="text"
                    value={fee.fee_name}
                    onChange={(e) => updateFee(idx, 'fee_name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Fee Name"
                  />
                  <input
                    type="text"
                    value={fee.description}
                    onChange={(e) => updateFee(idx, 'description', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Description"
                  />
                  <input
                    type="number"
                    min="1"
                    value={fee.quantity}
                    onChange={(e) => updateFee(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Qty"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fee.unit_amount}
                    onChange={(e) => updateFee(idx, 'unit_amount', parseFloat(e.target.value) || 0)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Amount"
                  />
                  <div className="w-32 px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-right">
                    ${fee.total_amount.toFixed(2)}
                  </div>
                  <button
                    onClick={() => removeFee(idx)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Totals</h3>
          <div className="space-y-3 max-w-md ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Item Total:</span>
              <span className="font-medium">${itemTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Fees Total:</span>
              <span className="font-medium">${feesTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-300 pt-2">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Tax:</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={tax}
                onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                className="w-32 px-3 py-1 border border-gray-300 rounded-lg text-right"
              />
            </div>
            <div className="flex justify-between text-lg font-bold border-t-2 border-gray-400 pt-3">
              <span>Total:</span>
              <span className="text-blue-600">${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Outstanding:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
