import { useState, useEffect } from 'react';
import { Users, Search, Plus, CreditCard as Edit, X, Save, Loader2, Trash2, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useAuth } from '../../contexts/AuthContext';

interface Customer {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  billing_city: string | null;
  billing_state: string | null;
  status: string;
  created_at: string;
}

interface Contact {
  id?: string;
  full_name: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  is_primary: boolean;
  notes: string;
}

export function CustomersManager() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');

  const [billAddress1, setBillAddress1] = useState('');
  const [billAddress2, setBillAddress2] = useState('');
  const [billCity, setBillCity] = useState('');
  const [billState, setBillState] = useState('');
  const [billZip, setBillZip] = useState('');

  const [shipAddress1, setShipAddress1] = useState('');
  const [shipAddress2, setShipAddress2] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipZip, setShipZip] = useState('');

  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [notes, setNotes] = useState('');

  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (showForm) {
        setShowForm(false);
        resetForm();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showForm]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      // Get distinct customer IDs that have invoices
      const { data: customerIds, error: idsError } = await supabase
        .from('printavo_invoices')
        .select('customer_id')
        .not('customer_id', 'is', null);

      if (idsError) throw idsError;

      // Extract unique customer IDs
      const uniqueCustomerIds = [...new Set((customerIds || []).map(inv => inv.customer_id).filter(Boolean))];

      if (uniqueCustomerIds.length === 0) {
        setCustomers([]);
        return;
      }

      // Fetch only customers that have invoices
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_name, email, phone, billing_city, billing_state, status, created_at')
        .in('id', uniqueCustomerIds)
        .order('company_name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewCustomer = () => {
    resetForm();
    setEditingCustomer(null);
    setShowForm(true);
  };

  const handleEditCustomer = async (customerId: string) => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (data) {
      setEditingCustomer(data);
      setCompanyName(data.company_name || '');
      setContactName(data.contact_name || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setWebsite(data.website || '');
      setBillAddress1(data.billing_address_line1 || '');
      setBillAddress2(data.billing_address_line2 || '');
      setBillCity(data.billing_city || '');
      setBillState(data.billing_state || '');
      setBillZip(data.billing_zip || '');
      setShipAddress1(data.shipping_address_line1 || '');
      setShipAddress2(data.shipping_address_line2 || '');
      setShipCity(data.shipping_city || '');
      setShipState(data.shipping_state || '');
      setShipZip(data.shipping_zip || '');
      setPaymentTerms(data.payment_terms || 'Net 30');
      setNotes(data.notes || '');

      const { data: contactsData } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false });

      if (contactsData) {
        setContacts(contactsData);
      }

      setShowForm(true);
      window.history.pushState(
        { customerView: 'detail', customerId },
        '',
        `#customers/${customerId}`
      );
    }
  };

  const resetForm = () => {
    setCompanyName('');
    setContactName('');
    setEmail('');
    setPhone('');
    setWebsite('');
    setBillAddress1('');
    setBillAddress2('');
    setBillCity('');
    setBillState('');
    setBillZip('');
    setShipAddress1('');
    setShipAddress2('');
    setShipCity('');
    setShipState('');
    setShipZip('');
    setPaymentTerms('Net 30');
    setNotes('');
    setContacts([]);
  };

  const copyBillingToShipping = () => {
    setShipAddress1(billAddress1);
    setShipAddress2(billAddress2);
    setShipCity(billCity);
    setShipState(billState);
    setShipZip(billZip);
  };

  const addContact = () => {
    setContacts([...contacts, {
      full_name: '',
      title: '',
      email: '',
      phone: '',
      mobile: '',
      is_primary: contacts.length === 0,
      notes: '',
    }]);
  };

  const updateContact = (index: number, field: keyof Contact, value: any) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'is_primary' && value === true) {
      updated.forEach((c, i) => {
        if (i !== index) c.is_primary = false;
      });
    }

    setContacts(updated);
  };

  const removeContact = (index: number) => {
    const updated = contacts.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some(c => c.is_primary)) {
      updated[0].is_primary = true;
    }
    setContacts(updated);
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      alert('Please enter a company name');
      return;
    }

    setSaving(true);
    try {
      const customerData = {
        company_name: companyName,
        contact_name: contactName,
        email: email,
        phone: phone,
        website: website,
        billing_address_line1: billAddress1,
        billing_address_line2: billAddress2,
        billing_city: billCity,
        billing_state: billState,
        billing_zip: billZip,
        shipping_address_line1: shipAddress1,
        shipping_address_line2: shipAddress2,
        shipping_city: shipCity,
        shipping_state: shipState,
        shipping_zip: shipZip,
        payment_terms: paymentTerms,
        notes: notes,
        status: 'active',
        created_by: user?.id,
      };

      let customerId = editingCustomer?.id;

      if (editingCustomer) {
        await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);
      } else {
        const { data, error } = await supabase
          .from('customers')
          .insert([customerData])
          .select()
          .single();

        if (error) throw error;
        customerId = data.id;
      }

      if (customerId) {
        await supabase
          .from('customer_contacts')
          .delete()
          .eq('customer_id', customerId);

        if (contacts.length > 0) {
          const contactsToInsert = contacts
            .filter(c => c.full_name.trim())
            .map(c => ({
              ...c,
              customer_id: customerId,
            }));

          if (contactsToInsert.length > 0) {
            await supabase
              .from('customer_contacts')
              .insert(contactsToInsert);
          }
        }
      }

      alert('Customer saved successfully!');
      setShowForm(false);
      resetForm();
      loadCustomers();
    } catch (err) {
      console.error('Error saving customer:', err);
      alert('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.contact_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (customer.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (showForm) {
    return (
      <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingCustomer ? 'Edit Customer' : 'New Customer'}
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
                window.history.back();
              }}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
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
                  Save Customer
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="ABC Company Inc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Contact Name
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="contact@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="https://company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option>Net 30</option>
                  <option>Net 15</option>
                  <option>Due on Receipt</option>
                  <option>Net 60</option>
                  <option>50% Deposit</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Additional Contacts</h3>
              <button
                onClick={addContact}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            </div>

            {contacts.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No additional contacts added</p>
                <button
                  onClick={addContact}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                >
                  Add your first contact
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {contacts.map((contact, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">Contact {idx + 1}</h4>
                        {contact.is_primary && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                            <Star className="w-3 h-3" />
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={contact.is_primary}
                            onChange={(e) => updateContact(idx, 'is_primary', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          Set as primary
                        </label>
                        <button
                          onClick={() => removeContact(idx)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={contact.full_name}
                          onChange={(e) => updateContact(idx, 'full_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Jane Smith"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={contact.title}
                          onChange={(e) => updateContact(idx, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Sales Manager"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={contact.email}
                          onChange={(e) => updateContact(idx, 'email', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="jane@company.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={contact.phone}
                          onChange={(e) => updateContact(idx, 'phone', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Mobile
                        </label>
                        <input
                          type="tel"
                          value={contact.mobile}
                          onChange={(e) => updateContact(idx, 'mobile', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="(555) 987-6543"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Notes
                        </label>
                        <input
                          type="text"
                          value={contact.notes}
                          onChange={(e) => updateContact(idx, 'notes', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="Additional notes..."
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
              <h3 className="text-lg font-semibold text-gray-900">Addresses</h3>
              <button
                onClick={copyBillingToShipping}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <Users className="w-4 h-4" />
                Copy Billing to Shipping
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Billing Address</h4>
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
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Shipping Address</h4>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Additional notes about this customer..."
            />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage your customer database</p>
        </div>
        <button
          onClick={handleNewCustomer}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search customers by name, contact, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading customers...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No customers found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Add your first customer to get started</p>
          <button
            onClick={handleNewCustomer}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{customer.company_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{customer.contact_name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{customer.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{customer.phone || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {customer.billing_city && customer.billing_state
                        ? `${customer.billing_city}, ${customer.billing_state}`
                        : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => handleEditCustomer(customer.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Edit Customer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
