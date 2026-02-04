import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Plus, Trash2, GripVertical, X, Loader2, DollarSign, Settings, Search, Image as ImageIcon, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import CreateCustomerModal from '../accounting/CreateCustomerModal';
import { ManageImprintsModal } from './ManageImprintsModal';
import MockupGenerator from './MockupGenerator';
import { getUnifiedProductData } from '../../services/ssactivewear-promostandards-service';

type SizeMode = 'regular' | 'double' | 'youth' | 'adult';

interface ProductSearchResult {
  supplier: 'sanmar' | 'ssactivewear';
  style: string;
  brand: string;
  description: string;
  category?: string;
  colors: {
    name: string;
    code: string;
    image_url?: string;
    pricing?: { wholesale?: number; retail?: number };
    stock?: Record<string, number>;
    sizes?: string[];
  }[];
}

interface QuoteItem {
  id?: string;
  item_number: string;
  color: string;
  description: string;
  qty_yxs?: number;
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
  qty_4xl?: number;
  qty_sm?: number;
  qty_lxl?: number;
  qty_ysym?: number;
  qty_ylyxl?: number;
  unit_price: number;
  total_quantity: number;
  total_price: number;
  taxed: boolean;
  custom_option?: string;
  size_mode?: SizeMode;
  regular_sizes?: Record<string, number>;
  double_sizes?: Record<string, number>;
  youth_sizes?: Record<string, number>;
  adult_sizes?: Record<string, number>;
  garment_front_image_url?: string;
  garment_back_image_url?: string;
  garment_sleeve_image_url?: string;
  garment_rear_image_url?: string;
  garment_side_image_url?: string;
  garment_lifestyle_image_url?: string;
  garment_images_data?: any;
  supplier_partid?: string;
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
  customSizeOptions: string[];
  sizeMode: SizeMode;
}

interface QuoteBuilderProps {
  quoteId?: string;
  initialCustomerId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export function QuoteBuilder({ quoteId: initialQuoteId, initialCustomerId, onSave, onCancel }: QuoteBuilderProps) {
  const { user, session } = useAuth();
  const { showNotification } = useNotification();
  const [quoteId, setQuoteId] = useState<string | undefined>(initialQuoteId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [availableFees, setAvailableFees] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const draftCreatedRef = useRef(false);

  // Helper to get ordered size columns for a specific group based on size mode
  const getSizeColumns = (group: LineItemGroup) => {
    const sizeMode = group.sizeMode || 'regular';

    const allSizes = [
      { key: 'qty_yxs', label: 'YXS', order: 0 },
      { key: 'qty_ys', label: 'YS', order: 1 },
      { key: 'qty_ym', label: 'YM', order: 2 },
      { key: 'qty_yl', label: 'YL', order: 3 },
      { key: 'qty_yxl', label: 'YXL', order: 4 },
      { key: 'qty_xs', label: 'XS', order: 5 },
      { key: 'qty_s', label: 'S', order: 6 },
      { key: 'qty_m', label: 'M', order: 7 },
      { key: 'qty_l', label: 'L', order: 8 },
      { key: 'qty_xl', label: 'XL', order: 9 },
      { key: 'qty_2xl', label: '2XL', order: 10 },
      { key: 'qty_3xl', label: '3XL', order: 11 },
      { key: 'qty_4xl', label: '4XL', order: 12 },
      { key: 'qty_sm', label: 'S/M', order: 13 },
      { key: 'qty_lxl', label: 'L/XL', order: 14 },
      { key: 'qty_ysym', label: 'YS/YM', order: 15 },
      { key: 'qty_ylyxl', label: 'YL/YXL', order: 16 },
    ];

    let visibleSizeLabels: string[] = [];

    switch (sizeMode) {
      case 'regular':
        visibleSizeLabels = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        break;
      case 'double':
        visibleSizeLabels = ['S/M', 'L/XL', 'YS/YM', 'YL/YXL'];
        break;
      case 'youth':
        visibleSizeLabels = ['YXS', 'YS', 'YM', 'YL', 'YXL'];
        break;
      case 'adult':
        visibleSizeLabels = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
        break;
      default:
        visibleSizeLabels = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
    }

    // Include custom sizes if selected for this group (only for regular mode)
    if (sizeMode === 'regular' && group.customSizeOptions.length > 0) {
      visibleSizeLabels = [...visibleSizeLabels, ...group.customSizeOptions];
    }

    const visibleSizes = allSizes.filter(size =>
      visibleSizeLabels.includes(size.label)
    );

    return visibleSizes.sort((a, b) => a.order - b.order);
  };

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
    { id: crypto.randomUUID(), label: '', items: [], taxed: false, customSizeOptions: [], sizeMode: 'regular' }
  ]);
  const [fees, setFees] = useState<QuoteFee[]>([]);

  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'$' | '%'>('$');
  const [salesTaxRate, setSalesTaxRate] = useState(6.25);

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showImprintsModal, setShowImprintsModal] = useState<string | null>(null);
  const [editingGroupIdForOptions, setEditingGroupIdForOptions] = useState<string | null>(null);
  const [showMockupForGroup, setShowMockupForGroup] = useState<string | null>(null);
  const [quoteImprints, setQuoteImprints] = useState<any[]>([]);

  const [productSearchResults, setProductSearchResults] = useState<ProductSearchResult[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [activeSearchItem, setActiveSearchItem] = useState<{ groupId: string; itemIdx: number } | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const createDraftQuote = async () => {
    if (!user || !session?.access_token || draftCreatedRef.current) return;

    draftCreatedRef.current = true;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/quotes-api/draft`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Draft creation failed:', response.status, errorText);
        throw new Error(`Failed to create draft quote: ${response.status}`);
      }

      const { quote } = await response.json();
      setQuoteId(quote.id);
      setQuoteNumber(quote.quote_number);
      setCreatedDate(quote.created_date || new Date().toISOString().split('T')[0]);

      return quote.id;
    } catch (error) {
      console.error('Error creating draft quote:', error);
      showNotification('error', 'Failed to create draft quote');
      draftCreatedRef.current = false;
    }
  };

  // Load company settings, customers, and fees on mount
  useEffect(() => {
    if (!user) return;

    loadCompanySettings();
    loadCustomers();
    loadAvailableFees();
  }, [user]);

  // Handle quote loading or creation
  useEffect(() => {
    if (!user) return;

    if (initialQuoteId) {
      // If we have an initial quote ID, set it and load
      setQuoteId(initialQuoteId);
      loadQuote(initialQuoteId);
    } else if (!draftCreatedRef.current) {
      // If no quote ID exists and we haven't created a draft yet, create one
      createDraftQuote();
      loadDefaultFees();
    }
  }, [user, initialQuoteId]);

  useEffect(() => {
    if (selectedCustomerId && !quoteId) {
      loadCustomerDetails(selectedCustomerId);
    }
  }, [selectedCustomerId, quoteId]);



  const loadCompanySettings = async () => {
    if (!user) return;

    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userProfile?.company_id) return;

      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', userProfile.company_id)
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
    if (!user) return;

    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userProfile?.company_id) return;

      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .order('company_name');
      setCustomers(data || []);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
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
    if (!user) {
      console.log('QuoteBuilder: No user available for loadAvailableFees');
      return;
    }

    try {
      console.log('QuoteBuilder: Loading fees for user:', user.id);
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error loading user profile:', profileError);
        return;
      }

      if (!userProfile?.company_id) {
        console.log('QuoteBuilder: No company_id found for user');
        return;
      }

      console.log('QuoteBuilder: Loading fees for company:', userProfile.company_id);
      const { data, error } = await supabase
        .from('invoice_fees')
        .select('*')
        .eq('company_id', userProfile.company_id)
        .eq('is_active', true)
        .order('fee_name');

      if (error) {
        console.error('Error loading invoice_fees:', error);
        throw error;
      }

      console.log('QuoteBuilder: Loaded fees:', data);
      setAvailableFees(data || []);
    } catch (err) {
      console.error('Error loading available fees:', err);
    }
  };

  const loadDefaultFees = async () => {
    if (!user) return;

    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userProfile?.company_id) return;

      const { data: defaultFees, error } = await supabase
        .from('invoice_fees')
        .select('*')
        .eq('company_id', userProfile.company_id)
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

  const loadQuote = async (idToLoad?: string) => {
    const targetId = idToLoad || quoteId;
    if (!targetId) return;
    setLoading(true);
    const { data: quote } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', targetId)
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

      // If quote has a customer but no billing address, load customer details
      if (quote.customer_id && !quote.bill_company && !quote.bill_address_1) {
        loadCustomerDetails(quote.customer_id);
      }

      const { data: lineItems } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', targetId)
        .or('line_type.is.null,line_type.eq.item')
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
            item_number: item.item_number || '',
            color: item.color || '',
            description: item.description || '',
            notes: item.notes || '',
            taxed: item.taxed || false,
          });
        });

        const groups: LineItemGroup[] = Array.from(groupMap.entries()).map(([label, items]) => ({
          id: crypto.randomUUID(),
          label,
          items,
          taxed: items.length > 0 && items.every(item => item.taxed),
          customSizeOptions: [],
          sizeMode: (items.length > 0 && items[0].size_mode) ? items[0].size_mode as SizeMode : 'regular'
        }));

        setItemGroups(groups);
      } else {
        setItemGroups([{ id: crypto.randomUUID(), label: '', items: [], taxed: false, customSizeOptions: [], sizeMode: 'regular' }]);
      }

      // Load fees from quote_line_items (new format)
      const { data: lineItemFees } = await supabase
        .from('quote_line_items')
        .select('*')
        .eq('quote_id', targetId)
        .eq('line_type', 'fee');

      if (lineItemFees && lineItemFees.length > 0) {
        setFees(lineItemFees.map(fee => ({
          id: fee.id,
          fee_name: fee.description.split(' - ')[0],
          description: fee.notes || fee.description.split(' - ')[1] || fee.description,
          quantity: fee.quantity || 1,
          unit_amount: fee.unit_price,
          total_amount: fee.total_price,
          taxed: false,
        })));
      } else {
        // Fallback to old quote_fees table for backward compatibility
        const { data: quoteFees } = await supabase
          .from('quote_fees')
          .select('*')
          .eq('quote_id', targetId);
        setFees(quoteFees?.map(fee => ({
          ...fee,
          taxed: fee.taxed || false,
        })) || []);
      }
    }

    // Load imprints for the quote
    const { data: imprints } = await supabase
      .from('quote_imprints')
      .select('*')
      .eq('quote_id', targetId)
      .order('sort_order');

    if (imprints) {
      setQuoteImprints(imprints);
    }

    setLoading(false);
  };

  const getGroupImprints = (groupLabel: string) => {
    // If there's only one group with an empty label, show all imprints
    // This handles legacy quotes where imprints weren't assigned to groups
    if (itemGroups.length === 1 && !groupLabel) {
      return quoteImprints;
    }

    // Otherwise, filter by exact group_label match
    // Normalize empty string, null, and undefined as empty string
    const normalizedGroupLabel = groupLabel || '';
    return quoteImprints.filter(imp => {
      const normalizedImprintLabel = imp.group_label || '';
      return normalizedImprintLabel === normalizedGroupLabel;
    });
  };

  const addItem = (groupId: string) => {
    const newGroups = itemGroups.map(group => {
      if (group.id === groupId) {
        const newItem: QuoteItem = {
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
          qty_sm: 0,
          qty_lxl: 0,
          qty_ysym: 0,
          qty_ylyxl: 0,
          unit_price: 0,
          total_quantity: 0,
          total_price: 0,
          taxed: group.taxed,
        };

        // Add custom sizes if selected for this group
        if (group.customSizeOptions.includes('YXS')) newItem.qty_yxs = 0;
        if (group.customSizeOptions.includes('4XL')) newItem.qty_4xl = 0;

        return {
          ...group,
          items: [...group.items, newItem]
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
            (item.qty_yxs || 0) + item.qty_ys + item.qty_ym + item.qty_yl + item.qty_yxl +
            item.qty_xs + item.qty_s + item.qty_m + item.qty_l + item.qty_xl +
            item.qty_2xl + item.qty_3xl + (item.qty_4xl || 0) +
            (item.qty_sm || 0) + (item.qty_lxl || 0) + (item.qty_ysym || 0) + (item.qty_ylyxl || 0);
          item.total_price = item.total_quantity * item.unit_price;
        }

        return { ...group, items: newItems };
      }
      return group;
    });
    setItemGroups(newGroups);
  };

  const updatePriceFromMatrix = async (groupId: string, itemIndex: number) => {
    try {
      // Find the group
      const group = itemGroups.find(g => g.id === groupId);
      if (!group) {
        showNotification('error', 'Group not found');
        return;
      }

      const item = group.items[itemIndex];
      if (!item) {
        showNotification('error', 'Item not found');
        return;
      }

      // Get imprints for this group
      const groupImprints = getGroupImprints(group.label);

      if (groupImprints.length === 0) {
        showNotification('warning', 'No imprints found', 'Please add an imprint to this group first');
        return;
      }

      // Find the specific imprint for this line item using imprint_number
      let matchingImprint = null;

      if (item.imprint_number) {
        matchingImprint = groupImprints.find((imp: any) => imp.imprint_number === item.imprint_number);

        if (!matchingImprint) {
          showNotification('warning', 'Imprint not found', `No imprint found with number ${item.imprint_number} in this group`);
          return;
        }
      } else {
        // If no imprint_number is set on the line item, use the first imprint in the group
        matchingImprint = groupImprints[0];
      }

      const typeOfWork = matchingImprint.type_of_work;

      if (!typeOfWork) {
        showNotification('warning', 'No type of work specified', 'Please set a type of work for the imprint');
        return;
      }

      // Fetch price matrices for this company and type
      const { data: matrices, error } = await supabase
        .from('price_matrices')
        .select('*')
        .eq('matrix_type', typeOfWork.toLowerCase().replace(/\s+/g, '_'))
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching price matrices:', error);
        showNotification('error', 'Failed to fetch price matrix');
        return;
      }

      if (!matrices || matrices.length === 0) {
        showNotification('warning', 'No price matrix found', `No active price matrix found for ${typeOfWork}`);
        return;
      }

      const matrix = matrices[0];

      // Parse the matrix structure
      const rows = matrix.rows || [];
      const columns = matrix.columns || [];
      const cells = matrix.cells || {};

      if (rows.length === 0 || Object.keys(cells).length === 0) {
        showNotification('warning', 'Empty price matrix', 'The price matrix has no pricing data');
        return;
      }

      // Find the appropriate row based on total quantity
      let selectedRowIndex = 0;
      const totalQty = item.total_quantity;

      for (let i = 0; i < rows.length; i++) {
        const rowLabel = rows[i];
        // Parse quantity ranges like "1-24", "25-49", "50-99", "100+"
        const match = rowLabel.match(/(\d+)\s*-\s*(\d+)|(\d+)\+/);

        if (match) {
          if (match[3]) {
            // Format like "100+"
            const minQty = parseInt(match[3]);
            if (totalQty >= minQty) {
              selectedRowIndex = i;
            }
          } else if (match[1] && match[2]) {
            // Format like "1-24"
            const minQty = parseInt(match[1]);
            const maxQty = parseInt(match[2]);
            if (totalQty >= minQty && totalQty <= maxQty) {
              selectedRowIndex = i;
              break;
            }
          }
        }
      }

      // Get the price from the first column (column 0) for the selected row
      const cellKey = `${selectedRowIndex}-0`;
      const price = cells[cellKey];

      if (price === undefined || price === null) {
        showNotification('warning', 'No price found', 'No price found in the matrix for this quantity');
        return;
      }

      // Update the item's unit price
      const newGroups = itemGroups.map(g => {
        if (g.id === groupId) {
          const newItems = [...g.items];
          newItems[itemIndex] = {
            ...newItems[itemIndex],
            unit_price: parseFloat(price),
            total_price: item.total_quantity * parseFloat(price)
          };
          return { ...g, items: newItems };
        }
        return g;
      });

      setItemGroups(newGroups);
      showNotification('success', 'Price updated', `Unit price set to $${parseFloat(price).toFixed(2)} based on ${typeOfWork} pricing matrix`);

    } catch (error) {
      console.error('Error updating price from matrix:', error);
      showNotification('error', 'Failed to update price');
    }
  };

  const addItemGroup = () => {
    // Generate a unique label for the new group
    const nextGroupNumber = itemGroups.length + 1;
    const defaultLabel = `Group ${nextGroupNumber}`;

    setItemGroups([...itemGroups, {
      id: crypto.randomUUID(),
      label: defaultLabel,
      items: [],
      taxed: false,
      customSizeOptions: [],
      sizeMode: 'regular'
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

  const searchProductByStyle = useCallback(async (styleNumber: string) => {
    console.log('🔍 searchProductByStyle called with:', styleNumber);

    if (!styleNumber || styleNumber.length < 2) {
      console.log('⚠️ Style number too short, skipping search');
      setProductSearchResults([]);
      setShowProductDropdown(false);
      return;
    }

    console.log('✅ Style number valid, getting session...');

    // Get fresh session
    const { data: { session: freshSession }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !freshSession) {
      console.error('❌ Auth error:', sessionError);
      showNotification('error', 'Auth Error', 'You must be logged in');
      return;
    }

    console.log('✅ Session check:', {
      hasSession: !!freshSession,
      hasAccessToken: !!freshSession.access_token,
      tokenLength: freshSession.access_token?.length,
      expiresAt: freshSession.expires_at,
      now: Math.floor(Date.now() / 1000)
    });

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-search?style=${encodeURIComponent(styleNumber)}`;
    console.log('📡 Calling API:', apiUrl);

    setProductSearchLoading(true);
    try {
      console.log('⏳ Fetching...');
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${freshSession.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const data = await response.json();
      console.log('📦 Product search response:', data);

      // Log errors if present
      if (data.errors && data.errors.length > 0) {
        console.error('Product search errors:', data.errors);
        showNotification(`Product search errors: ${data.errors.join(', ')}`, 'error');
      }

      if (data.success && data.results) {
        // Log first result to see structure
        if (data.results.length > 0) {
          console.log('Sample raw result:', data.results[0]);
        }

        // Filter results to only include products that match the search term
        const searchTerm = styleNumber.toLowerCase().trim();
        let debugCount = 0;
        const filteredResults = data.results.filter((result: any) => {
          // Convert to string first since style might be a number
          const resultStyle = String(result.style || '').toLowerCase();
          const resultBrand = String(result.brand || '').toLowerCase();
          const resultDesc = String(result.description || '').toLowerCase();

          // Log first few for debugging
          if (debugCount < 3) {
            console.log('Comparing:', { resultStyle, resultBrand, resultDesc, searchTerm });
            debugCount++;
          }

          // For style numbers, require exact match or starts with search term (not just contains)
          // This prevents "5000" from matching "15000"
          const styleMatches = resultStyle === searchTerm || resultStyle.startsWith(searchTerm);

          // For brand and description, loose matching is OK
          const brandOrDescMatches = resultBrand.includes(searchTerm) || resultDesc.includes(searchTerm);

          return styleMatches || brandOrDescMatches;
        });

        console.log('Found results after filtering:', filteredResults.length, 'from', data.results.length);
        setProductSearchResults(filteredResults);
        setShowProductDropdown(filteredResults.length > 0);
      } else if (data.error) {
        console.log('Product search error:', data.error);
        setProductSearchResults([]);
        setShowProductDropdown(false);
      } else {
        console.log('Unknown response format:', data);
        setProductSearchResults([]);
        setShowProductDropdown(false);
      }
    } catch (err) {
      console.error('❌❌❌ Product search error:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        type: typeof err,
        err
      });
      showNotification('error', 'Search Error', `Failed to search: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      console.log('🏁 Search complete, setting loading to false');
      setProductSearchLoading(false);
    }
  }, [showNotification]);

  const handleStyleNumberChange = (groupId: string, itemIdx: number, value: string) => {
    console.log('⌨️ handleStyleNumberChange called:', { groupId, itemIdx, value });

    // Store the original value but trim for searching
    updateItem(groupId, itemIdx, 'item_number', value);

    if (searchTimeoutRef.current) {
      console.log('⏱️ Clearing previous timeout');
      clearTimeout(searchTimeoutRef.current);
    }

    setActiveSearchItem({ groupId, itemIdx });

    // Trim whitespace before searching
    const trimmedValue = value.trim();
    console.log('🔤 Trimmed value:', trimmedValue, 'Length:', trimmedValue.length);

    if (trimmedValue) {
      console.log('⏱️ Setting timeout to search in 500ms');
      searchTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Timeout fired! Calling searchProductByStyle');
        searchProductByStyle(trimmedValue);
      }, 500);
    } else {
      console.log('⚠️ Trimmed value is empty, not searching');
    }
  };

  const selectProductColor = async (product: ProductSearchResult, colorIdx: number) => {
    console.log('🔵 START selectProductColor:', { product, colorIdx });
    if (!activeSearchItem) return;

    const { groupId, itemIdx } = activeSearchItem;
    const color = colorIdx >= 0 ? product.colors[colorIdx] : null;

    console.log('🔵 Product and color details:', {
      supplier: product.supplier,
      style: product.style,
      hasColor: !!color,
      colorName: color?.name,
      colorCode: color?.code,
      willFetchImages: product.supplier === 'ssactivewear' && !!color?.code,
    });

    const garmentImages: Record<string, any> = {};

    // Fetch garment images AND pricing based on supplier
    let freshPrice: number | null = null;

    if (product.supplier === 'ssactivewear' && color?.code) {
      try {
        console.log('🎨 Fetching SSActivewear garment images & pricing for:', { style: product.style, partId: color.code });
        const unifiedData = await getUnifiedProductData(product.style, color.code);
        console.log('📦 Unified data response:', {
          success: unifiedData.success,
          hasMedia: !!unifiedData.media,
          hasViews: !!unifiedData.media?.views,
          hasImages: !!unifiedData.media?.images,
          imageCount: unifiedData.media?.images?.length,
          viewsKeys: unifiedData.media?.views ? Object.keys(unifiedData.media.views) : [],
          hasPricing: !!unifiedData.pricing,
          pricingPartsCount: unifiedData.pricing?.parts?.length || 0,
          hasPriceMap: !!unifiedData.pricing?.pricesByPartId,
        });

        // Extract fresh pricing for this specific partId
        if (unifiedData.pricing?.pricesByPartId && color.code) {
          const priceForPart = unifiedData.pricing.pricesByPartId[color.code];
          if (priceForPart) {
            freshPrice = priceForPart;
            console.log('💰 Fresh pricing found for part:', { partId: color.code, price: freshPrice });
          } else {
            console.warn('⚠️ No price found for part:', color.code, 'Available parts:', Object.keys(unifiedData.pricing.pricesByPartId));
          }
        } else {
          console.warn('⚠️ No pricing data in unified response');
        }

        console.log('🐛 Debug info from API:', unifiedData.debug);

        if (unifiedData.debug?.mediaAuthError) {
          console.warn('⚠️ SSActivewear Media API Authentication Error:', unifiedData.debug.mediaAuthError);
          console.warn('Your SSActivewear account may not have Media API access enabled. Contact SSActivewear support to enable it.');
        }

        if (unifiedData.debug?.mediaError) {
          console.error('❌ Media API Error:', unifiedData.debug.mediaError);
        }

        if (unifiedData.debug?.mediaXmlFull) {
          console.log('📄 Media XML (first 2000 chars):', unifiedData.debug.mediaXmlFull.substring(0, 2000));
        }

        if (unifiedData.success && unifiedData.media?.views) {
          if (unifiedData.media.views.front) {
            garmentImages.garment_front_image_url = unifiedData.media.views.front;
            garmentImages.garment_back_image_url = unifiedData.media.views.front;
            console.log('✅ Set front image:', unifiedData.media.views.front);
          }
          if (unifiedData.media.views.rear) {
            garmentImages.garment_rear_image_url = unifiedData.media.views.rear;
            console.log('✅ Set rear image:', unifiedData.media.views.rear);
          }
          if (unifiedData.media.views.side) {
            garmentImages.garment_side_image_url = unifiedData.media.views.side;
            garmentImages.garment_sleeve_image_url = unifiedData.media.views.side;
            console.log('✅ Set side image:', unifiedData.media.views.side);
          }
          if (unifiedData.media.views.lifestyle) {
            garmentImages.garment_lifestyle_image_url = unifiedData.media.views.lifestyle;
            console.log('✅ Set lifestyle image:', unifiedData.media.views.lifestyle);
          }

          const filterValidImages = (images: any[]) => {
            return (images || []).filter((img: any) => {
              if (!img) return false;
              if (typeof img !== 'string') return false;
              const trimmed = img.trim();
              if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return false;

              // Check if URL points to an actual image file
              const lowerUrl = trimmed.toLowerCase();
              const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
              const hasImageExtension = imageExtensions.some(ext => lowerUrl.includes(ext));

              // Exclude non-image URLs like PDFs, spec sheets, etc.
              if (lowerUrl.includes('.pdf') || lowerUrl.includes('itemspecs.aspx') || lowerUrl.includes('itemspecsheet.aspx')) {
                return false;
              }

              return hasImageExtension;
            });
          };

          garmentImages.garment_images_data = {
            frontImages: filterValidImages(unifiedData.media.views.frontImages || []),
            rearImages: filterValidImages(unifiedData.media.views.rearImages || []),
            sideImages: filterValidImages(unifiedData.media.views.sideImages || []),
            lifestyleImages: filterValidImages(unifiedData.media.views.lifestyleImages || []),
            otherImages: filterValidImages(unifiedData.media.views.otherImages || []),
            allImages: filterValidImages(unifiedData.media.images || []),
          };

          console.log('✅ Loaded SSActivewear images:', {
            front: !!garmentImages.garment_front_image_url,
            rear: !!garmentImages.garment_rear_image_url,
            side: !!garmentImages.garment_side_image_url,
            lifestyle: !!garmentImages.garment_lifestyle_image_url,
            frontImages: garmentImages.garment_images_data.frontImages.length,
            rearImages: garmentImages.garment_images_data.rearImages.length,
            sideImages: garmentImages.garment_images_data.sideImages.length,
            lifestyleImages: garmentImages.garment_images_data.lifestyleImages.length,
            otherImages: garmentImages.garment_images_data.otherImages.length,
            allImages: garmentImages.garment_images_data.allImages.length,
          });
        } else {
          console.error('❌ No media data in unified response:', {
            success: unifiedData.success,
            hasMedia: !!unifiedData.media,
            media: unifiedData.media,
          });
        }
      } catch (error: any) {
        console.error('❌ Failed to fetch SSActivewear garment images:', {
          message: error.message,
          stack: error.stack,
          error,
        });
        showNotification('error', `Failed to load images: ${error.message}`);
      }
    } else if (product.supplier === 'sanmar' && color) {
      try {
        console.log('Fetching SanMar garment images for:', { style: product.style, color: color.name });

        if (color.image_url) {
          garmentImages.garment_front_image_url = color.image_url;
          garmentImages.garment_images_data = {
            frontImages: [color.image_url],
            rearImages: [],
            sideImages: [],
            lifestyleImages: [],
            otherImages: [],
            allImages: [color.image_url],
          };
          console.log('Loaded SanMar thumbnail image');
        } else {
          console.warn('No image URL available for SanMar product');
        }
      } catch (error: any) {
        console.error('Failed to fetch SanMar garment images:', error);
      }
    }

    if (color?.code) {
      garmentImages.supplier_partid = color.code;
    }

    console.log('🎨 Updating item with garment images:', {
      groupId,
      itemIdx,
      garmentImages,
      hasFrontImage: !!garmentImages.garment_front_image_url,
      hasRearImage: !!garmentImages.garment_rear_image_url,
      hasImagesData: !!garmentImages.garment_images_data,
    });

    const newGroups = itemGroups.map(group => {
      if (group.id === groupId) {
        const newItems = [...group.items];
        newItems[itemIdx] = {
          ...newItems[itemIdx],
          item_number: product.style.trim(),
          color: color?.name?.trim() || '',
          description: `${product.brand} ${product.description}`.trim(),
          unit_price: freshPrice !== null ? freshPrice : (color?.pricing?.wholesale || 0),
          ...garmentImages,
        };

        console.log('💰 Final unit_price set:', {
          freshPrice,
          cachedPrice: color?.pricing?.wholesale,
          finalPrice: freshPrice !== null ? freshPrice : (color?.pricing?.wholesale || 0),
        });
        console.log('📝 Updated item:', newItems[itemIdx]);
        return { ...group, items: newItems };
      }
      return group;
    });

    setItemGroups(newGroups);
    setShowProductDropdown(false);
    setProductSearchResults([]);
    setActiveSearchItem(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const performSave = async (isAutoSave = false, statusOverride?: string): Promise<boolean> => {
    if (!user) {
      if (!isAutoSave) {
        showNotification('error', 'Authentication Error', 'You must be logged in to save a quote');
      }
      return false;
    }

    if (!quoteId) {
      if (!isAutoSave) {
        showNotification('error', 'Error', 'Quote ID is missing');
      }
      return false;
    }

    if (!selectedCustomerId && !isAutoSave) {
      showNotification('error', 'Validation Error', 'Please select a customer before saving');
      return false;
    }

    if (!isAutoSave) setSaving(true);
    try {
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!userProfile?.company_id) {
        if (!isAutoSave) {
          showNotification('error', 'Configuration Error', 'User company not found');
        }
        return false;
      }

      let customerData: any = null;
      if (selectedCustomerId) {
        const { data } = await supabase
          .from('customers')
          .select('company_name, email, phone')
          .eq('id', selectedCustomerId)
          .maybeSingle();
        customerData = data;
      }

      const quoteData = {
        company_id: userProfile.company_id,
        customer_id: selectedCustomerId || null,
        customer_name: customerData?.company_name || 'Draft Quote',
        customer_email: customerData?.email || null,
        customer_phone: customerData?.phone || null,
        status: statusOverride || 'draft',
        created_date: createdDate,
        production_due_date: productionDueDate || null,
        customer_due_date: customerDueDate || null,
        terms,
        po_number: poNumber || null,
        delivery_method: deliveryMethod || null,
        nickname: nickname || null,
        customer_notes: customerNotes || null,
        production_notes: productionNotes || null,
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

      const { error: updateError } = await supabase
        .from('quotes')
        .update(quoteData)
        .eq('id', quoteId);

      if (updateError) throw updateError;

      await supabase.from('quote_line_items').delete().eq('quote_id', quoteId);

      const allItems = itemGroups.flatMap((group, groupIdx) =>
        group.items.map((item, itemIdx) => {
          console.log('💾 Saving item with images:', {
            item_number: item.item_number,
            color: item.color,
            has_front_image: !!item.garment_front_image_url,
            has_rear_image: !!item.garment_rear_image_url,
            has_images_data: !!item.garment_images_data,
            front_image_url: item.garment_front_image_url,
          });
          return {
          quote_id: quoteId,
            company_id: userProfile.company_id,
            line_type: 'item',
            sort_order: groupIdx * 1000 + itemIdx,
            group_label: group.label || '',
            size_mode: group.sizeMode || 'regular',
            item_number: item.item_number,
            color: item.color,
            description: item.description,
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
            qty_5xl: item.qty_5xl || 0,
            qty_sm: item.qty_sm || 0,
            qty_lxl: item.qty_lxl || 0,
            qty_ysym: item.qty_ysym || 0,
            qty_ylyxl: item.qty_ylyxl || 0,
            unit_price: item.unit_price,
            total_quantity: item.total_quantity,
            total_price: item.total_price,
            taxed: item.taxed,
            garment_front_image_url: item.garment_front_image_url || null,
            garment_back_image_url: item.garment_back_image_url || null,
            garment_sleeve_image_url: item.garment_sleeve_image_url || null,
            garment_rear_image_url: item.garment_rear_image_url || null,
            garment_side_image_url: item.garment_side_image_url || null,
            garment_lifestyle_image_url: item.garment_lifestyle_image_url || null,
            garment_images_data: item.garment_images_data || null,
            supplier_partid: item.supplier_partid || null,
          };
        })
        );

        if (allItems.length > 0) {
          const { error: itemsError } = await supabase.from('quote_line_items').insert(allItems);
          if (itemsError) throw itemsError;
        }

      if (fees.length > 0) {
        const { error: feesError } = await supabase.from('quote_line_items').insert(
          fees.map((fee, index) => ({
            quote_id: quoteId,
            company_id: userProfile.company_id,
            line_number: 9000 + index,
            line_type: 'fee',
            description: fee.fee_name + (fee.description && fee.description !== fee.fee_name ? ` - ${fee.description}` : ''),
            quantity: fee.quantity,
            unit_price: fee.unit_amount,
            total_price: fee.total_amount,
            notes: fee.description !== fee.fee_name ? fee.description : null,
          }))
        );

        if (feesError) throw feesError;
      }

      if (!isAutoSave) {
        showNotification('success', 'Quote Saved', 'Quote has been saved successfully');
      }

      return true;
    } catch (error: any) {
      console.error('Error saving quote:', error);
      if (!isAutoSave) {
        showNotification('error', 'Save Failed', error.message || 'Failed to save quote');
      }
      return false;
    } finally {
      if (!isAutoSave) setSaving(false);
    }
  };

  const handleSave = async () => {
    await performSave(false);
  };

  const handleSaveAndClose = async () => {
    const success = await performSave(false);
    if (success) {
      onSave?.();
    }
  };

  const handleSendQuote = async () => {
    if (!selectedCustomerId) {
      showNotification('error', 'Customer Required', 'Please select a customer before sending the quote');
      return;
    }

    const success = await performSave(false, 'sent');
    if (success) {
      showNotification('success', 'Quote Sent', 'Quote status updated to "Sent"');
      onSave?.();
    }
  };

  const handleCancel = () => {
    onCancel?.();
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {quoteId ? `Quote ${quoteNumber}` : 'New Quote'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-2 shadow-sm"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>
          <button
            onClick={handleSendQuote}
            disabled={saving || !selectedCustomerId}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center gap-2 shadow-sm disabled:opacity-50"
            title={!selectedCustomerId ? 'Select a customer to send quote' : 'Send quote to customer'}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Send Quote
          </button>
          <button
            onClick={handleSaveAndClose}
            disabled={saving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save & Close
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 bg-gray-50 dark:bg-slate-950">
        <div className="max-w-[2000px] mx-auto space-y-4">
          {/* Customer and Details Section */}
          <div className="grid grid-cols-3 gap-4">
            {/* Left: Customer Information */}
            <div className="col-span-2 space-y-6 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-4">
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
                  onChange={(e) => {
                    const newCustomerId = e.target.value;
                    setSelectedCustomerId(newCustomerId);
                    if (newCustomerId) {
                      loadCustomerDetails(newCustomerId);
                    }
                  }}
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
            <div className="space-y-4 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-4">
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
          <div className="space-y-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                {/* Only show main thead when there is a single group with no label */}
                {itemGroups.length === 1 && !itemGroups[0].label && (
                  <thead>
                    <tr className="bg-gray-100 dark:bg-slate-900 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <th className="p-1 text-left border border-gray-300 dark:border-slate-800 w-6"></th>
                      <th className="p-2 text-left border border-gray-300 dark:border-slate-800 w-36">Item #</th>
                      <th className="p-2 text-left border border-gray-300 dark:border-slate-800 w-36">Color</th>
                      <th className="p-2 text-left border border-gray-300 dark:border-slate-800">Description</th>
                      {getSizeColumns(itemGroups[0]).map(size => (
                        <th key={size.key} className="p-2 text-center border border-gray-300 dark:border-slate-800 w-10">{size.label}</th>
                      ))}
                      <th className="p-2 text-center border border-gray-300 dark:border-slate-800 w-14">Qty</th>
                      <th className="p-2 text-right border border-gray-300 dark:border-slate-800 w-24">Unit Price</th>
                      <th className="p-2 text-right border border-gray-300 dark:border-slate-800 w-24">Total</th>
                      <th className="p-2 text-center border border-gray-300 dark:border-slate-800 w-20">Actions</th>
                    </tr>
                  </thead>
                )}
                <tbody>
                  {itemGroups.map((group, groupIdx) => (
                    <React.Fragment key={group.id}>
                      {/* Spacer Row Between Groups */}
                      {groupIdx > 0 && (
                        <tr key={`spacer-${group.id}`} className="bg-transparent">
                          <td colSpan={getSizeColumns(group).length + 8} className="p-4 border-0"></td>
                        </tr>
                      )}
                      {/* Group Header Row with Label - All Groups */}
                      {(itemGroups.length > 1 || group.label) && (
                        <tr key={`header-${group.id}`} className="bg-gray-200 dark:bg-slate-800">
                          <td colSpan={getSizeColumns(group).length + 8} className="p-2 border border-gray-300 dark:border-slate-800">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 flex-1">
                                <input
                                  type="text"
                                  value={group.label}
                                  onChange={(e) => updateGroupLabel(group.id, e.target.value)}
                                  placeholder="Group Label (optional)"
                                  className="px-3 py-1 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-sm text-gray-900 dark:text-white flex-1"
                                />
                              </div>
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    checked={group.taxed}
                                    onChange={(e) => {
                                      const updatedGroups = [...itemGroups];
                                      const idx = updatedGroups.findIndex(g => g.id === group.id);
                                      updatedGroups[idx].taxed = e.target.checked;
                                      updatedGroups[idx].items = updatedGroups[idx].items.map(item => ({
                                        ...item,
                                        taxed: e.target.checked
                                      }));
                                      setItemGroups(updatedGroups);
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  Tax Group
                                </label>
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
                            </div>
                          </td>
                        </tr>
                      )}
                      {/* Group Column Headers - All Groups with Labels */}
                      {(itemGroups.length > 1 || group.label) && (
                        <tr key={`columns-${group.id}`} className="bg-gray-100 dark:bg-slate-900 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          <th className="p-1 text-left border border-gray-300 dark:border-slate-800 w-6"></th>
                          <th className="p-2 text-left border border-gray-300 dark:border-slate-800 w-48">Item #</th>
                          <th className="p-2 text-left border border-gray-300 dark:border-slate-800 w-48">Color</th>
                          <th className="p-2 text-left border border-gray-300 dark:border-slate-800">Description</th>
                          {getSizeColumns(group).map(size => (
                            <th key={size.key} className="p-2 text-center border border-gray-300 dark:border-slate-800 w-10">{size.label}</th>
                          ))}
                          <th className="p-2 text-center border border-gray-300 dark:border-slate-800 w-14">Qty</th>
                          <th className="p-2 text-right border border-gray-300 dark:border-slate-800 w-24">Unit Price</th>
                          <th className="p-2 text-right border border-gray-300 dark:border-slate-800 w-24">Total</th>
                          <th className="p-2 text-center border border-gray-300 dark:border-slate-800 w-20">Actions</th>
                        </tr>
                      )}
                      {/* Group Items */}
                      {group.items.map((item, itemIdx) => (
                        <tr key={`${group.id}-${itemIdx}`} className="bg-white dark:bg-slate-900/50 hover:bg-gray-50 dark:hover:bg-slate-900">
                          <td className="p-0.5 border border-gray-300 dark:border-slate-800 text-center">
                            <GripVertical className="w-3 h-3 text-gray-600 mx-auto" />
                          </td>
                          <td className="p-0 border border-gray-300 dark:border-slate-800 relative">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.item_number}
                                onChange={(e) => handleStyleNumberChange(group.id, itemIdx, e.target.value)}
                                onFocus={() => {
                                  setActiveSearchItem({ groupId: group.id, itemIdx });
                                  if (item.item_number && item.item_number.length >= 2) {
                                    searchProductByStyle(item.item_number);
                                  }
                                }}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-base pr-8"
                                placeholder="Style #"
                              />
                              {productSearchLoading && activeSearchItem?.groupId === group.id && activeSearchItem?.itemIdx === itemIdx && (
                                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                                </div>
                              )}
                              {!productSearchLoading && item.item_number && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSearchItem({ groupId: group.id, itemIdx });
                                    searchProductByStyle(item.item_number);
                                  }}
                                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500"
                                  title="Search suppliers"
                                >
                                  <Search className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            {showProductDropdown && activeSearchItem?.groupId === group.id && activeSearchItem?.itemIdx === itemIdx && productSearchResults.length > 0 && (
                              <div
                                ref={dropdownRef}
                                className="absolute z-50 left-0 top-full mt-1 w-[600px] max-h-96 overflow-auto bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg shadow-xl"
                              >
                                <div className="p-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {productSearchResults.length} product(s) found
                                  </p>
                                </div>
                                {productSearchResults.map((product, pIdx) => (
                                  <div key={pIdx} className="border-b border-gray-200 dark:border-slate-700 last:border-0">
                                    <div className="max-h-64 overflow-y-auto">
                                      {product.colors.map((color, cIdx) => (
                                        <button
                                          key={cIdx}
                                          type="button"
                                          onClick={() => selectProductColor(product, cIdx)}
                                          className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors border-b border-gray-100 dark:border-slate-700 last:border-0"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-xs text-gray-900 dark:text-white flex-1">
                                              {product.brand} - {product.style} - {color.name} - {product.description} - {product.style}
                                              <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 uppercase text-[10px]">
                                                {product.supplier}
                                              </span>
                                            </p>
                                          </div>
                                        </button>
                                      ))}
                                      {product.colors.length === 0 && (
                                        <button
                                          type="button"
                                          onClick={() => selectProductColor(product, -1)}
                                          className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-700 text-xs text-gray-600 dark:text-gray-400"
                                        >
                                          Select without color
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-0 border border-gray-300 dark:border-slate-800">
                            <input
                              type="text"
                              value={item.color}
                              onChange={(e) => updateItem(group.id, itemIdx, 'color', e.target.value)}
                              className="w-full px-2 py-2 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-base"
                            />
                          </td>
                          <td className="p-0 border border-gray-300 dark:border-slate-800">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(group.id, itemIdx, 'description', e.target.value)}
                              className="w-full px-2 py-2 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-base"
                            />
                          </td>
                          {getSizeColumns(group).map(size => (
                            <td key={size.key} className="p-0 border border-gray-300 dark:border-slate-800">
                              <input
                                type="number"
                                min="0"
                                value={(item as any)[size.key] || ''}
                                onChange={(e) => updateItem(group.id, itemIdx, size.key, parseInt(e.target.value) || 0)}
                                className="w-full px-1 py-2 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-base text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                          ))}
                      <td className="p-1 border border-gray-300 dark:border-slate-800 text-center text-base text-gray-900 dark:text-white font-semibold">
                        {item.total_quantity}
                      </td>
                      <td className="p-0 border border-gray-300 dark:border-slate-800">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateItem(group.id, itemIdx, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-2 bg-white dark:bg-slate-900 border-0 text-gray-900 dark:text-white text-base text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="p-1 border border-gray-300 dark:border-slate-800 text-right text-base font-semibold text-gray-900 dark:text-white">
                        ${item.total_price.toFixed(2)}
                      </td>
                      <td className="p-0.5 border border-gray-300 dark:border-slate-800">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => updatePriceFromMatrix(group.id, itemIdx)}
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
                        <td colSpan={getSizeColumns(group).length + 8} className="p-2 border-t-2 border-gray-300 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                          <div className="space-y-3">
                            <div className="flex gap-2 justify-between items-start">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => addItem(group.id)}
                                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-2 shadow-sm"
                                >
                                  <Plus className="w-4 h-4" />
                                  Line Item
                                </button>
                                <button
                                  onClick={() => setShowImprintsModal(group.label)}
                                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-2 shadow-sm"
                                >
                                  <Plus className="w-4 h-4" />
                                  Imprint(s)
                                </button>
                              </div>
                              <div className="flex flex-col gap-2 items-end">
                                <button
                                  onClick={() => {
                                    setShowMockupForGroup(group.label);
                                  }}
                                  className="w-32 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center justify-center gap-2 shadow-sm"
                                >
                                  <Plus className="w-4 h-4" />
                                  Mockup
                                </button>
                                <button
                                  onClick={() => setEditingGroupIdForOptions(group.id)}
                                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded text-sm flex items-center gap-2 shadow-sm whitespace-nowrap"
                                >
                                  <Settings className="w-4 h-4" />
                                  Line Item Options
                                </button>
                              </div>
                            </div>

                            {/* Imprint Display Blocks */}
                            {getGroupImprints(group.label).length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                                {getGroupImprints(group.label).map((imprint, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white dark:bg-slate-800/70 rounded-lg p-3 border border-gray-200 dark:border-slate-700/50 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                          {imprint.imprint_number && (
                                            <span className="text-xs px-2 py-1 bg-gray-800 dark:bg-slate-600 text-white rounded font-mono font-semibold">
                                              #{imprint.imprint_number}
                                            </span>
                                          )}
                                          <span className="text-gray-900 dark:text-white font-medium text-sm truncate">
                                            {imprint.location || imprint.matrix}
                                          </span>
                                          <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded whitespace-nowrap">
                                            {imprint.type_of_work}
                                          </span>
                                          {imprint.pricing_matrix_column && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                              Col: {imprint.pricing_matrix_column}
                                            </span>
                                          )}
                                        </div>
                                        {imprint.details && (
                                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 line-clamp-2">
                                            {imprint.details}
                                          </p>
                                        )}
                                        {imprint.thread_ink_color && (
                                          <p className="text-xs text-gray-600 dark:text-gray-400">
                                            Color: {imprint.thread_ink_color}
                                          </p>
                                        )}
                                        {/* Display mockup thumbnails */}
                                        {imprint.mockups && imprint.mockups.length > 0 && (
                                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                                            <div className="flex flex-wrap gap-1.5">
                                              {imprint.mockups.map((mockup: any, mockupIdx: number) => {
                                                const mockupUrl = typeof mockup === 'string' ? mockup : mockup?.url;
                                                if (!mockupUrl) return null;

                                                return (
                                                  <div
                                                    key={mockupIdx}
                                                    className="relative group"
                                                  >
                                                    <img
                                                      src={mockupUrl}
                                                      alt={`Mockup ${mockupIdx + 1}`}
                                                      className="w-16 h-16 object-contain rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 cursor-pointer hover:border-blue-500 transition-all"
                                                      onClick={() => window.open(mockupUrl, '_blank')}
                                                      title="Click to view full size"
                                                    />
                                                    <button
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (confirm('Delete this mockup?')) {
                                                          try {
                                                            const updatedMockups = imprint.mockups.filter((_: any, idx: number) => idx !== mockupIdx);
                                                            const { error } = await supabase
                                                              .from('quote_imprints')
                                                              .update({ mockups: updatedMockups })
                                                              .eq('id', imprint.id);

                                                            if (error) throw error;

                                                            setQuoteImprints((prev: any[]) =>
                                                              prev.map((imp: any) =>
                                                                imp.id === imprint.id
                                                                  ? { ...imp, mockups: updatedMockups }
                                                                  : imp
                                                              )
                                                            );

                                                            showNotification('success', 'Mockup deleted');
                                                          } catch (error: any) {
                                                            console.error('Error deleting mockup:', error);
                                                            showNotification('error', `Failed to delete mockup: ${error.message}`);
                                                          }
                                                        }
                                                      }}
                                                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                      title="Delete mockup"
                                                    >
                                                      <X className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Line Item Group Button */}
          <div className="mb-6">
            <button
              onClick={addItemGroup}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white rounded text-sm flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Line Item Group
            </button>
          </div>

          {/* Fees Table */}
          <div className="max-w-4xl ml-auto space-y-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-800 p-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-slate-900 text-sm text-gray-700 dark:text-gray-400">
                  <th className="p-2 text-left border border-gray-300 dark:border-slate-800">Fee</th>
                  <th className="p-2 text-left border border-gray-300 dark:border-slate-800">Description</th>
                  <th className="p-2 text-center border border-gray-300 dark:border-slate-800 w-20">Qty</th>
                  <th className="p-2 text-right border border-gray-300 dark:border-slate-800 w-24">Amount</th>
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
                    <td className="p-2 border border-gray-300 dark:border-slate-800 text-right text-sm text-gray-900 dark:text-white">
                      ${fee.unit_amount.toFixed(2)}
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

            {/* Debug Info - Shows number of fees loaded */}
            {availableFees.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {availableFees.length} fee template(s) available
              </div>
            )}
            {availableFees.length === 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400 mb-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                No fee templates found. Add fees in Account Settings → Production → General Settings.
              </div>
            )}

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
        isOpen={showImprintsModal !== null}
        onClose={() => {
          setShowImprintsModal(null);
          if (quoteId) {
            // Reload imprints after modal closes
            supabase
              .from('quote_imprints')
              .select('*')
              .eq('quote_id', quoteId)
              .order('sort_order')
              .then(({ data }) => {
                if (data) setQuoteImprints(data);
              });
          }
        }}
        quoteId={quoteId}
        initialGroupLabel={showImprintsModal || ''}
        lineItems={itemGroups.flatMap(group =>
          group.items.map(item => ({
            ...item,
            group_label: group.label
          }))
        )}
      />

      {/* Mockup Generator Modal */}
      {showMockupForGroup !== null && (
        <MockupGenerator
          quoteId={quoteId}
          customerId={selectedCustomerId}
          garmentStyle=""
          garmentColor=""
          groupLabel={showMockupForGroup}
          onClose={() => setShowMockupForGroup(null)}
          onSave={async () => {
            // Reload imprints to get updated mockups (but keep modal open)
            if (quoteId) {
              const { data } = await supabase
                .from('quote_imprints')
                .select('*')
                .eq('quote_id', quoteId)
                .order('sort_order');
              if (data) setQuoteImprints(data);
            }
          }}
        />
      )}

      {/* Line Item Options Modal */}
      {editingGroupIdForOptions && (() => {
        const editingGroup = itemGroups.find(g => g.id === editingGroupIdForOptions);
        if (!editingGroup) return null;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Line Item Options
                  {editingGroup.label && <span className="text-sm font-normal text-gray-500 ml-2">- {editingGroup.label}</span>}
                </h3>
                <button
                  onClick={() => setEditingGroupIdForOptions(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 max-h-[600px] overflow-y-auto space-y-6">
                {/* Size Mode Selector */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Size Mode
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Choose which size set to display for this line item group.
                  </p>
                  <select
                    value={editingGroup.sizeMode || 'regular'}
                    onChange={(e) => {
                      const newSizeMode = e.target.value as SizeMode;
                      const updatedGroups = itemGroups.map(g => {
                        if (g.id === editingGroupIdForOptions) {
                          return { ...g, sizeMode: newSizeMode };
                        }
                        return g;
                      });
                      setItemGroups(updatedGroups);
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded text-gray-900 dark:text-white text-sm"
                  >
                    <option value="regular">Regular Sizes (Youth + Adult)</option>
                    <option value="double">Double Sizes (S/M, L/XL, YS/YM, YL/YXL)</option>
                    <option value="youth">Youth-Only Sizes (YXS, YS, YM, YL, YXL)</option>
                    <option value="adult">Adult-Only Sizes (XS - 4XL)</option>
                  </select>
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      {editingGroup.sizeMode === 'regular' && 'Displays: YXS, YS, YM, YL, YXL, XS, S, M, L, XL, 2XL, 3XL, 4XL'}
                      {editingGroup.sizeMode === 'double' && 'Displays: S/M, L/XL, YS/YM, YL/YXL'}
                      {editingGroup.sizeMode === 'youth' && 'Displays: YXS, YS, YM, YL, YXL'}
                      {editingGroup.sizeMode === 'adult' && 'Displays: XS, S, M, L, XL, 2XL, 3XL, 4XL'}
                    </p>
                  </div>
                </div>

                {/* Additional Size Columns (only for regular mode) */}
                {editingGroup.sizeMode === 'regular' && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Additional Size Columns
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Select additional size columns to display for this line item group.
                    </p>
                    <div className="space-y-2">
                      {(companySettings?.custom_line_item_options || []).map((option: string, idx: number) => (
                        <label
                          key={idx}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={editingGroup.customSizeOptions.includes(option)}
                            onChange={(e) => {
                              const updatedGroups = itemGroups.map(g => {
                                if (g.id === editingGroupIdForOptions) {
                                  const newOptions = e.target.checked
                                    ? [...g.customSizeOptions, option]
                                    : g.customSizeOptions.filter(o => o !== option);
                                  return { ...g, customSizeOptions: newOptions };
                                }
                                return g;
                              });
                              setItemGroups(updatedGroups);
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-900 dark:text-white">{option}</span>
                        </label>
                      ))}
                      {(!companySettings?.custom_line_item_options || companySettings.custom_line_item_options.length === 0) && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            No custom size options available. Add them in Account Settings.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => setEditingGroupIdForOptions(null)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
