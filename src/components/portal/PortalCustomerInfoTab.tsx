import { useState, useEffect } from 'react';
import { Building2, User, Mail, Phone, MapPin, CreditCard, Plus, Trash2, Loader2, CreditCard as Edit3, Save, X, Copy, Star, CheckCircle, AlertCircle, Globe } from 'lucide-react';
import { supabaseAnon } from '../../lib/supabase-anon-client';

interface PortalCustomerInfoTabProps {
  customerId: string;
  companyId: string;
}

interface CustomerData {
  company_name: string;
  primary_contact_first_name: string | null;
  primary_contact_last_name: string | null;
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
}

interface Contact {
  id: string;
  full_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  is_primary: boolean;
}

interface PaymentMethod {
  id: string;
  payment_method_type: string;
  last_four: string | null;
  brand: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
}

export function PortalCustomerInfoTab({ customerId, companyId }: PortalCustomerInfoTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [editingBasicInfo, setEditingBasicInfo] = useState(false);
  const [editingBillingAddress, setEditingBillingAddress] = useState(false);
  const [editingShippingAddress, setEditingShippingAddress] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [addingContact, setAddingContact] = useState(false);

  const [formData, setFormData] = useState<Partial<CustomerData>>({});
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    full_name: '',
    title: '',
    email: '',
    phone: '',
    mobile: ''
  });
  const [editContactData, setEditContactData] = useState<Partial<Contact>>({});

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  const loadCustomerData = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: customerData, error: customerError } = await supabaseAnon
        .from('customers')
        .select(`
          company_name,
          primary_contact_first_name,
          primary_contact_last_name,
          contact_name,
          email,
          phone,
          website,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_zip,
          billing_country,
          shipping_address_line1,
          shipping_address_line2,
          shipping_city,
          shipping_state,
          shipping_zip,
          shipping_country
        `)
        .eq('id', customerId)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!customerData) throw new Error('Customer not found');

      setCustomer(customerData);
      setFormData(customerData);

      const { data: contactsData, error: contactsError } = await supabaseAnon
        .from('customer_contacts')
        .select('id, full_name, title, email, phone, mobile, is_primary')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false })
        .order('full_name', { ascending: true });

      if (contactsError) throw contactsError;
      setContacts(contactsData || []);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/customer-payment-methods?customer_id=${customerId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey
          }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setPaymentMethods(result.payment_methods || []);
      }

    } catch (err: any) {
      console.error('Error loading customer data:', err);
      setError(err.message || 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const saveBasicInfo = async () => {
    setSaving(true);
    try {
      const { error } = await supabaseAnon
        .from('customers')
        .update({
          company_name: formData.company_name,
          primary_contact_first_name: formData.primary_contact_first_name,
          primary_contact_last_name: formData.primary_contact_last_name,
          contact_name: `${formData.primary_contact_first_name || ''} ${formData.primary_contact_last_name || ''}`.trim() || null,
          email: formData.email,
          phone: formData.phone,
          website: formData.website
        })
        .eq('id', customerId);

      if (error) throw error;

      setCustomer(prev => prev ? { ...prev, ...formData } : null);
      setEditingBasicInfo(false);
      showSuccess('Customer information updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const saveBillingAddress = async () => {
    setSaving(true);
    try {
      const { error } = await supabaseAnon
        .from('customers')
        .update({
          billing_address_line1: formData.billing_address_line1,
          billing_address_line2: formData.billing_address_line2,
          billing_city: formData.billing_city,
          billing_state: formData.billing_state,
          billing_zip: formData.billing_zip,
          billing_country: formData.billing_country
        })
        .eq('id', customerId);

      if (error) throw error;

      setCustomer(prev => prev ? { ...prev, ...formData } : null);
      setEditingBillingAddress(false);
      showSuccess('Billing address updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to save billing address');
    } finally {
      setSaving(false);
    }
  };

  const saveShippingAddress = async () => {
    setSaving(true);
    try {
      const { error } = await supabaseAnon
        .from('customers')
        .update({
          shipping_address_line1: formData.shipping_address_line1,
          shipping_address_line2: formData.shipping_address_line2,
          shipping_city: formData.shipping_city,
          shipping_state: formData.shipping_state,
          shipping_zip: formData.shipping_zip,
          shipping_country: formData.shipping_country
        })
        .eq('id', customerId);

      if (error) throw error;

      setCustomer(prev => prev ? { ...prev, ...formData } : null);
      setEditingShippingAddress(false);
      showSuccess('Shipping address updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to save shipping address');
    } finally {
      setSaving(false);
    }
  };

  const copyBillingToShipping = () => {
    setFormData(prev => ({
      ...prev,
      shipping_address_line1: prev.billing_address_line1,
      shipping_address_line2: prev.billing_address_line2,
      shipping_city: prev.billing_city,
      shipping_state: prev.billing_state,
      shipping_zip: prev.billing_zip,
      shipping_country: prev.billing_country
    }));
    showSuccess('Billing address copied to shipping');
  };

  const saveContact = async (contactId: string) => {
    setSaving(true);
    try {
      const { error } = await supabaseAnon
        .from('customer_contacts')
        .update({
          full_name: editContactData.full_name,
          title: editContactData.title,
          email: editContactData.email,
          phone: editContactData.phone,
          mobile: editContactData.mobile
        })
        .eq('id', contactId);

      if (error) throw error;

      setContacts(prev => prev.map(c =>
        c.id === contactId
          ? { ...c, ...editContactData } as Contact
          : c
      ));
      setEditingContactId(null);
      setEditContactData({});
      showSuccess('Contact updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const addNewContact = async () => {
    if (!newContact.full_name?.trim()) {
      setError('Contact name is required');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabaseAnon
        .from('customer_contacts')
        .insert({
          customer_id: customerId,
          company_id: companyId,
          full_name: newContact.full_name,
          title: newContact.title || null,
          email: newContact.email || null,
          phone: newContact.phone || null,
          mobile: newContact.mobile || null,
          is_primary: false
        })
        .select()
        .single();

      if (error) throw error;

      setContacts(prev => [...prev, data]);
      setNewContact({ full_name: '', title: '', email: '', phone: '', mobile: '' });
      setAddingContact(false);
      showSuccess('Contact added successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const { error } = await supabaseAnon
        .from('customer_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      setContacts(prev => prev.filter(c => c.id !== contactId));
      showSuccess('Contact deleted successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete contact');
    }
  };

  const setDefaultPaymentMethod = async (methodId: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/customer-payment-methods`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey
          },
          body: JSON.stringify({
            payment_method_id: methodId,
            customer_id: customerId
          })
        }
      );

      if (!response.ok) throw new Error('Failed to set default payment method');

      setPaymentMethods(prev => prev.map(pm => ({
        ...pm,
        is_default: pm.id === methodId
      })));
      showSuccess('Default payment method updated');
    } catch (err: any) {
      setError(err.message || 'Failed to set default payment method');
    }
  };

  const deletePaymentMethod = async (methodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/customer-payment-methods`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey
          },
          body: JSON.stringify({
            payment_method_id: methodId,
            customer_id: customerId
          })
        }
      );

      if (!response.ok) throw new Error('Failed to delete payment method');

      setPaymentMethods(prev => prev.filter(pm => pm.id !== methodId));
      showSuccess('Payment method removed');
    } catch (err: any) {
      setError(err.message || 'Failed to delete payment method');
    }
  };

  const formatAddress = (prefix: 'billing' | 'shipping') => {
    if (!customer) return '';
    const line1 = customer[`${prefix}_address_line1`];
    const line2 = customer[`${prefix}_address_line2`];
    const city = customer[`${prefix}_city`];
    const state = customer[`${prefix}_state`];
    const zip = customer[`${prefix}_zip`];
    const country = customer[`${prefix}_country`];

    const parts = [line1, line2, `${city || ''}${city && state ? ', ' : ''}${state || ''} ${zip || ''}`.trim(), country].filter(Boolean);
    return parts.join('\n');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>
          </div>
          {!editingBasicInfo ? (
            <button
              onClick={() => setEditingBasicInfo(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingBasicInfo(false);
                  setFormData(customer || {});
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={saving}
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={saveBasicInfo}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          )}
        </div>

        <div className="p-6">
          {editingBasicInfo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  value={formData.company_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={formData.primary_contact_first_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, primary_contact_first_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.primary_contact_last_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, primary_contact_last_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500">Company Name</p>
                <p className="text-gray-900 font-medium">{customer?.company_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Primary Contact</p>
                <p className="text-gray-900 font-medium">
                  {[customer?.primary_contact_first_name, customer?.primary_contact_last_name].filter(Boolean).join(' ') || customer?.contact_name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900">{customer?.email || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="text-gray-900">{customer?.phone || '-'}</p>
              </div>
              {customer?.website && (
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Website</p>
                  <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    {customer.website}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Billing Address</h2>
            </div>
            {!editingBillingAddress ? (
              <button
                onClick={() => setEditingBillingAddress(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingBillingAddress(false);
                    setFormData(customer || {});
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={saving}
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={saveBillingAddress}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            )}
          </div>

          <div className="p-6">
            {editingBillingAddress ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.billing_address_line1 || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, billing_address_line1: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.billing_address_line2 || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, billing_address_line2: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.billing_city || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, billing_city: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.billing_state || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, billing_state: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      value={formData.billing_zip || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, billing_zip: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={formData.billing_country || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, billing_country: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-h-[80px]">
                {formatAddress('billing') ? (
                  <p className="text-gray-900 whitespace-pre-line">{formatAddress('billing')}</p>
                ) : (
                  <p className="text-gray-400 italic">No billing address on file</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">Shipping Address</h2>
            </div>
            <div className="flex items-center gap-2">
              {editingShippingAddress && (
                <button
                  onClick={copyBillingToShipping}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy Billing
                </button>
              )}
              {!editingShippingAddress ? (
                <button
                  onClick={() => setEditingShippingAddress(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingShippingAddress(false);
                      setFormData(customer || {});
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    disabled={saving}
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    onClick={saveShippingAddress}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {editingShippingAddress ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={formData.shipping_address_line1 || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_address_line1: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.shipping_address_line2 || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, shipping_address_line2: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.shipping_city || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, shipping_city: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.shipping_state || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, shipping_state: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      value={formData.shipping_zip || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, shipping_zip: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={formData.shipping_country || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, shipping_country: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-h-[80px]">
                {formatAddress('shipping') ? (
                  <p className="text-gray-900 whitespace-pre-line">{formatAddress('shipping')}</p>
                ) : (
                  <p className="text-gray-400 italic">No shipping address on file</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
          </div>
          <button
            onClick={() => setAddingContact(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>

        <div className="p-6">
          {contacts.length === 0 && !addingContact ? (
            <div className="text-center py-8">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No additional contacts</p>
              <p className="text-sm text-gray-400 mt-1">Add contacts to keep track of multiple people at this company</p>
            </div>
          ) : (
            <div className="space-y-4">
              {addingContact && (
                <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-teal-800">New Contact</h4>
                    <button
                      onClick={() => {
                        setAddingContact(false);
                        setNewContact({ full_name: '', title: '', email: '', phone: '', mobile: '' });
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={newContact.full_name || ''}
                      onChange={(e) => setNewContact(prev => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Full Name *"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="text"
                      value={newContact.title || ''}
                      onChange={(e) => setNewContact(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Job Title"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="email"
                      value={newContact.email || ''}
                      onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Email"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="tel"
                      value={newContact.phone || ''}
                      onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Phone"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="tel"
                      value={newContact.mobile || ''}
                      onChange={(e) => setNewContact(prev => ({ ...prev, mobile: e.target.value }))}
                      placeholder="Mobile"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setAddingContact(false);
                        setNewContact({ full_name: '', title: '', email: '', phone: '', mobile: '' });
                      }}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addNewContact}
                      disabled={saving || !newContact.full_name?.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Add Contact
                    </button>
                  </div>
                </div>
              )}

              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {editingContactId === contact.id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <input
                          type="text"
                          value={editContactData.full_name || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, full_name: e.target.value }))}
                          placeholder="Full Name"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={editContactData.title || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Job Title"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="email"
                          value={editContactData.email || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Email"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="tel"
                          value={editContactData.phone || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="Phone"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="tel"
                          value={editContactData.mobile || ''}
                          onChange={(e) => setEditContactData(prev => ({ ...prev, mobile: e.target.value }))}
                          placeholder="Mobile"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingContactId(null);
                            setEditContactData({});
                          }}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveContact(contact.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{contact.full_name}</p>
                            {contact.is_primary && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                <Star className="w-3 h-3" />
                                Primary
                              </span>
                            )}
                          </div>
                          {contact.title && <p className="text-sm text-gray-500">{contact.title}</p>}
                        </div>
                        {contact.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <a href={`mailto:${contact.email}`} className="hover:text-blue-600">{contact.email}</a>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <a href={`tel:${contact.phone}`} className="hover:text-blue-600">{contact.phone}</a>
                          </div>
                        )}
                        {contact.mobile && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <a href={`tel:${contact.mobile}`} className="hover:text-blue-600">{contact.mobile} (mobile)</a>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => {
                            setEditingContactId(contact.id);
                            setEditContactData({
                              full_name: contact.full_name,
                              title: contact.title || '',
                              email: contact.email || '',
                              phone: contact.phone || '',
                              mobile: contact.mobile || ''
                            });
                          }}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {!contact.is_primary && (
                          <button
                            onClick={() => deleteContact(contact.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Payment Methods</h2>
          </div>
        </div>

        <div className="p-6">
          {paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No saved payment methods</p>
              <p className="text-sm text-gray-400 mt-1">
                Payment methods can be added during checkout
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 capitalize">
                          {method.brand || method.payment_method_type} ending in {method.last_four}
                        </p>
                        {method.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                            <Star className="w-3 h-3 fill-current" />
                            Default
                          </span>
                        )}
                      </div>
                      {method.exp_month && method.exp_year && (
                        <p className="text-sm text-gray-500">
                          Expires {method.exp_month}/{method.exp_year}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!method.is_default && (
                      <button
                        onClick={() => setDefaultPaymentMethod(method.id)}
                        className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      onClick={() => deletePaymentMethod(method.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-start gap-3 text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 mb-1">Secure Payment Processing</p>
                <p className="text-blue-700">
                  Your payment information is securely stored by Stripe. We never see or store your
                  full card details. All transactions are encrypted and PCI compliant.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
