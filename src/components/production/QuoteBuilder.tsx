import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, GripVertical, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';
import CreateCustomerModal from '../accounting/CreateCustomerModal';

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
  qty_4xl: number;
  unit_price: number;
  total_quantity: number;
  total_price: number;
  taxed: boolean;
}

interface QuoteFee {
  id?: string;
  fee_name: string;
  description: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
  taxed: boolean;
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
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');

  const [quoteNumber, setQuoteNumber] = useState('');
  const [createdDate, setCreatedDate] = useState(new Date().toISOString().split('T')[0]);
  const [productionDueDate, setProductionDueDate] = useState('');
  const [customerDueDate, setCustomerDueDate] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [terms, setTerms] = useState('Net 30');
  const [poNumber, setPoNumber] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [nickname, setNickname] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [productionNotes, setProductionNotes] = useState('');

  const [billCompany, setBillCompany] = useState('');
  const [billName, setBillName] = useState('');
  const [billAddress1, setBillAddress1] = useState('');
  const [billAddress2, setBillAddress2] = useState('');
  const [billCity, setBillCity] = useState('');
  const [billState, setBillState] = useState('');
  const [billZip, setBillZip] = useState('');

  const [shipCompany, setShipCompany] = useState('');
  const [shipName, setShipName] = useState('');
  const [shipAddress1, setShipAddress1] = useState('');
  const [shipAddress2, setShipAddress2] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipZip, setShipZip] = useState('');

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [fees, setFees] = useState<QuoteFee[]>([]);

  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'$' | '%'>('$');
  const [salesTaxRate, setSalesTaxRate] = useState(6.25);

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);

  useEffect(() => {
    loadCustomers();
    if (quoteId) {
      loadQuote();
    } else {
      loadDefaultFees();
    }
  }, [quoteId]);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('company_name');
    setCustomers(data || []);
  };

  const loadDefaultFees = async () => {
    try {
      const { data: defaultFees, error } = await supabase
        .from('invoice_fees')
        .select('*')
        .eq('is_active', true)
        .eq('show_by_default', true)
        .eq('amount_type', 'dollar');

      if (error) throw error;

      if (defaultFees && defaultFees.length > 0) {
        const formattedFees: QuoteFee[] = defaultFees.map(fee => ({
          fee_name: fee.fee_name,
          description: fee.description,
          quantity: 1,
          unit_amount: fee.amount,
          total_amount: fee.amount,
          taxed: fee.is_taxed,
        }));
        setFees(formattedFees);
      }
    } catch (err) {
      console.error('Error loading default fees:', err);
    }
  };

  const loadQuote = async () => {
    if (!quoteId) return;
    setLoading(true);
    const { data: quote } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .maybeSingle();

    if (quote) {
      setQuoteNumber(quote.quote_number || '');
      setSelectedCustomerId(quote.customer_id || '');
      setCreatedDate(quote.created_date || '');
      setProductionDueDate(quote.production_due_date || '');
      setCustomerDueDate(quote.customer_due_date || '');
      setInvoiceDate(quote.invoice_date || '');
      setPaymentDueDate(quote.payment_due_date || '');
      setTerms(quote.terms || 'Net 30');
      setPoNumber(quote.po_number || '');
      setDeliveryMethod(quote.delivery_method || '');
      setNickname(quote.nickname || '');
      setCustomerNotes(quote.customer_notes || '');
      setProductionNotes(quote.production_notes || '');
      setBillCompany(quote.bill_company || '');
      setBillName(quote.bill_name || '');
      setBillAddress1(quote.bill_address_1 || '');
      setBillAddress2(quote.bill_address_2 || '');
      setBillCity(quote.bill_city || '');
      setBillState(quote.bill_state || '');
      setBillZip(quote.bill_zip || '');
      setShipCompany(quote.ship_company || '');
      setShipName(quote.ship_name || '');
      setShipAddress1(quote.ship_address_1 || '');
      setShipAddress2(quote.ship_address_2 || '');
      setShipCity(quote.ship_city || '');
      setShipState(quote.ship_state || '');
      setShipZip(quote.ship_zip || '');
      setDiscount(quote.discount || 0);
      setDiscountType(quote.discount_type || '$');
      setSalesTaxRate(quote.sales_tax_rate || 6.25);

      const { data: lineItems } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order');
      setItems(lineItems?.map(item => ({
        ...item,
        taxed: item.taxed || false,
      })) || []);

      const { data: quoteFees } = await supabase
        .from('quote_fees')
        .select('*')
        .eq('quote_id', quoteId);
      setFees(quoteFees?.map(fee => ({
        ...fee,
        taxed: fee.taxed || false,
      })) || []);
    }
    setLoading(false);
  };

  const addItem = () => {
    setItems([...items, {
      item_number: '',
      color: '',
      description: '',
      qty_yxs: 0,
      qty_ys: 0,
      qty_ym: 0,
      qty_yl: 0,
      qty_yxl: 0,
      qty_xs: 0,
      qty_s: 0,
      qty_m: 0,
      qty_l: 0,
      qty_xl: 0,
      qty_2xl: 0,
      qty_3xl: 0,
      qty_4xl: 0,
      unit_price: 0,
      total_quantity: 0,
      total_price: 0,
      taxed: false,
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field.startsWith('qty_') || field === 'unit_price') {
      const item = newItems[index];
      item.total_quantity =
        item.qty_yxs + item.qty_ys + item.qty_ym + item.qty_yl + item.qty_yxl +
        item.qty_xs + item.qty_s + item.qty_m + item.qty_l + item.qty_xl +
        item.qty_2xl + item.qty_3xl + item.qty_4xl;
      item.total_price = item.total_quantity * item.unit_price;
    }

    setItems(newItems);
  };

  const addFee = () => {
    setFees([...fees, {
      fee_name: '',
      description: '',
      quantity: 1,
      unit_amount: 0,
      total_amount: 0,
      taxed: false,
    }]);
  };

  const removeFee = (index: number) => {
    setFees(fees.filter((_, i) => i !== index));
  };

  const updateFee = (index: number, field: keyof QuoteFee, value: any) => {
    const newFees = [...fees];
    newFees[index] = { ...newFees[index], [field]: value };

    if (field === 'quantity' || field === 'unit_amount') {
      newFees[index].total_amount = newFees[index].quantity * newFees[index].unit_amount;
    }

    setFees(newFees);
  };

  const copyBillingToShipping = () => {
    setShipCompany(billCompany);
    setShipName(billName);
    setShipAddress1(billAddress1);
    setShipAddress2(billAddress2);
    setShipCity(billCity);
    setShipState(billState);
    setShipZip(billZip);
  };

  const handleCustomerCreated = () => {
    loadCustomers();
  };

  const calculateTotals = () => {
    const itemTotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const feeTotal = fees.reduce((sum, fee) => sum + fee.total_amount, 0);
    const subtotal = itemTotal + feeTotal;

    let discountAmount = 0;
    if (discountType === '$') {
      discountAmount = discount;
    } else {
      discountAmount = (subtotal * discount) / 100;
    }

    const afterDiscount = subtotal - discountAmount;

    const taxableAmount = items
      .filter(item => item.taxed)
      .reduce((sum, item) => sum + item.total_price, 0) +
      fees
        .filter(fee => fee.taxed)
        .reduce((sum, fee) => sum + fee.total_amount, 0);

    const salesTax = (taxableAmount * salesTaxRate) / 100;
    const totalDue = afterDiscount + salesTax;

    return {
      totalQuantity: items.reduce((sum, item) => sum + item.total_quantity, 0),
      itemTotal,
      feeTotal,
      subtotal,
      discountAmount,
      salesTax,
      totalDue,
    };
  };

  const totals = calculateTotals();

  const handleSave = async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer');
      return;
    }

    setSaving(true);
    try {
      const quoteData = {
        quote_number: quoteNumber,
        customer_id: selectedCustomerId,
        status: 'draft',
        created_date: createdDate,
        production_due_date: productionDueDate,
        customer_due_date: customerDueDate,
        invoice_date: invoiceDate,
        payment_due_date: paymentDueDate,
        terms,
        po_number: poNumber,
        delivery_method: deliveryMethod,
        nickname,
        customer_notes: customerNotes,
        production_notes: productionNotes,
        bill_company: billCompany,
        bill_name: billName,
        bill_address_1: billAddress1,
        bill_address_2: billAddress2,
        bill_city: billCity,
        bill_state: billState,
        bill_zip: billZip,
        ship_company: shipCompany,
        ship_name: shipName,
        ship_address_1: shipAddress1,
        ship_address_2: shipAddress2,
        ship_city: shipCity,
        ship_state: shipState,
        ship_zip: shipZip,
        subtotal: totals.subtotal,
        discount,
        discount_type: discountType,
        sales_tax_rate: salesTaxRate,
        sales_tax: totals.salesTax,
        total: totals.totalDue,
      };

      let savedQuoteId = quoteId;

      if (quoteId) {
        await supabase.from('quotes').update(quoteData).eq('id', quoteId);
      } else {
        const { data } = await supabase.from('quotes').insert(quoteData).select().single();
        savedQuoteId = data?.id;
      }

      if (savedQuoteId) {
        await supabase.from('quote_line_items').delete().eq('quote_id', savedQuoteId);
        if (items.length > 0) {
          await supabase.from('quote_line_items').insert(
            items.map((item, idx) => ({
              quote_id: savedQuoteId,
              sort_order: idx,
              ...item,
            }))
          );
        }

        await supabase.from('quote_fees').delete().eq('quote_id', savedQuoteId);
        if (fees.length > 0) {
          await supabase.from('quote_fees').insert(
            fees.map(fee => ({
              quote_id: savedQuoteId,
              ...fee,
            }))
          );
        }
      }

      onSave?.();
    } catch (error) {
      console.error('Error saving quote:', error);
      alert('Failed to save quote');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold">
            {quoteId ? `Quote ${quoteNumber}` : 'New Quote'}
          </h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Quote
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[1800px] mx-auto space-y-6">
          {/* Customer and Details Section */}
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Customer Information */}
            <div className="col-span-2 space-y-6">
              {/* Customer Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Customer</label>
                  <button
                    onClick={() => setShowNewCustomerModal(true)}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    New Customer
                  </button>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white"
                >
                  <option value="">Select a Customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.company_name}</option>
                  ))}
                </select>
              </div>

              {/* Billing and Shipping */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm text-gray-400 mb-3">Customer Billing</h3>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={billCompany}
                      onChange={(e) => setBillCompany(e.target.value)}
                      placeholder="Company"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      value={billName}
                      onChange={(e) => setBillName(e.target.value)}
                      placeholder="Name"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      value={billAddress1}
                      onChange={(e) => setBillAddress1(e.target.value)}
                      placeholder="Address 1"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      value={billAddress2}
                      onChange={(e) => setBillAddress2(e.target.value)}
                      placeholder="Address 2"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={billCity}
                        onChange={(e) => setBillCity(e.target.value)}
                        placeholder="City"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                      />
                      <select
                        value={billState}
                        onChange={(e) => setBillState(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                      >
                        <option value="">State</option>
                        <option value="AL">AL</option>
                        <option value="AK">AK</option>
                        {/* Add more states as needed */}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={billZip}
                      onChange={(e) => setBillZip(e.target.value)}
                      placeholder="Zip"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm text-gray-400 mb-3">Customer Shipping</h3>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={shipCompany}
                      onChange={(e) => setShipCompany(e.target.value)}
                      placeholder="Company"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      value={shipName}
                      onChange={(e) => setShipName(e.target.value)}
                      placeholder="Name"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      value={shipAddress1}
                      onChange={(e) => setShipAddress1(e.target.value)}
                      placeholder="Address 1"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      value={shipAddress2}
                      onChange={(e) => setShipAddress2(e.target.value)}
                      placeholder="Address 2"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={shipCity}
                        onChange={(e) => setShipCity(e.target.value)}
                        placeholder="City"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                      />
                      <select
                        value={shipState}
                        onChange={(e) => setShipState(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                      >
                        <option value="">State</option>
                        <option value="AL">AL</option>
                        <option value="AK">AK</option>
                        {/* Add more states as needed */}
                      </select>
                    </div>
                    <input
                      type="text"
                      value={shipZip}
                      onChange={(e) => setShipZip(e.target.value)}
                      placeholder="Zip"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Nickname and Notes */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Nickname</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Invoice nickname"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Customer Notes ?</label>
                  <textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Production Notes ?</label>
                  <textarea
                    value={productionNotes}
                    onChange={(e) => setProductionNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Right: Quote Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-end">
                <span className="px-4 py-2 border-2 border-orange-600 text-orange-600 rounded text-sm font-medium">
                  QUOTE
                </span>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Owner</label>
                <select className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm">
                  <option>Jamie</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Delivery Method</label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                >
                  <option value="">Select a Delivery Method</option>
                  <option value="PICK-UP">PICK-UP</option>
                  <option value="DELIVERY">DELIVERY</option>
                  <option value="SHIPPING">SHIPPING</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">PO Number</label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Created</label>
                <input
                  type="date"
                  value={createdDate}
                  onChange={(e) => setCreatedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Production Due Date ?</label>
                <input
                  type="date"
                  value={productionDueDate}
                  onChange={(e) => setProductionDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Customer Due Date ?</label>
                <input
                  type="date"
                  value={customerDueDate}
                  onChange={(e) => setCustomerDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Invoice Date ?</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Terms</label>
                <select
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                >
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Due on Receipt">Due on Receipt</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Payment Due Date ?</label>
                <input
                  type="date"
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-sm text-gray-400">
                    <th className="p-2 text-left border border-slate-800 w-8"></th>
                    <th className="p-2 text-left border border-slate-800">Item #</th>
                    <th className="p-2 text-left border border-slate-800">Color</th>
                    <th className="p-2 text-left border border-slate-800">Description</th>
                    <th className="p-2 text-center border border-slate-800 w-12">YXS</th>
                    <th className="p-2 text-center border border-slate-800 w-12">YS</th>
                    <th className="p-2 text-center border border-slate-800 w-12">YM</th>
                    <th className="p-2 text-center border border-slate-800 w-12">YL</th>
                    <th className="p-2 text-center border border-slate-800 w-12">YXL</th>
                    <th className="p-2 text-center border border-slate-800 w-12">XS</th>
                    <th className="p-2 text-center border border-slate-800 w-12">S</th>
                    <th className="p-2 text-center border border-slate-800 w-12">M</th>
                    <th className="p-2 text-center border border-slate-800 w-12">L</th>
                    <th className="p-2 text-center border border-slate-800 w-12">XL</th>
                    <th className="p-2 text-center border border-slate-800 w-12">2XL</th>
                    <th className="p-2 text-center border border-slate-800 w-12">3XL</th>
                    <th className="p-2 text-center border border-slate-800 w-16">Quantity</th>
                    <th className="p-2 text-center border border-slate-800 w-16">Items</th>
                    <th className="p-2 text-right border border-slate-800 w-20">Price</th>
                    <th className="p-2 text-center border border-slate-800 w-12">Taxed</th>
                    <th className="p-2 text-right border border-slate-800 w-24">Total</th>
                    <th className="p-2 border border-slate-800 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="bg-slate-900/50 hover:bg-slate-900">
                      <td className="p-1 border border-slate-800 text-center">
                        <GripVertical className="w-4 h-4 text-gray-600 mx-auto" />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="text"
                          value={item.item_number}
                          onChange={(e) => updateItem(idx, 'item_number', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-800 border-0 text-white text-xs"
                          placeholder="Item #"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="text"
                          value={item.color}
                          onChange={(e) => updateItem(idx, 'color', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-800 border-0 text-white text-xs"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-800 border-0 text-white text-xs"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_yxs || ''}
                          onChange={(e) => updateItem(idx, 'qty_yxs', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_ys || ''}
                          onChange={(e) => updateItem(idx, 'qty_ys', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_ym || ''}
                          onChange={(e) => updateItem(idx, 'qty_ym', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_yl || ''}
                          onChange={(e) => updateItem(idx, 'qty_yl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_yxl || ''}
                          onChange={(e) => updateItem(idx, 'qty_yxl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_xs || ''}
                          onChange={(e) => updateItem(idx, 'qty_xs', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_s || ''}
                          onChange={(e) => updateItem(idx, 'qty_s', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_m || ''}
                          onChange={(e) => updateItem(idx, 'qty_m', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_l || ''}
                          onChange={(e) => updateItem(idx, 'qty_l', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_xl || ''}
                          onChange={(e) => updateItem(idx, 'qty_xl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_2xl || ''}
                          onChange={(e) => updateItem(idx, 'qty_2xl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_3xl || ''}
                          onChange={(e) => updateItem(idx, 'qty_3xl', parseInt(e.target.value) || 0)}
                          className="w-full px-1 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-2 border border-slate-800 text-center text-sm text-gray-400">
                        {item.total_quantity}
                      </td>
                      <td className="p-2 border border-slate-800 text-center text-sm text-gray-400">
                        {item.total_quantity}
                      </td>
                      <td className="p-1 border border-slate-800">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-slate-800 border-0 text-white text-xs text-right"
                        />
                      </td>
                      <td className="p-1 border border-slate-800 text-center">
                        <input
                          type="checkbox"
                          checked={item.taxed}
                          onChange={(e) => updateItem(idx, 'taxed', e.target.checked)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="p-2 border border-slate-800 text-right text-sm">
                        ${item.total_price.toFixed(2)}
                      </td>
                      <td className="p-1 border border-slate-800 text-center">
                        <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button
                onClick={addItem}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Line Item
              </button>
            </div>
          </div>

          {/* Fees Table */}
          <div className="max-w-4xl space-y-2">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900 text-sm text-gray-400">
                  <th className="p-2 text-left border border-slate-800">Fee</th>
                  <th className="p-2 text-left border border-slate-800">Description</th>
                  <th className="p-2 text-center border border-slate-800 w-20">Qty</th>
                  <th className="p-2 text-right border border-slate-800 w-24">Amount</th>
                  <th className="p-2 text-center border border-slate-800 w-16">Taxed</th>
                  <th className="p-2 text-right border border-slate-800 w-24">Total</th>
                  <th className="p-2 border border-slate-800 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee, idx) => (
                  <tr key={idx} className="bg-slate-900/50">
                    <td className="p-1 border border-slate-800">
                      <input
                        type="text"
                        value={fee.fee_name}
                        onChange={(e) => updateFee(idx, 'fee_name', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-800 border-0 text-white text-xs"
                      />
                    </td>
                    <td className="p-1 border border-slate-800">
                      <input
                        type="text"
                        value={fee.description}
                        onChange={(e) => updateFee(idx, 'description', e.target.value)}
                        className="w-full px-2 py-1 bg-slate-800 border-0 text-white text-xs"
                      />
                    </td>
                    <td className="p-1 border border-slate-800">
                      <input
                        type="number"
                        min="1"
                        value={fee.quantity}
                        onChange={(e) => updateFee(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 bg-slate-800 border-0 text-white text-xs text-center"
                      />
                    </td>
                    <td className="p-1 border border-slate-800">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fee.unit_amount}
                        onChange={(e) => updateFee(idx, 'unit_amount', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-slate-800 border-0 text-white text-xs text-right"
                      />
                    </td>
                    <td className="p-1 border border-slate-800 text-center">
                      <input
                        type="checkbox"
                        checked={fee.taxed}
                        onChange={(e) => updateFee(idx, 'taxed', e.target.checked)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="p-2 border border-slate-800 text-right text-sm">
                      ${fee.total_amount.toFixed(2)}
                    </td>
                    <td className="p-1 border border-slate-800 text-center">
                      <button onClick={() => removeFee(idx)} className="text-red-500 hover:text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={addFee}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Fee
            </button>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end">
            <div className="w-96 space-y-2 bg-slate-900 p-4 rounded">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Total Quantity</span>
                <span className="text-white">{totals.totalQuantity}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Item Total</span>
                <span className="text-white">{totals.itemTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Fees Total</span>
                <span className="text-white">{totals.feeTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-slate-700 pt-2">
                <span className="text-gray-400">Sub Total</span>
                <span className="text-white">{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Discount</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 text-white text-xs text-right"
                  />
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as '$' | '%')}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 text-white text-xs"
                  >
                    <option value="$">$</option>
                    <option value="%">%</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Sales Tax</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salesTaxRate}
                    onChange={(e) => setSalesTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 text-white text-xs text-right"
                  />
                  <span className="text-gray-400">%</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-base font-semibold border-t border-slate-700 pt-2">
                <span className="text-white">Total Due</span>
                <span className="text-white">{totals.totalDue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      <CreateCustomerModal
        isOpen={showNewCustomerModal}
        onClose={() => setShowNewCustomerModal(false)}
        onSuccess={handleCustomerCreated}
      />
    </div>
  );
}
