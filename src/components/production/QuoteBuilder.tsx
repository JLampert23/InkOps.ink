import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Copy, Loader2, X, FileText, DollarSign, User, Package, Palette, Receipt } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';

interface QuoteItem {
  id?: string;
  line_type?: 'item' | 'fee' | 'imprint';
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
  qty_4xl: number;
  unit_price: number;
  total_quantity: number;
  total_price: number;
  image_url?: string;
  decoration_method?: string;
  decoration_location?: string;
  artwork_url?: string;
  imprint_number?: string;
  num_colors?: number;
  notes?: string;
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
  initialCustomerId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export function QuoteBuilder({ quoteId, initialCustomerId, onSave, onCancel }: QuoteBuilderProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');

  const [quoteNumber, setQuoteNumber] = useState('');
  const [title, setTitle] = useState('');
  const [createdDate, setCreatedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [terms, setTerms] = useState('Net 30');
  const [validUntil, setValidUntil] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('PICK-UP');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

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
      line_type: 'item',
      item_number: '',
      color: '',
      description: '',
      qty_yxs: 0, qty_ys: 0, qty_ym: 0, qty_yl: 0, qty_yxl: 0,
      qty_xs: 0, qty_s: 0, qty_m: 0, qty_l: 0, qty_xl: 0, qty_2xl: 0, qty_3xl: 0, qty_4xl: 0,
      unit_price: 0,
      total_quantity: 0,
      total_price: 0,
    }]);
    setExpandedSections(prev => ({ ...prev, items: true }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field.startsWith('qty_')) {
      const totalQty = ['qty_yxs', 'qty_ys', 'qty_ym', 'qty_yl', 'qty_yxl', 'qty_xs', 'qty_s', 'qty_m', 'qty_l', 'qty_xl', 'qty_2xl', 'qty_3xl', 'qty_4xl']
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
    setExpandedSections(prev => ({ ...prev, imprints: true }));
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
    setExpandedSections(prev => ({ ...prev, fees: true }));
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
    if (!billName.trim()) {
      alert('Please enter a customer name');
      return;
    }

    setSaving(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getSession();
      if (!authUser?.user) throw new Error('No authenticated user');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', authUser.user.id)
        .single();

      if (!profile?.company_id) throw new Error('No company found');

      const quoteData = {
        quote_number: quoteNumber,
        company_id: profile.company_id,
        customer_id: selectedCustomerId || null,
        customer_name: billName,
        customer_email: billEmail || null,
        customer_phone: billPhone || null,
        customer_company: billName,
        billing_address: {
          line1: billAddress1,
          line2: billAddress2,
          city: billCity,
          state: billState,
          zip: billZip,
        },
        shipping_address: {
          name: shipName,
          contact: shipContact,
          line1: shipAddress1,
          line2: shipAddress2,
          city: shipCity,
          state: shipState,
          zip: shipZip,
        },
        subtotal: subtotal,
        tax_rate: 0,
        tax_amount: tax,
        total: total,
        status: 'draft',
        valid_until: validUntil || null,
        notes: '',
        customer_notes: customerNotes,
        po_number: poNumber || null,
        delivery_method: deliveryMethod,
        invoice_date: invoiceDate || null,
        payment_due_date: paymentDueDate || null,
        terms: terms,
        company_name: companySettings?.company_name || "Todd's Sporting Goods",
        company_address: companySettings?.company_address || '393 Cabot Street',
        company_city: companySettings?.company_city || 'Beverly',
        company_state: companySettings?.company_state || 'Massachusetts',
        company_zip: companySettings?.company_zip || '01915',
        company_phone: companySettings?.company_phone || '19789271600',
        company_email: companySettings?.company_email || 'jamie@toddssportinggoods.com',
        company_website: companySettings?.company_website || 'https://www.toddssportinggoods.com',
        company_logo_url: companySettings?.company_logo_primary_url || null,
        created_by: authUser.user.id,
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
        await supabase.from('quote_line_items').delete().eq('quote_id', savedQuoteId);

        const allLineItems = [
          ...items.map((item, idx) => ({
            quote_id: savedQuoteId,
            company_id: profile.company_id,
            line_number: idx,
            line_type: 'item',
            item_number: item.item_number,
            color: item.color,
            sku: item.item_number,
            description: item.description,
            quantity: item.total_quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            qty_yxs: item.qty_yxs || 0,
            qty_ys: item.qty_ys || 0,
            qty_ym: item.qty_ym || 0,
            qty_yl: item.qty_yl || 0,
            qty_yxl: item.qty_yxl || 0,
            qty_xs: item.qty_xs || 0,
            qty_s: item.qty_s || 0,
            qty_m: item.qty_m || 0,
            qty_l: item.qty_l || 0,
            qty_xl: item.qty_xl || 0,
            qty_2xl: item.qty_2xl || 0,
            qty_3xl: item.qty_3xl || 0,
            qty_4xl: item.qty_4xl || 0,
          })),
          ...imprints.map((imprint, idx) => ({
            quote_id: savedQuoteId,
            company_id: profile.company_id,
            line_number: items.length + idx,
            line_type: 'imprint',
            description: imprint.description,
            quantity: 1,
            unit_price: 0,
            total_price: 0,
            imprint_number: imprint.imprint_number,
            decoration_method: imprint.decoration_method,
            decoration_location: imprint.location,
            artwork_url: imprint.artwork_url,
            num_colors: imprint.num_colors,
          })),
          ...fees.map((fee, idx) => ({
            quote_id: savedQuoteId,
            company_id: profile.company_id,
            line_number: items.length + imprints.length + idx,
            line_type: 'fee',
            description: fee.fee_name,
            notes: fee.description,
            quantity: fee.quantity,
            unit_price: fee.unit_amount,
            total_price: fee.total_amount,
          })),
        ];

        if (allLineItems.length > 0) {
          await supabase.from('quote_line_items').insert(allLineItems);
        }
      }

      alert('Quote saved successfully!');
      if (onSave) onSave();
    } catch (err) {
      console.error('Error saving quote:', err);
      alert(`Failed to save quote: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
    <div className="flex h-[calc(100vh-12rem)] bg-gray-50 dark:bg-slate-900">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-blue-600" />
            <div className="flex-1">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">Quote Number</h2>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{quoteNumber || 'New Quote'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400 truncate">
                {billName || 'No customer selected'}
              </span>
            </div>
            {items.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Package className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Quote Summary
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Items:</span>
              <span className="font-medium text-gray-900 dark:text-white">${itemTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Fees:</span>
              <span className="font-medium text-gray-900 dark:text-white">${feesTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pt-3 border-t border-gray-200 dark:border-slate-700">
              <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
              <span className="font-medium text-gray-900 dark:text-white">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">Tax:</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={tax}
                onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded text-right dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div className="flex justify-between text-base font-bold pt-3 border-t-2 border-gray-300 dark:border-slate-600">
              <span className="text-gray-900 dark:text-white">Total:</span>
              <span className="text-blue-600">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-slate-700 space-y-2">
          <button
            onClick={saveQuote}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
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
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-4">

          {/* Top Section: Customer Name + Quote Details */}
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Customer Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Information</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Customer
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">-- Select a customer or enter manually --</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name} {customer.contact_name && `(${customer.contact_name})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={billName}
                    onChange={(e) => setBillName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    placeholder="Company Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={billContact}
                    onChange={(e) => setBillContact(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    placeholder="Contact Name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={billPhone}
                      onChange={(e) => setBillPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                      placeholder="Phone"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={billEmail}
                      onChange={(e) => setBillEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                      placeholder="Email"
                    />
                  </div>
                </div>
              </div>

              {/* Right: Quote Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quote Details</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quote Number
                    </label>
                    <input
                      type="text"
                      value={quoteNumber}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-900 dark:text-white"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Created Date
                    </label>
                    <input
                      type="date"
                      value={createdDate}
                      onChange={(e) => setCreatedDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Valid Until
                    </label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Terms
                    </label>
                    <input
                      type="text"
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                      placeholder="Net 30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      PO Number
                    </label>
                    <input
                      type="text"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                      placeholder="Purchase Order #"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Delivery Method
                  </label>
                  <select
                    value={deliveryMethod}
                    onChange={(e) => setDeliveryMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                  >
                    <option value="PICK-UP">PICK-UP</option>
                    <option value="DELIVERY">DELIVERY</option>
                    <option value="SHIPPING">SHIPPING</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Customer Notes
                  </label>
                  <textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    placeholder="Notes visible to customer on quote/invoice"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Customer Address Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Billing & Shipping Addresses</h3>
              </div>
              <button
                onClick={copyBillingToShipping}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <Copy className="w-4 h-4" />
                Copy Billing to Shipping
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Billing Address</h4>
                <input
                  type="text"
                  value={billAddress1}
                  onChange={(e) => setBillAddress1(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
                  placeholder="Address Line 1"
                />
                <input
                  type="text"
                  value={billAddress2}
                  onChange={(e) => setBillAddress2(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
                  placeholder="Address Line 2"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={billCity}
                    onChange={(e) => setBillCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
                    placeholder="City"
                  />
                  <input
                    type="text"
                    value={billState}
                    onChange={(e) => setBillState(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
                    placeholder="State"
                  />
                  <input
                    type="text"
                    value={billZip}
                    onChange={(e) => setBillZip(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
                    placeholder="ZIP"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm">Shipping Address</h4>
                <input
                  type="text"
                  value={shipAddress1}
                  onChange={(e) => setShipAddress1(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
                  placeholder="Address Line 1"
                />
                <input
                  type="text"
                  value={shipAddress2}
                  onChange={(e) => setShipAddress2(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
                  placeholder="Address Line 2"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={shipCity}
                    onChange={(e) => setShipCity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
                    placeholder="City"
                  />
                  <input
                    type="text"
                    value={shipState}
                    onChange={(e) => setShipState(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
                    placeholder="State"
                  />
                  <input
                    type="text"
                    value={shipZip}
                    onChange={(e) => setShipZip(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white text-sm"
                    placeholder="ZIP"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Line Items</h3>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-medium rounded-full">
                  {items.length}
                </span>
              </div>
              <button
                onClick={addItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-slate-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400 mb-3">No items added yet</p>
                <button
                  onClick={addItem}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add First Item
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={item.item_number}
                        onChange={(e) => updateItem(idx, 'item_number', e.target.value)}
                        className="w-32 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                        placeholder="Item #"
                      />
                      <input
                        type="text"
                        value={item.color}
                        onChange={(e) => updateItem(idx, 'color', e.target.value)}
                        className="w-32 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                        placeholder="Color"
                      />
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                        placeholder="Description"
                      />
                      <button
                        onClick={() => removeItem(idx)}
                        className="px-2 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-13 gap-2 mb-3">
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">YXS</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_yxs || ''}
                          onChange={(e) => updateItem(idx, 'qty_yxs', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">YS</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_ys || ''}
                          onChange={(e) => updateItem(idx, 'qty_ys', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">YM</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_ym || ''}
                          onChange={(e) => updateItem(idx, 'qty_ym', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">YL</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_yl || ''}
                          onChange={(e) => updateItem(idx, 'qty_yl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">YXL</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_yxl || ''}
                          onChange={(e) => updateItem(idx, 'qty_yxl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">XS</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_xs || ''}
                          onChange={(e) => updateItem(idx, 'qty_xs', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">S</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_s || ''}
                          onChange={(e) => updateItem(idx, 'qty_s', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">M</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_m || ''}
                          onChange={(e) => updateItem(idx, 'qty_m', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">L</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_l || ''}
                          onChange={(e) => updateItem(idx, 'qty_l', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">XL</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_xl || ''}
                          onChange={(e) => updateItem(idx, 'qty_xl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">2XL</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_2xl || ''}
                          onChange={(e) => updateItem(idx, 'qty_2xl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">3XL</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_3xl || ''}
                          onChange={(e) => updateItem(idx, 'qty_3xl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                      <div className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">4XL</label>
                        <input
                          type="number"
                          min="0"
                          value={item.qty_4xl || ''}
                          onChange={(e) => updateItem(idx, 'qty_4xl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded text-xs text-center dark:bg-slate-700 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 items-center justify-end">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Total Qty: <span className="font-medium text-gray-900 dark:text-white">{item.total_quantity}</span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">×</div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded text-sm text-right dark:bg-slate-700 dark:text-white"
                        placeholder="Price"
                      />
                      <div className="text-sm text-gray-600 dark:text-gray-400">=</div>
                      <div className="w-24 text-right font-medium text-gray-900 dark:text-white">
                        ${item.total_price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Imprints Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Imprints / Decorations</h3>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-medium rounded-full">
                  {imprints.length}
                </span>
              </div>
              <button
                onClick={addImprint}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            {imprints.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-slate-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600">
                <p className="text-gray-500 dark:text-gray-400">No imprints added yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {imprints.map((imprint, idx) => (
                  <div key={idx} className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm">Imprint {idx + 1}</h4>
                      <button
                        onClick={() => removeImprint(idx)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        value={imprint.imprint_number}
                        onChange={(e) => updateImprint(idx, 'imprint_number', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                        placeholder="Imprint Number"
                      />
                      <select
                        value={imprint.decoration_method}
                        onChange={(e) => updateImprint(idx, 'decoration_method', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
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
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                          placeholder="# Colors"
                        />
                        <input
                          type="text"
                          value={imprint.location}
                          onChange={(e) => updateImprint(idx, 'location', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                          placeholder="Location"
                        />
                      </div>
                      <textarea
                        value={imprint.description}
                        onChange={(e) => updateImprint(idx, 'description', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                        rows={2}
                        placeholder="Description"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fees Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Fees</h3>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-medium rounded-full">
                  {fees.length}
                </span>
              </div>
              <button
                onClick={addFee}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            {fees.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-slate-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600">
                <p className="text-gray-500 dark:text-gray-400">No fees added yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fees.map((fee, idx) => (
                  <div key={idx} className="flex gap-2 items-center border border-gray-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800">
                    <input
                      type="text"
                      value={fee.fee_name}
                      onChange={(e) => updateFee(idx, 'fee_name', e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                      placeholder="Fee Name"
                    />
                    <input
                      type="text"
                      value={fee.description}
                      onChange={(e) => updateFee(idx, 'description', e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                      placeholder="Description"
                    />
                    <input
                      type="number"
                      min="1"
                      value={fee.quantity}
                      onChange={(e) => updateFee(idx, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                      placeholder="Qty"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={fee.unit_amount}
                      onChange={(e) => updateFee(idx, 'unit_amount', parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded text-sm dark:bg-slate-700 dark:text-white"
                      placeholder="Amount"
                    />
                    <div className="w-24 px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded bg-gray-100 dark:bg-slate-900 text-sm text-right dark:text-white">
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
          </div>

        </div>
      </div>
    </div>
  );
}
