import { useState, useMemo, useEffect } from 'react';
import { Search, User, DollarSign, FileText, AlertCircle, ExternalLink, Plus, CreditCard as Edit2, Trash2, Save, X, Gift, Upload, File, MapPin, Phone, Mail, Globe, Building, Image, Receipt } from 'lucide-react';
import { Invoice } from '../types/printavo';
import { formatCurrency, calculateCustomerLifetimeValue, calculateCustomerOutstandingBalance } from '../utils/financial-aggregations';
import { format, parseISO } from 'date-fns';
import { getPrintavoInvoiceUrl } from '../utils/printavo-links';
import { supabase } from '../lib/supabase-client';

interface CustomerProfile {
  id: string;
  name: string;
  email?: string;
  invoices: Invoice[];
  lifetimeValue: number;
  outstandingBalance: number;
  totalInvoices: number;
}

interface CustomerProfilesProps {
  invoices: Invoice[];
  loading?: boolean;
}

interface DatabaseCustomer {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_country: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_zip: string | null;
  shipping_country: string | null;
  customer_type: string | null;
  tax_exempt: boolean | null;
  tax_id: string | null;
  payment_terms: string | null;
  credit_limit: number | null;
  notes: string | null;
  internal_notes: string | null;
  status: string | null;
  printavo_customer_id: string | null;
}

interface CustomerContact {
  id: string;
  customer_id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_primary: boolean | null;
  notes: string | null;
}

interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  nickname?: string;
  delivery_date?: string;
}

interface FundraisingCredit {
  id: string;
  customer_id: string;
  date: string;
  store_name: string;
  batch_number: string;
  amount: number;
  report_file_path?: string | null;
  created_at: string;
  updated_at: string;
}

export function CustomerProfiles({ invoices, loading }: CustomerProfilesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'ltv' | 'balance'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [databaseCustomers, setDatabaseCustomers] = useState<DatabaseCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  useEffect(() => {
    loadCustomersFromDatabase();
  }, []);

  const loadCustomersFromDatabase = async () => {
    setLoadingCustomers(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('company_name');

      if (error) throw error;
      setDatabaseCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const customerProfiles = useMemo(() => {
    const customersMap = new Map<string, CustomerProfile>();

    // First, add customers from the database
    databaseCustomers.forEach(dbCustomer => {
      customersMap.set(dbCustomer.id, {
        id: dbCustomer.id,
        name: dbCustomer.company_name,
        email: dbCustomer.email || undefined,
        invoices: [],
        lifetimeValue: 0,
        outstandingBalance: 0,
        totalInvoices: 0,
      });
    });

    // Then, add invoice data to customers
    invoices.forEach(invoice => {
      if (!invoice.contact?.customer) return;

      const printavoCustomerId = invoice.contact.customer.id;

      // Find customer by printavo_customer_id
      const dbCustomer = databaseCustomers.find(c => c.printavo_customer_id === printavoCustomerId);
      const customerId = dbCustomer?.id || printavoCustomerId;
      const customerName = invoice.contact.customer.companyName || invoice.contact.fullName;

      if (!customersMap.has(customerId)) {
        customersMap.set(customerId, {
          id: customerId,
          name: customerName,
          email: invoice.contact.email,
          invoices: [],
          lifetimeValue: 0,
          outstandingBalance: 0,
          totalInvoices: 0,
        });
      }

      const profile = customersMap.get(customerId)!;
      profile.invoices.push(invoice);
    });

    // Calculate financial metrics
    customersMap.forEach((profile) => {
      profile.lifetimeValue = calculateCustomerLifetimeValue(profile.invoices);
      profile.outstandingBalance = calculateCustomerOutstandingBalance(profile.invoices);
      profile.totalInvoices = profile.invoices.length;
    });

    return Array.from(customersMap.values());
  }, [invoices, databaseCustomers]);

  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = customerProfiles.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'ltv') {
        comparison = a.lifetimeValue - b.lifetimeValue;
      } else if (sortBy === 'balance') {
        comparison = a.outstandingBalance - b.outstandingBalance;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [customerProfiles, searchTerm, sortBy, sortOrder]);

  const selectedCustomer = useMemo(() => {
    return customerProfiles.find(c => c.id === selectedCustomerId);
  }, [customerProfiles, selectedCustomerId]);

  const selectedDatabaseCustomer = useMemo(() => {
    return databaseCustomers.find(c => c.id === selectedCustomerId);
  }, [databaseCustomers, selectedCustomerId]);

  if (loading || loadingCustomers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading customer data...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-200 dark:border-slate-700">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
          <div className="flex gap-2 mb-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              <option value="name">Sort by Name</option>
              <option value="ltv">Sort by LTV</option>
              <option value="balance">Sort by Balance</option>
            </select>
            <button
              onClick={() => setSortOrder(order => order === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 divide-y divide-gray-200 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
          {filteredAndSortedCustomers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No customers found
            </div>
          ) : (
            filteredAndSortedCustomers.map(customer => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomerId(customer.id)}
                className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                  selectedCustomerId === customer.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-full">
                    <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{customer.name}</div>
                    {customer.email && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{customer.email}</div>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{customer.totalInvoices} invoices</span>
                      {customer.lifetimeValue > 0 && (
                        <span>{formatCurrency(customer.lifetimeValue)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selectedCustomer ? (
          <CustomerDetail
            customer={selectedCustomer}
            databaseCustomer={selectedDatabaseCustomer || null}
            onUpdate={loadCustomersFromDatabase}
          />
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-8 text-center text-gray-500 dark:text-gray-400">
            Select a customer to view their profile
          </div>
        )}
      </div>
    </div>
  );
}

interface CustomerDetailProps {
  customer: CustomerProfile;
  databaseCustomer: DatabaseCustomer | null;
  onUpdate: () => void;
}

function CustomerDetail({ customer, databaseCustomer, onUpdate }: CustomerDetailProps) {
  const [fundraisingCredits, setFundraisingCredits] = useState<FundraisingCredit[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isAddingCredit, setIsAddingCredit] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingCreditId, setEditingCreditId] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [showArtworkLibrary, setShowArtworkLibrary] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'quotes'>('invoices');

  const [editedCustomer, setEditedCustomer] = useState<DatabaseCustomer | null>(databaseCustomer);

  const [newCredit, setNewCredit] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    store_name: '',
    batch_number: '',
    amount: ''
  });

  const [newContact, setNewContact] = useState({
    full_name: '',
    title: '',
    email: '',
    phone: '',
    mobile: '',
    is_primary: false,
    notes: ''
  });

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEditedCustomer(databaseCustomer);
    setIsEditingInfo(false);
  }, [databaseCustomer]);

  useEffect(() => {
    async function fetchCompanyId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (data) {
          setCompanyId(data.company_id);
        }
      }
    }
    fetchCompanyId();
  }, []);

  useEffect(() => {
    if (customer.id && companyId) {
      loadFundraisingCredits();
      loadContacts();
      loadQuotes();
      loadCustomerInvoices();
    }
  }, [customer.id, companyId]);

  useEffect(() => {
    if (!customer.id || !companyId) return;

    // Subscribe to quote changes
    const quotesSubscription = supabase
      .channel(`customer-quotes-${customer.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `customer_id=eq.${customer.id}`
        },
        () => {
          loadQuotes();
        }
      )
      .subscribe();

    return () => {
      quotesSubscription.unsubscribe();
    };
  }, [customer.id, companyId]);

  const loadFundraisingCredits = async () => {
    if (!companyId) return;

    const { data, error } = await supabase
      .from('customer_fundraising_credits')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('company_id', companyId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching fundraising credits:', error);
    } else {
      setFundraisingCredits(data || []);
    }
  };

  const loadContacts = async () => {
    const { data, error } = await supabase
      .from('customer_contacts')
      .select('*')
      .eq('customer_id', customer.id)
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('Error fetching contacts:', error);
    } else {
      setContacts(data || []);
    }
  };

  const loadQuotes = async () => {
    if (!companyId) return;

    const { data, error } = await supabase
      .from('quotes')
      .select('id, quote_number, customer_id, status, total_amount, created_at, nickname, delivery_date')
      .eq('customer_id', customer.id)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching quotes:', error);
    } else {
      setQuotes(data || []);
    }
  };

  const loadCustomerInvoices = async () => {
    const { data, error } = await supabase
      .from('printavo_invoices')
      .select('id, invoice_number, customer_name, total, amount_paid, invoice_date, status_stage, updated_at')
      .eq('customer_id', customer.id)
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('Error fetching customer invoices:', error);
    } else {
      setDbInvoices(data || []);
    }
  };

  const totalFundraisingCredits = useMemo(() => {
    return fundraisingCredits.reduce((sum, credit) => sum + parseFloat(credit.amount.toString()), 0);
  }, [fundraisingCredits]);

  const handleCreateCustomerRecord = async () => {
    if (!companyId) {
      alert('Company ID not found');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          id: customer.id,
          company_name: customer.name,
          email: customer.email || null,
          company_id: companyId,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      onUpdate();
      alert('Customer record created successfully');
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Failed to create customer record');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomerInfo = async () => {
    if (!editedCustomer) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          company_name: editedCustomer.company_name,
          contact_name: editedCustomer.contact_name,
          email: editedCustomer.email,
          phone: editedCustomer.phone,
          website: editedCustomer.website,
          billing_address_line1: editedCustomer.billing_address_line1,
          billing_address_line2: editedCustomer.billing_address_line2,
          billing_city: editedCustomer.billing_city,
          billing_state: editedCustomer.billing_state,
          billing_zip: editedCustomer.billing_zip,
          billing_country: editedCustomer.billing_country,
          shipping_address_line1: editedCustomer.shipping_address_line1,
          shipping_address_line2: editedCustomer.shipping_address_line2,
          shipping_city: editedCustomer.shipping_city,
          shipping_state: editedCustomer.shipping_state,
          shipping_zip: editedCustomer.shipping_zip,
          shipping_country: editedCustomer.shipping_country,
          customer_type: editedCustomer.customer_type,
          tax_exempt: editedCustomer.tax_exempt,
          tax_id: editedCustomer.tax_id,
          payment_terms: editedCustomer.payment_terms,
          credit_limit: editedCustomer.credit_limit,
          notes: editedCustomer.notes,
          internal_notes: editedCustomer.internal_notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);

      if (error) throw error;

      setIsEditingInfo(false);
      onUpdate();
      alert('Customer information updated successfully');
    } catch (error) {
      console.error('Error updating customer:', error);
      alert('Failed to update customer information');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!newContact.full_name.trim()) {
      alert('Please enter a contact name');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_contacts')
        .insert([{
          customer_id: customer.id,
          company_id: companyId,
          full_name: newContact.full_name,
          title: newContact.title || null,
          email: newContact.email || null,
          phone: newContact.phone || null,
          mobile: newContact.mobile || null,
          is_primary: newContact.is_primary,
          notes: newContact.notes || null
        }])
        .select()
        .single();

      if (error) throw error;

      setContacts([...contacts, data]);
      setNewContact({
        full_name: '',
        title: '',
        email: '',
        phone: '',
        mobile: '',
        is_primary: false,
        notes: ''
      });
      setIsAddingContact(false);
    } catch (error) {
      console.error('Error adding contact:', error);
      alert('Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('customer_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      setContacts(contacts.filter(c => c.id !== contactId));
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredit = async () => {
    if (!companyId || !newCredit.date || !newCredit.store_name || !newCredit.batch_number || !newCredit.amount) {
      alert('Please fill in all fields');
      return;
    }

    const amount = parseFloat(newCredit.amount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid amount');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('customer_fundraising_credits')
      .insert([{
        customer_id: customer.id,
        company_id: companyId,
        date: newCredit.date,
        store_name: newCredit.store_name,
        batch_number: newCredit.batch_number,
        amount: amount
      }])
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error('Error adding fundraising credit:', error);
      alert('Failed to add fundraising credit');
    } else {
      setFundraisingCredits([data, ...fundraisingCredits]);
      setNewCredit({
        date: format(new Date(), 'yyyy-MM-dd'),
        store_name: '',
        batch_number: '',
        amount: ''
      });
      setIsAddingCredit(false);
    }
  };

  const handleUpdateCredit = async (creditId: string, updates: Partial<FundraisingCredit>) => {
    setLoading(true);

    const { data, error } = await supabase
      .from('customer_fundraising_credits')
      .update(updates)
      .eq('id', creditId)
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error('Error updating fundraising credit:', error);
      alert('Failed to update fundraising credit');
    } else {
      setFundraisingCredits(fundraisingCredits.map(c => c.id === creditId ? data : c));
      setEditingCreditId(null);
    }
  };

  const handleDeleteCredit = async (creditId: string) => {
    if (!confirm('Are you sure you want to delete this fundraising credit entry?')) {
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from('customer_fundraising_credits')
      .delete()
      .eq('id', creditId);

    setLoading(false);

    if (error) {
      console.error('Error deleting fundraising credit:', error);
      alert('Failed to delete fundraising credit');
    } else {
      setFundraisingCredits(fundraisingCredits.filter(c => c.id !== creditId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Action Bar */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <h3 className="text-lg font-bold">Customer Artwork</h3>
            <p className="text-sm text-green-100">View and manage {customer.name}'s artwork files</p>
          </div>
          <button
            onClick={() => setShowArtworkLibrary(true)}
            className="flex items-center gap-2 px-6 py-3 bg-white text-green-600 rounded-lg hover:bg-green-50 transition-colors shadow-lg font-bold text-lg"
          >
            <Image className="w-6 h-6" />
            Open Artwork Library
          </button>
        </div>
      </div>

      {/* Customer Info Header */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-6">
        {!databaseCustomer ? (
          <div className="py-8">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{customer.name}</h2>
              {customer.email && (
                <p className="text-gray-600 dark:text-gray-400">{customer.email}</p>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 mb-4">
              <button
                onClick={() => setShowArtworkLibrary(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                title="View customer artwork library"
              >
                <Image className="w-4 h-4" />
                Artwork Library
              </button>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                This customer exists in your invoices but doesn't have an editable profile yet. Create one to add contacts, addresses, and more details.
              </p>
              <button
                onClick={handleCreateCustomerRecord}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Create Customer Profile
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              {isEditingInfo && editedCustomer ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name *</label>
                    <input
                      type="text"
                      value={editedCustomer.company_name}
                      onChange={(e) => setEditedCustomer({ ...editedCustomer, company_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Name</label>
                      <input
                        type="text"
                        value={editedCustomer.contact_name || ''}
                        onChange={(e) => setEditedCustomer({ ...editedCustomer, contact_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                      <input
                        type="email"
                        value={editedCustomer.email || ''}
                        onChange={(e) => setEditedCustomer({ ...editedCustomer, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                      <input
                        type="text"
                        value={editedCustomer.phone || ''}
                        onChange={(e) => setEditedCustomer({ ...editedCustomer, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website</label>
                      <input
                        type="text"
                        value={editedCustomer.website || ''}
                        onChange={(e) => setEditedCustomer({ ...editedCustomer, website: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveCustomerInfo}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      Save Changes
                    </button>
                    <button
                      onClick={() => {
                        setEditedCustomer(databaseCustomer);
                        setIsEditingInfo(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex flex-col lg:flex-row items-start lg:justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{customer.name}</h2>
                      <div className="mt-2 space-y-1">
                        {databaseCustomer.contact_name && (
                          <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {databaseCustomer.contact_name}
                          </p>
                        )}
                        {databaseCustomer.email && (
                          <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            {databaseCustomer.email}
                          </p>
                        )}
                        {databaseCustomer.phone && (
                          <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            {databaseCustomer.phone}
                          </p>
                        )}
                        {databaseCustomer.website && (
                          <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            <a href={databaseCustomer.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                              {databaseCustomer.website}
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                      <button
                        onClick={() => setShowArtworkLibrary(true)}
                        className="flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-lg"
                        title="View customer artwork library"
                      >
                        <Image className="w-5 h-5" />
                        Artwork Library
                      </button>
                      <button
                        onClick={() => setIsEditingInfo(true)}
                        className="flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                      >
                        <Edit2 className="w-5 h-5" />
                        Edit Info
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isEditingInfo && databaseCustomer && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Lifetime Value</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(customer.lifetimeValue)}
              </div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">Outstanding</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(customer.outstandingBalance)}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">Invoices</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {customer.totalInvoices}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Addresses Section */}
      {!isEditingInfo && databaseCustomer && (databaseCustomer.billing_city || databaseCustomer.shipping_city) && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Addresses
          </h3>
          <div className="grid grid-cols-2 gap-6">
            {databaseCustomer.billing_city && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Billing Address</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {databaseCustomer.billing_address_line1 && <p>{databaseCustomer.billing_address_line1}</p>}
                  {databaseCustomer.billing_address_line2 && <p>{databaseCustomer.billing_address_line2}</p>}
                  <p>
                    {databaseCustomer.billing_city}, {databaseCustomer.billing_state} {databaseCustomer.billing_zip}
                  </p>
                  {databaseCustomer.billing_country && <p>{databaseCustomer.billing_country}</p>}
                </div>
              </div>
            )}
            {databaseCustomer.shipping_city && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Shipping Address</h4>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {databaseCustomer.shipping_address_line1 && <p>{databaseCustomer.shipping_address_line1}</p>}
                  {databaseCustomer.shipping_address_line2 && <p>{databaseCustomer.shipping_address_line2}</p>}
                  <p>
                    {databaseCustomer.shipping_city}, {databaseCustomer.shipping_state} {databaseCustomer.shipping_zip}
                  </p>
                  {databaseCustomer.shipping_country && <p>{databaseCustomer.shipping_country}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contacts Section */}
      {databaseCustomer && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Building className="w-5 h-5" />
              Contacts ({contacts.length})
            </h3>
            {!isAddingContact && (
              <button
                onClick={() => setIsAddingContact(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            )}
          </div>

        <div className="p-4">
          {isAddingContact && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={newContact.full_name}
                    onChange={(e) => setNewContact({ ...newContact, full_name: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                  <input
                    type="text"
                    value={newContact.title}
                    onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={newContact.is_primary}
                    onChange={(e) => setNewContact({ ...newContact, is_primary: e.target.checked })}
                    className="rounded border-gray-300 dark:border-slate-600"
                  />
                  Primary Contact
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddContact}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsAddingContact(false);
                    setNewContact({
                      full_name: '',
                      title: '',
                      email: '',
                      phone: '',
                      mobile: '',
                      is_primary: false,
                      notes: ''
                    });
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No contacts added yet
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {contact.full_name}
                      {contact.is_primary && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">Primary</span>
                      )}
                    </div>
                    {contact.title && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">{contact.title}</div>
                    )}
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
                      {contact.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {contact.email}</div>}
                      {contact.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone}</div>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteContact(contact.id)}
                    className="p-1 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      )}

      {/* Fundraising Credits Section */}
      {databaseCustomer && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-600 dark:text-purple-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Fundraising Credits</h3>
            </div>
            {!isAddingCredit && (
              <button
                onClick={() => setIsAddingCredit(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" />
                Add Credit
              </button>
            )}
          </div>

        <div className="p-4">
          {isAddingCredit && (
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={newCredit.date}
                    onChange={(e) => setNewCredit({ ...newCredit, date: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Store Name</label>
                  <input
                    type="text"
                    value={newCredit.store_name}
                    onChange={(e) => setNewCredit({ ...newCredit, store_name: e.target.value })}
                    placeholder="Store name"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Number</label>
                  <input
                    type="text"
                    value={newCredit.batch_number}
                    onChange={(e) => setNewCredit({ ...newCredit, batch_number: e.target.value })}
                    placeholder="Batch #"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newCredit.amount}
                    onChange={(e) => setNewCredit({ ...newCredit, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddCredit}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsAddingCredit(false);
                    setNewCredit({
                      date: format(new Date(), 'yyyy-MM-dd'),
                      store_name: '',
                      batch_number: '',
                      amount: ''
                    });
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-gray-900 dark:text-white"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {fundraisingCredits.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No fundraising credits recorded yet
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700">
                      <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Date</th>
                      <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Store</th>
                      <th className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Batch</th>
                      <th className="text-right text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Amount</th>
                      <th className="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2">Report</th>
                      <th className="text-right text-xs font-semibold text-gray-600 dark:text-gray-400 pb-2 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {fundraisingCredits.map((credit) => (
                      <FundraisingCreditRow
                        key={credit.id}
                        credit={credit}
                        isEditing={editingCreditId === credit.id}
                        onEdit={() => setEditingCreditId(credit.id)}
                        onSave={(updates) => handleUpdateCredit(credit.id, updates)}
                        onCancel={() => setEditingCreditId(null)}
                        onDelete={() => handleDeleteCredit(credit.id)}
                        loading={loading}
                        companyId={companyId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-end">
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Fundraising Credits</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-500">
                    {formatCurrency(totalFundraisingCredits)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      )}

      {/* Invoices & Quotes Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700">
        {/* Tab Headers */}
        <div className="border-b border-gray-200 dark:border-slate-700">
            <div className="flex">
              <button
                onClick={() => setActiveTab('invoices')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'invoices'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" />
                  Invoice History ({dbInvoices.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab('quotes')}
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'quotes'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Receipt className="w-4 h-4" />
                  Quotes ({quotes.length})
                </div>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="divide-y divide-gray-200 dark:divide-slate-700 max-h-[400px] overflow-y-auto">
            {activeTab === 'invoices' ? (
              dbInvoices.length > 0 ? (
                dbInvoices.map(invoice => {
                  const statusColors: Record<string, string> = {
                    paid: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                    cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                    billing_queue: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
                    accounts_receivable: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                  };
                  return (
                    <div key={invoice.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">{invoice.invoice_number}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[invoice.status_stage] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                              {(invoice.status_stage || '').replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {invoice.invoice_date ? format(parseISO(invoice.invoice_date), 'MMM d, yyyy') : 'N/A'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(parseFloat(invoice.total || 0))}</div>
                          {parseFloat(invoice.amount_paid || 0) > 0 && (
                            <div className="text-sm text-green-600 dark:text-green-400">Paid: {formatCurrency(parseFloat(invoice.amount_paid))}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No invoices found
                </div>
              )
            ) : (
              quotes.length > 0 ? (
                quotes.map(quote => {
                  const statusColors: Record<string, string> = {
                    draft: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
                    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
                    approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                    rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                    converted: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  };

                  return (
                    <div key={quote.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {quote.quote_number}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[quote.status] || statusColors.draft}`}>
                              {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                            </span>
                          </div>
                          {quote.nickname && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {quote.nickname}
                            </div>
                          )}
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Created: {format(parseISO(quote.created_at), 'MMM d, yyyy')}
                            {quote.delivery_date && (
                              <span className="ml-3">
                                Due: {format(parseISO(quote.delivery_date), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(quote.total_amount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No quotes found
                </div>
              )
            )}
          </div>
        </div>

      {/* Artwork Library Modal */}
      {showArtworkLibrary && (
        <CustomerArtworkLibrary
          customerId={customer.id}
          onClose={() => setShowArtworkLibrary(false)}
        />
      )}
    </div>
  );
}

interface FundraisingCreditRowProps {
  credit: FundraisingCredit;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (updates: Partial<FundraisingCredit>) => void;
  onCancel: () => void;
  onDelete: () => void;
  loading: boolean;
  companyId: string | null;
}

function FundraisingCreditRow({ credit, isEditing, onEdit, onSave, onCancel, onDelete, loading, companyId }: FundraisingCreditRowProps) {
  const [editValues, setEditValues] = useState({
    date: credit.date,
    store_name: credit.store_name,
    batch_number: credit.batch_number,
    amount: credit.amount.toString()
  });
  const [uploading, setUploading] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValues({
        date: credit.date,
        store_name: credit.store_name,
        batch_number: credit.batch_number,
        amount: credit.amount.toString()
      });
    }
  }, [isEditing, credit]);

  useEffect(() => {
    if (credit.report_file_path) {
      loadReportUrl();
    }
  }, [credit.report_file_path]);

  const loadReportUrl = async () => {
    if (!credit.report_file_path) return;

    try {
      const { data, error } = await supabase.storage
        .from('fundraising-reports')
        .createSignedUrl(credit.report_file_path, 3600);

      if (error) throw error;
      setReportUrl(data.signedUrl);
    } catch (error) {
      console.error('Error loading report URL:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = 'pdf';
      const fileName = `${companyId}/${credit.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('fundraising-reports')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('customer_fundraising_credits')
        .update({ report_file_path: fileName })
        .eq('id', credit.id);

      if (updateError) throw updateError;

      onSave({ report_file_path: fileName });
      await loadReportUrl();
      alert('Report uploaded successfully!');
    } catch (error) {
      console.error('Error uploading report:', error);
      alert('Failed to upload report');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    const amount = parseFloat(editValues.amount);
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid amount');
      return;
    }

    onSave({
      date: editValues.date,
      store_name: editValues.store_name,
      batch_number: editValues.batch_number,
      amount: amount
    });
  };

  if (isEditing) {
    return (
      <tr className="bg-purple-50 dark:bg-purple-900/20">
        <td className="py-2">
          <input
            type="date"
            value={editValues.date}
            onChange={(e) => setEditValues({ ...editValues, date: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </td>
        <td className="py-2">
          <input
            type="text"
            value={editValues.store_name}
            onChange={(e) => setEditValues({ ...editValues, store_name: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </td>
        <td className="py-2">
          <input
            type="text"
            value={editValues.batch_number}
            onChange={(e) => setEditValues({ ...editValues, batch_number: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </td>
        <td className="py-2">
          <input
            type="number"
            step="0.01"
            min="0"
            value={editValues.amount}
            onChange={(e) => setEditValues({ ...editValues, amount: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent text-right"
          />
        </td>
        <td className="py-2 text-center">
          <div className="flex items-center justify-center gap-1">
            {credit.report_file_path && reportUrl ? (
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-all border border-blue-200 dark:border-blue-800"
                title="View Report"
              >
                <File className="w-3 h-3" />
                <span>View</span>
              </a>
            ) : (
              <label className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded transition-all cursor-pointer border border-purple-200 dark:border-purple-800" title="Upload Report">
                <Upload className="w-3 h-3" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </td>
        <td className="py-2">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={handleSave}
              disabled={loading}
              className="p-1 text-green-600 dark:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
              title="Save"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onCancel}
              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-slate-700">
      <td className="py-2 text-sm text-gray-900 dark:text-white">
        {format(parseISO(credit.date), 'MMM d, yyyy')}
      </td>
      <td className="py-2 text-sm text-gray-900 dark:text-white">{credit.store_name}</td>
      <td className="py-2 text-sm text-gray-900 dark:text-white">{credit.batch_number}</td>
      <td className="py-2 text-sm text-gray-900 dark:text-white text-right font-medium">
        {formatCurrency(parseFloat(credit.amount.toString()))}
      </td>
      <td className="py-2 text-center">
        <div className="flex items-center justify-center gap-1">
          {credit.report_file_path && reportUrl ? (
            <a
              href={reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-all border border-blue-200 dark:border-blue-800"
              title="View Report"
            >
              <File className="w-3 h-3" />
              <span>View</span>
            </a>
          ) : (
            <label className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded transition-all cursor-pointer border border-purple-200 dark:border-purple-800" title="Upload Report">
              <Upload className="w-3 h-3" />
              <span>{uploading ? 'Uploading...' : 'Upload'}</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      </td>
      <td className="py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="p-1 text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

interface CustomerArtworkLibraryProps {
  customerId: string;
  onClose: () => void;
}

interface CustomerArtwork {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  width_inches: number | null;
  height_inches: number | null;
  tags: string[];
  uploaded_at: string;
}

function CustomerArtworkLibrary({ customerId, onClose }: CustomerArtworkLibraryProps) {
  const [artwork, setArtwork] = useState<CustomerArtwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadArtwork();
  }, [customerId]);

  const loadArtwork = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_artwork')
        .select('*')
        .eq('customer_id', customerId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error loading artwork:', error);
        throw error;
      }
      setArtwork(data || []);
    } catch (error) {
      console.error('Failed to load artwork library:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArtwork = async (artworkId: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this artwork? This action cannot be undone.')) {
      return;
    }

    setDeleting(artworkId);
    try {
      // Extract the file path from the URL
      const urlParts = fileUrl.split('/customer-artwork/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split('?')[0];

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('customer-artwork')
          .remove([filePath]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('customer_artwork')
        .delete()
        .eq('id', artworkId);

      if (dbError) {
        throw dbError;
      }

      // Remove from local state
      setArtwork(artwork.filter(a => a.id !== artworkId));
    } catch (error) {
      console.error('Error deleting artwork:', error);
      alert('Failed to delete artwork');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-600">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Customer Artwork Library</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading artwork...</p>
              </div>
            </div>
          ) : artwork.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <File className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
              <p className="text-lg font-medium mb-1">No artwork uploaded yet</p>
              <p className="text-sm">Artwork will appear here once uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {artwork.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-lg p-3 hover:border-blue-500 hover:shadow-lg transition-all relative group"
                >
                  <button
                    onClick={() => handleDeleteArtwork(item.id, item.file_url)}
                    disabled={deleting === item.id}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-all shadow-lg disabled:opacity-50 z-10"
                    title="Delete artwork"
                  >
                    {deleting === item.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  <div className="aspect-square bg-gray-100 dark:bg-slate-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {item.file_type.startsWith('image/') ? (
                      <img
                        src={item.file_url}
                        alt={item.file_name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <File className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={item.file_name}>
                    {item.file_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.width_inches && item.height_inches
                      ? `${item.width_inches}" × ${item.height_inches}"`
                      : 'No dimensions'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(item.uploaded_at).toLocaleDateString()}
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t dark:border-slate-600 bg-gray-50 dark:bg-slate-900 rounded-b-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {artwork.length} {artwork.length === 1 ? 'artwork' : 'artworks'} in library
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
