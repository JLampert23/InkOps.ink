import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, GripVertical, X, Loader2, DollarSign, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import CreateCustomerModal from '../accounting/CreateCustomerModal';
import { ManageImprintsModal } from './ManageImprintsModal';

interface QuoteItem {
  id?: string;
  item_number: string;
  color: string;
  description: string;
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
  taxed: boolean;
  custom_option?: string;
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

interface LineItemGroup {
  id: string;
  label: string;
  items: QuoteItem[];
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
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [availableFees, setAvailableFees] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);

  const [quoteNumber, setQuoteNumber] = useState('');
  const [createdDate, setCreatedDate] = useState(new Date().toISOString().split('T')[0]);
  const [productionDueDate, setProductionDueDate] = useState('');
  const [customerDueDate, setCustomerDueDate] = useState('');
  const [terms, setTerms] = useState('Net 30');
  const [poNumber, setPoNumber] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [nickname, setNickname] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [productionNotes, setProductionNotes] = useState('');
  const [customSizeOption, setCustomSizeOption] = useState('');
  const [selectedCustomSizeOptions, setSelectedCustomSizeOptions] = useState<string[]>([]);
  const [showCustomSizeModal, setShowCustomSizeModal] = useState(false);

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

  const [itemGroups, setItemGroups] = useState<LineItemGroup[]>([
    { id: crypto.randomUUID(), label: '', items: [], taxed: false }
  ]);
  const [fees, setFees] = useState<QuoteFee[]>([]);

  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'$' | '%'>('$');
  const [salesTaxRate, setSalesTaxRate] = useState(6.25);

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showImprintsModal, setShowImprintsModal] = useState(false);

  useEffect(() => {
    loadCompanySettings();
    loadCustomers();
    loadAvailableFees();
    if (quoteId) {
      loadQuote();
    } else {
      loadDefaultFees();
    }
  }, [quoteId]);

  useEffect(() => {
    if (selectedCustomerId && !quoteId) {
      loadCustomerDetails(selectedCustomerId);
    }
  }, [selectedCustomerId, quoteId]);

  const loadCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      setCompanySettings(data);
    } catch (err) {
      console.error('Error loading company settings:', err);
    }
  };

  const generateNextQuoteNumber = async (userCompanyId: string): Promise<string> => {
    try {
      // Get company settings for unified numbering
      const { data: settings } = await supabase
        .from('company_settings')
        .select('use_number_prefix, number_start_number, next_number')
        .eq('id', userCompanyId)
        .maybeSingle();

      // Get the current next_number or use start number
      let nextNumber = settings?.next_number || settings?.number_start_number || 1;

      // Update next_number in database
      await supabase
        .from('company_settings')
        .update({ next_number: nextNumber + 1 })
        .eq('id', userCompanyId);

      // Format with QTE- prefix if enabled
      const formattedNumber = nextNumber.toString().padStart(4, '0');
      const prefix = settings?.use_number_prefix ? 'QTE-' : '';

      return `${prefix}${formattedNumber}`;
    } catch (err) {
      console.error('Error generating quote number:', err);
      return `Q${Date.now()}`; // Fallback
    }
  };

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('company_name');
    setCustomers(data || []);
  };

  const loadCustomerDetails = async (customerId: string) => {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();

      if (error) throw error;

      if (customer) {
        setBillCompany(customer.company_name || '');
        setBillName(customer.contact_name || '');
        setBillAddress1(customer.billing_address_line1 || '');
        setBillAddress2(customer.billing_address_line2 || '');
        setBillCity(customer.billing_city || '');
        setBillState(customer.billing_state || '');
        setBillZip(customer.billing_zip || '');

        setShipCompany(customer.company_name || '');
        setShipName(customer.contact_name || '');
        setShipAddress1(customer.shipping_address_line1 || '');
        setShipAddress2(customer.shipping_address_line2 || '');
        setShipCity(customer.shipping_city || '');
        setShipState(customer.shipping_state || '');
        setShipZip(customer.shipping_zip || '');
      }
    } catch (err) {
      console.error('Error loading customer details:', err);
    }
  };

  const loadAvailableFees = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_fees')
        .select('*')
        .eq('is_active', true)
        .order('fee_name');

      if (error) throw error;
      setAvailableFees(data || []);
    } catch (err) {
      console.error('Error loading available fees:', err);
    }
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
      setTerms(quote.terms || 'Net 30');
      setPoNumber(quote.po_number || '');
      setDeliveryMethod(quote.delivery_method || '');
      setNickname(quote.nickname || '');
      setCustomerNotes(quote.customer_notes || '');
      setProductionNotes(quote.production_notes || '');
      setCustomSizeOption(quote.custom_size_option || '');
      // Parse selected custom size options (stored as comma-separated)
      if (quote.custom_size_option) {
        setSelectedCustomSizeOptions(quote.custom_size_option.split(',').filter((s: string) => s.trim()));
      }
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

      // Group items by group_label
      if (lineItems && lineItems.length > 0) {
        const groupMap = new Map<string, QuoteItem[]>();

        lineItems.forEach(item => {
          const groupLabel = item.group_label || '';
          if (!groupMap.has(groupLabel)) {
            groupMap.set(groupLabel, []);
          }
          groupMap.get(groupLabel)!.push({
            ...item,
            taxed: item.taxed || false,
          });
        });

        const groups: LineItemGroup[] = Array.from(groupMap.entries()).map(([label, items]) => ({
          id: crypto.randomUUID(),
          label,
          items,
          taxed: items.length > 0 && items.every(item => item.taxed),
        }));

        setItemGroups(groups);
      } else {
        setItemGroups([{ id: crypto.randomUUID(), label: '', items: [], taxed: false }]);
      }

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

  const addItem = (groupId: string) => {
    const newGroups = itemGroups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          items: [...group.items, {
            item_number: '',
            color: '',
            description: '',
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
            unit_price: 0,
            total_quantity: 0,
            total_price: 0,
            taxed: false,
          }]
        };
      }
      return group;
    });
    setItemGroups(newGroups);
  };

  const removeItem = (groupId: string, itemIndex: number) => {
    const newGroups = itemGroups.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          items: group.items.filter((_, i) => i !== itemIndex)
        };
      }
      return group;
    });
    setItemGroups(newGroups);
  };

  const updateItem = (groupId: string, itemIndex: number, field: keyof QuoteItem, value: any) => {
    const newGroups = itemGroups.map(group => {
      if (group.id === groupId) {
        const newItems = [...group.items];
        newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };

        if (field.startsWith('qty_') || field === 'unit_price') {
          const item = newItems[itemIndex];
          item.total_quantity =
            item.qty_ys + item.qty_ym + item.qty_yl + item.qty_yxl +
            item.qty_xs + item.qty_s + item.qty_m + item.qty_l + item.qty_xl +
            item.qty_2xl + item.qty_3xl;
          item.total_price = item.total_quantity * item.unit_price;
        }

        return { ...group, items: newItems };
      }
      return group;
    });
    setItemGroups(newGroups);
  };

  const addItemGroup = () => {
    setItemGroups([...itemGroups, {
      id: crypto.randomUUID(),
      label: '',
      items: [],
      taxed: false
    }]);
  };

  const removeItemGroup = (groupId: string) => {
    setItemGroups(itemGroups.filter(group => group.id !== groupId));
  };

  const updateGroupLabel = (groupId: string, label: string) => {
    setItemGroups(itemGroups.map(group =>
      group.id === groupId ? { ...group, label } : group
    ));
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

  const addFeeFromTemplate = (feeTemplate: any) => {
    setFees([...fees, {
      fee_name: feeTemplate.fee_name,
      description: feeTemplate.description,
      quantity: 1,
      unit_amount: feeTemplate.amount,
      total_amount: feeTemplate.amount,
      taxed: feeTemplate.is_taxed,
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
    const allItems = itemGroups.flatMap(group => group.items);
    const itemTotal = allItems.reduce((sum, item) => sum + item.total_price, 0);
    const feeTotal = fees.reduce((sum, fee) => sum + fee.total_amount, 0);
    const subtotal = itemTotal + feeTotal;

    let discountAmount = 0;
    if (discountType === '$') {
      discountAmount = discount;
    } else {
      discountAmount = (subtotal * discount) / 100;
    }

    const afterDiscount = subtotal - discountAmount;

    const taxableAmount = allItems
      .filter(item => item.taxed)
      .reduce((sum, item) => sum + item.total_price, 0) +
      fees
        .filter(fee => fee.taxed)
        .reduce((sum, fee) => sum + fee.total_amount, 0);

    const salesTax = (taxableAmount * salesTaxRate) / 100;
    const totalDue = afterDiscount + salesTax;

    return {
      totalQuantity: allItems.reduce((sum, item) => sum + item.total_quantity, 0),
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
      showNotification('error', 'Validation Error', 'Please select a customer');
      return;
    }

    if (!user) {
      showNotification('error', 'Authentication Error', 'You must be logged in to save a quote');
      return;
    }

    setSaving(true);
    try {
      // Get user's company_id
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userProfile?.company_id) {
        showNotification('error', 'Configuration Error', 'User company not found');
        setSaving(false);
        return;
      }

      // Get customer details for customer_name
      const { data: customer } = await supabase
        .from('customers')
        .select('company_name, email, phone')
        .eq('id', selectedCustomerId)
        .maybeSingle();

      // Generate quote number if not provided
      let finalQuoteNumber = quoteNumber;
      if (!finalQuoteNumber && !quoteId) {
        finalQuoteNumber = await generateNextQuoteNumber(userProfile.company_id);
      }

      const quoteData = {
        quote_number: finalQuoteNumber || `Q${Date.now()}`, // Fallback to timestamp if generation fails
        company_id: userProfile.company_id,
        customer_id: selectedCustomerId,
        customer_name: customer?.company_name || 'Unknown Customer',
        customer_email: customer?.email,
        customer_phone: customer?.phone,
        status: 'draft',
        created_date: createdDate,
        production_due_date: productionDueDate || null,
        customer_due_date: customerDueDate || null,
        terms,
        po_number: poNumber || null,
        delivery_method: deliveryMethod || null,
        nickname: nickname || null,
        customer_notes: customerNotes || null,
        production_notes: productionNotes || null,
        custom_size_option: selectedCustomSizeOptions.length > 0 ? selectedCustomSizeOptions.join(',') : null,
        bill_company: billCompany || null,
        bill_name: billName || null,
        bill_address_1: billAddress1 || null,
        bill_address_2: billAddress2 || null,
        bill_city: billCity || null,
        bill_state: billState || null,
        bill_zip: billZip || null,
        ship_company: shipCompany || null,
        ship_name: shipName || null,
        ship_address_1: shipAddress1 || null,
        ship_address_2: shipAddress2 || null,
        ship_city: shipCity || null,
        ship_state: shipState || null,
        ship_zip: shipZip || null,
        subtotal: totals.subtotal,
        discount,
        discount_type: discountType,
        sales_tax_rate: salesTaxRate,
        sales_tax: totals.salesTax,
        total: totals.totalDue,
        created_by: user.id,
      };

      let savedQuoteId = quoteId;

      if (quoteId) {
        const { error: updateError } = await supabase
          .from('quotes')
          .update(quoteData)
          .eq('id', quoteId);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('quotes')
          .insert(quoteData)
          .select()
          .single();

        if (insertError) throw insertError;
        savedQuoteId = data?.id;
      }

      if (savedQuoteId) {
        // Delete existing line items
        await supabase.from('quote_line_items').delete().eq('quote_id', savedQuoteId);

        // Insert new line items with group labels
        const allItems = itemGroups.flatMap((group, groupIdx) =>
          group.items.map((item, itemIdx) => ({
            quote_id: savedQuoteId,
            company_id: userProfile.company_id,
            sort_order: groupIdx * 1000 + itemIdx, // Group items together with spacing
            group_label: group.label || '',
            item_number: item.item_number,
            color: item.color,
            description: item.description,
            qty_ys: item.qty_ys,
            qty_ym: item.qty_ym,
            qty_yl: item.qty_yl,
            qty_yxl: item.qty_yxl,
            qty_xs: item.qty_xs,
            qty_s: item.qty_s,
            qty_m: item.qty_m,
            qty_l: item.qty_l,
            qty_xl: item.qty_xl,
            qty_2xl: item.qty_2xl,
            qty_3xl: item.qty_3xl,
            unit_price: item.unit_price,
            total_quantity: item.total_quantity,
            total_price: item.total_price,
            taxed: item.taxed,
          }))
        );

        if (allItems.length > 0) {
          const { error: itemsError } = await supabase.from('quote_line_items').insert(allItems);
          if (itemsError) throw itemsError;
        }

        // Delete existing fees
        await supabase.from('quote_fees').delete().eq('quote_id', savedQuoteId);

        // Insert new fees
        if (fees.length > 0) {
          const { error: feesError } = await supabase.from('quote_fees').insert(
            fees.map(fee => ({
              quote_id: savedQuoteId,
              fee_name: fee.fee_name,
              description: fee.description,
              quantity: fee.quantity,
              unit_amount: fee.unit_amount,
              total_amount: fee.total_amount,
              taxed: fee.taxed,
            }))
          );

          if (feesError) throw feesError;
        }
      }

      showNotification('success', 'Quote Saved', 'Quote has been saved successfully');
      onSave?.();
    } catch (error: any) {
      console.error('Error saving quote:', error);
      showNotification('error', 'Save Failed', error.message || 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {quoteId ? `Quote ${quoteNumber}` : 'New Quote'}
          </h2>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Quote
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-slate-950">
        <div className="max-w-[1800px] mx-auto space-y-6">
          {/* Customer and Details Section */}
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Customer Information */}
            <div className="col-span-2 space-y-6 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-6">
              {/* Customer Selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-700 dark:text-gray-300 font-medium">Customer</label>
                  <button
                    onClick={() => setShowNewCustomerModal(true)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    New Customer
                  </button>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white"
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
                  <h3 className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-semibold">Customer Billing</h3>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={billCompany}
                      onChange={(e) => setBillCompany(e.target.value)}
                      placeholder="Company"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="text"
                      value={billName}
                      onChange={(e) => setBillName(e.target.value)}
                      placeholder="Name"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="text"
                      value={billAddress1}
                      onChange={(e) => setBillAddress1(e.target.value)}
                      placeholder="Address 1"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="text"
                      value={billAddress2}
                      onChange={(e) => setBillAddress2(e.target.value)}
                      placeholder="Address 2"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={billCity}
                        onChange={(e) => setBillCity(e.target.value)}
                        placeholder="City"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                      />
                      <select
                        value={billState}
                        onChange={(e) => setBillState(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-semibold">Customer Shipping</h3>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={shipCompany}
                      onChange={(e) => setShipCompany(e.target.value)}
                      placeholder="Company"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="text"
                      value={shipName}
                      onChange={(e) => setShipName(e.target.value)}
                      placeholder="Name"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="text"
                      value={shipAddress1}
                      onChange={(e) => setShipAddress1(e.target.value)}
                      placeholder="Address 1"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="text"
                      value={shipAddress2}
                      onChange={(e) => setShipAddress2(e.target.value)}
                      placeholder="Address 2"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={shipCity}
                        onChange={(e) => setShipCity(e.target.value)}
                        placeholder="City"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                      />
                      <select
                        value={shipState}
                        onChange={(e) => setShipState(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Nickname and Notes */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">Nickname</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Invoice nickname"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">Customer Notes ?</label>
                  <textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">Production Notes ?</label>
                  <textarea
                    value={productionNotes}
                    onChange={(e) => setProductionNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Right: Quote Details */}
            <div className="space-y-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-end">
                <span className="px-4 py-2 border-2 border-orange-600 text-orange-600 dark:border-orange-500 dark:text-orange-500 rounded text-sm font-medium">
                  QUOTE
                </span>
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">Quote Number</label>
                <input
                  type="text"
                  value={quoteNumber}
                  onChange={(e) => setQuoteNumber(e.target.value)}
                  placeholder="Auto-generated if left empty"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">Owner</label>
                <select className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm">
                  <option>Jamie</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">Delivery Method</label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                >
                  <option value="">Select a Delivery Method</option>
                  <option value="PICK-UP">PICK-UP</option>
                  <option value="DELIVERY">DELIVERY</option>
                  <option value="SHIPPING">SHIPPING</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">PO Number</label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">Created</label>
                <input
                  type="date"
                  value={createdDate}
                  onChange={(e) => setCreatedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">Production Due Date ?</label>
                <input
                  type="date"
                  value={productionDueDate}
                  onChange={(e) => setProductionDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">Customer Due Date ?</label>
                <input
                  type="date"
                  value={customerDueDate}
                  onChange={(e) => setCustomerDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-2 block font-medium">Terms</label>
                <select
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                >
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Due on Receipt">Due on Receipt</option>
                </select>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                {/* Only show main thead when there are no group labels */}
                {!itemGroups.some(g => g.label) && (
                  <thead>
                    <tr className="bg-gray-100 dark:bg-slate-900 text-xs text-gray-700 dark:text-gray-400">
                      <th className="p-1 text-left border border-gray-300 dark:border-slate-800 w-6"></th>
                      <th className="p-1 text-left border border-gray-300 dark:border-slate-800 w-20">Item #</th>
                      <th className="p-1 text-left border border-gray-300 dark:border-slate-800 w-20">Color</th>
                      <th className="p-1 text-left border border-gray-300 dark:border-slate-800">Description</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">YS</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">YM</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">YL</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">YXL</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">XS</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">S</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">M</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">L</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">XL</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">2XL</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">3XL</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-14">Quantity</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-14">Items</th>
                      <th className="p-1 text-right border border-gray-300 dark:border-slate-800 w-16">Price</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">Taxed</th>
                      <th className="p-1 text-right border border-gray-300 dark:border-slate-800 w-20">Total</th>
                      <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-20">Actions</th>
                    </tr>
                  </thead>
                )}
                <tbody>
                  {itemGroups.map((group, groupIdx) => (
                    <>
                      {/* Spacer Row Between Groups */}
                      {groupIdx > 0 && (
                        <tr key={`spacer-${group.id}`} className="bg-transparent">
                          <td colSpan={21} className="p-4 border-0"></td>
                        </tr>
                      )}
                      {/* Group Header Row with Label - All Groups */}
                      {(itemGroups.length > 1 || group.label) && (
                        <tr key={`header-${group.id}`} className="bg-gray-200 dark:bg-slate-800">
                          <td colSpan={21} className="p-2 border border-gray-300 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={group.label}
                                onChange={(e) => updateGroupLabel(group.id, e.target.value)}
                                placeholder="Group Label (optional)"
                                className="px-3 py-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-sm text-gray-900 dark:text-white flex-1"
                              />
                              {itemGroups.length > 1 && (
                                <button
                                  onClick={() => removeItemGroup(group.id)}
                                  className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-slate-700 rounded whitespace-nowrap"
                                  title="Remove Group"
                                >
                                  Remove Group
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Group Column Headers - All Groups with Labels */}
                      {(itemGroups.length > 1 || group.label) && (
                        <tr key={`columns-${group.id}`} className="bg-gray-100 dark:bg-slate-900 text-xs text-gray-700 dark:text-gray-400">
                          <th className="p-1 text-left border border-gray-300 dark:border-slate-800 w-6"></th>
                          <th className="p-1 text-left border border-gray-300 dark:border-slate-800 w-20">Item #</th>
                          <th className="p-1 text-left border border-gray-300 dark:border-slate-800 w-20">Color</th>
                          <th className="p-1 text-left border border-gray-300 dark:border-slate-800">Description</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">YS</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">YM</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">YL</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">YXL</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">XS</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">S</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">M</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">L</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">XL</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">2XL</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">3XL</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-14">Quantity</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-14">Items</th>
                          <th className="p-1 text-right border border-gray-300 dark:border-slate-800 w-16">Price</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-10">Taxed</th>
                          <th className="p-1 text-right border border-gray-300 dark:border-slate-800 w-20">Total</th>
                          <th className="p-1 text-center border border-gray-300 dark:border-slate-800 w-20">Actions</th>
                        </tr>
                      )}
                      {/* Group Items */}
                      {group.items.map((item, itemIdx) => (
                        <tr key={`${group.id}-${itemIdx}`} className="bg-white dark:bg-slate-900/50 hover:bg-gray-50 dark:hover:bg-slate-900">
                          <td className="p-0.5 border border-gray-300 dark:border-slate-800 text-center">
                            <GripVertical className="w-3 h-3 text-gray-600 mx-auto" />
                          </td>
                          <td className="p-0 border border-gray-300 dark:border-slate-800">
                            <input
                              type="text"
                              value={item.item_number}
                              onChange={(e) => updateItem(group.id, itemIdx, 'item_number', e.target.value)}
                              className="w-full px-1 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs"
                              placeholder="Item #"
                            />
                          </td>
                          <td className="p-0 border border-gray-300 dark:border-slate-800">
                            <input
                              type="text"
                              value={item.color}
                              onChange={(e) => updateItem(group.id, itemIdx, 'color', e.target.value)}
                              className="w-full px-1 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs"
                            />
                          </td>
                          <td className="p-0 border border-gray-300 dark:border-slate-800">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(group.id, itemIdx, 'description', e.target.value)}
                              className="w-full px-1 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs"
                            />
                          </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_ys || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_ys', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_ym || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_ym', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_yl || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_yl', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_yxl || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_yxl', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_xs || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_xs', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_s || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_s', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_m || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_m', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_l || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_l', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_xl || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_xl', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_2xl || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_2xl', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          min="0"
                          value={item.qty_3xl || ''}
                          onChange={(e) => updateItem(group.id, itemIdx, 'qty_3xl', parseInt(e.target.value) || 0)}
                          className="w-full px-0.5 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                        />
                      </td>
                      <td className="p-0.5 border border-gray-300 dark:border-slate-800 text-center text-xs text-gray-400">
                        {item.total_quantity}
                      </td>
                      <td className="p-0.5 border border-gray-300 dark:border-slate-800 text-center text-xs text-gray-400">
                        {item.total_quantity}
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateItem(group.id, itemIdx, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-full px-1 py-0.5 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-right"
                        />
                      </td>
                      <td className="p-0.5 border border-gray-300 dark:border-slate-800 text-center">
                        <input
                          type="checkbox"
                          checked={item.taxed}
                          onChange={(e) => updateItem(group.id, itemIdx, 'taxed', e.target.checked)}
                          className="w-3 h-3"
                        />
                      </td>
                      <td className="p-0.5 border border-gray-300 dark:border-slate-800 text-right text-xs">
                        ${item.total_price.toFixed(2)}
                      </td>
                      <td className="p-0.5 border border-gray-300 dark:border-slate-800">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => {
                              showNotification('info', 'Coming Soon', 'Refresh pricing from matrix will be available soon');
                            }}
                            className="p-0.5 text-green-600 dark:text-green-500 hover:text-green-700 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-slate-800 rounded"
                            title="Refresh Pricing from Matrix"
                          >
                            <DollarSign className="w-3 h-3" />
                          </button>
                              <button
                                onClick={() => removeItem(group.id, itemIdx)}
                                className="p-0.5 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 rounded"
                                title="Remove Item"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {/* Group Actions Row */}
                      <tr key={`actions-${group.id}`}>
                        <td colSpan={21} className="p-2 border-t-2 border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                          <div className="flex gap-2 justify-between items-center">
                            <div className="flex gap-2">
                              <button
                                onClick={() => addItem(group.id)}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-2 shadow-sm"
                              >
                                <Plus className="w-4 h-4" />
                                Line Item
                              </button>
                              <button
                                onClick={() => setShowImprintsModal(true)}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-2 shadow-sm"
                              >
                                <Plus className="w-4 h-4" />
                                Imprint(s)
                              </button>
                              {itemGroups[itemGroups.length - 1].id === group.id && (
                                <button
                                  onClick={addItemGroup}
                                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded text-sm flex items-center gap-2 shadow-sm"
                                >
                                  <Plus className="w-4 h-4" />
                                  Line Item Group
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => setShowCustomSizeModal(true)}
                              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded text-sm flex items-center gap-2 shadow-sm"
                            >
                              <Settings className="w-4 h-4" />
                              Line Item Options
                            </button>
                          </div>
                        </td>
                      </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fees Table */}
          <div className="max-w-4xl space-y-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-slate-900 text-sm text-gray-700 dark:text-gray-400">
                  <th className="p-2 text-left border border-gray-300 dark:border-slate-800">Fee</th>
                  <th className="p-2 text-left border border-gray-300 dark:border-slate-800">Description</th>
                  <th className="p-2 text-center border border-gray-300 dark:border-slate-800 w-20">Qty</th>
                  <th className="p-2 text-right border border-gray-300 dark:border-slate-800 w-24">Amount</th>
                  <th className="p-2 text-center border border-gray-300 dark:border-slate-800 w-16">Taxed</th>
                  <th className="p-2 text-right border border-gray-300 dark:border-slate-800 w-24">Total</th>
                  <th className="p-2 border border-gray-300 dark:border-slate-800 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee, idx) => (
                  <tr key={idx} className="bg-white dark:bg-slate-900/50 hover:bg-gray-50 dark:hover:bg-slate-900">
                    <td className="p-1 border border-gray-300 dark:border-slate-800">
                      <input
                        type="text"
                        value={fee.fee_name}
                        onChange={(e) => updateFee(idx, 'fee_name', e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs"
                      />
                    </td>
                    <td className="p-1 border border-gray-300 dark:border-slate-800">
                      <input
                        type="text"
                        value={fee.description}
                        onChange={(e) => updateFee(idx, 'description', e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs"
                      />
                    </td>
                    <td className="p-1 border border-gray-300 dark:border-slate-800">
                      <input
                        type="number"
                        min="1"
                        value={fee.quantity}
                        onChange={(e) => updateFee(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-center"
                      />
                    </td>
                    <td className="p-1 border border-gray-300 dark:border-slate-800">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={fee.unit_amount}
                        onChange={(e) => updateFee(idx, 'unit_amount', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-xs text-right"
                      />
                    </td>
                    <td className="p-1 border border-gray-300 dark:border-slate-800 text-center">
                      <input
                        type="checkbox"
                        checked={fee.taxed}
                        onChange={(e) => updateFee(idx, 'taxed', e.target.checked)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="p-2 border border-gray-300 dark:border-slate-800 text-right text-sm">
                      ${fee.total_amount.toFixed(2)}
                    </td>
                    <td className="p-1 border border-gray-300 dark:border-slate-800 text-center">
                      <button onClick={() => removeFee(idx)} className="text-red-500 hover:text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    const fee = availableFees.find(f => f.id === e.target.value);
                    if (fee) {
                      addFeeFromTemplate(fee);
                      e.target.value = '';
                    }
                  }
                }}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded text-sm"
              >
                <option value="">Select a fee to add...</option>
                {availableFees.map(fee => (
                  <option key={fee.id} value={fee.id}>
                    {fee.fee_name} - ${Number(fee.amount).toFixed(2)}
                  </option>
                ))}
              </select>
              <button
                onClick={addFee}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Custom Fee
              </button>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end">
            <div className="w-96 space-y-2 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total Quantity</span>
                <span className="text-gray-900 dark:text-white">{totals.totalQuantity}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Item Total</span>
                <span className="text-gray-900 dark:text-white">{totals.itemTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Fees Total</span>
                <span className="text-gray-900 dark:text-white">{totals.feeTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-gray-300 dark:border-slate-700 pt-2">
                <span className="text-gray-600 dark:text-gray-400">Sub Total</span>
                <span className="text-gray-900 dark:text-white">{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Discount</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white text-xs text-right"
                  />
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as '$' | '%')}
                    className="px-2 py-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white text-xs"
                  >
                    <option value="$">$</option>
                    <option value="%">%</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Sales Tax</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={salesTaxRate}
                    onChange={(e) => setSalesTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white text-xs text-right"
                  />
                  <span className="text-gray-600 dark:text-gray-400">%</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-base font-semibold border-t border-gray-300 dark:border-slate-700 pt-2">
                <span className="text-gray-900 dark:text-white">Total Due</span>
                <span className="text-gray-900 dark:text-white">{totals.totalDue.toFixed(2)}</span>
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

      {/* Manage Imprints Modal */}
      <ManageImprintsModal
        isOpen={showImprintsModal}
        onClose={() => setShowImprintsModal(false)}
        quoteId={quoteId}
      />

      {/* Line Item Options Modal */}
      {showCustomSizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-5xl w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Line Item Options</h3>
              <button
                onClick={() => setShowCustomSizeModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[600px] overflow-y-auto">
              <div className="grid grid-cols-3 gap-6">
                {/* Column 1: Sizes */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-slate-700">
                    Sizes
                  </h4>
                  <div className="space-y-2">
                    {(companySettings?.custom_line_item_options || []).map((option: string, idx: number) => (
                      <label
                        key={idx}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCustomSizeOptions.includes(option)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCustomSizeOptions([...selectedCustomSizeOptions, option]);
                            } else {
                              setSelectedCustomSizeOptions(selectedCustomSizeOptions.filter(o => o !== option));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">{option}</span>
                      </label>
                    ))}
                    {(!companySettings?.custom_line_item_options || companySettings.custom_line_item_options.length === 0) && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        No custom size options available. Add them in Account Settings.
                      </p>
                    )}
                  </div>
                </div>

                {/* Column 2: Taxes */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-slate-700">
                    Taxes
                  </h4>
                  <div className="space-y-4">
                    {itemGroups.map((group, idx) => (
                      <label
                        key={group.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={group.taxed}
                          onChange={(e) => {
                            const updatedGroups = [...itemGroups];
                            updatedGroups[idx].taxed = e.target.checked;
                            // Update all items in the group to match the group tax status
                            updatedGroups[idx].items = updatedGroups[idx].items.map(item => ({
                              ...item,
                              taxed: e.target.checked
                            }));
                            setItemGroups(updatedGroups);
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {group.label || `Line Item Group ${idx + 1}`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Column 3: Reserved for future use */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-slate-700">
                    &nbsp;
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      Additional options coming soon
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setShowCustomSizeModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
