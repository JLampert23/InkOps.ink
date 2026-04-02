import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Copy, Upload, Building2, User, Mail, Phone, MapPin, CreditCard, FileText, DollarSign, Loader2, Globe, Key, Send, Link as LinkIcon, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';

interface Contact {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  is_primary?: boolean;
}

interface PaymentMethod {
  id?: string;
  type: 'credit_card' | 'bank_account' | 'check' | 'other';
  name: string;
  lastFour: string;
  expiryMonth: string;
  expiryYear: string;
  bankName: string;
  accountType: 'checking' | 'savings' | '';
  is_primary?: boolean;
}

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId: string;
}

export default function EditCustomerModal({ isOpen, onClose, onSuccess, customerId }: EditCustomerModalProps) {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // General Info
  const [companyName, setCompanyName] = useState('');
  const [primaryFirstName, setPrimaryFirstName] = useState('');
  const [primaryLastName, setPrimaryLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');

  // Billing Address
  const [billingAddress1, setBillingAddress1] = useState('');
  const [billingAddress2, setBillingAddress2] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [billingCountry, setBillingCountry] = useState('USA');

  // Shipping Address
  const [shippingAddress1, setShippingAddress1] = useState('');
  const [shippingAddress2, setShippingAddress2] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingZip, setShippingZip] = useState('');
  const [shippingCountry, setShippingCountry] = useState('USA');

  // Additional Contacts
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null);

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Tax Exemption
  const [isTaxExempt, setIsTaxExempt] = useState(false);
  const [taxId, setTaxId] = useState('');
  const [exemptionType, setExemptionType] = useState('state');
  const [exemptionNumber, setExemptionNumber] = useState('');
  const [exemptionNotes, setExemptionNotes] = useState('');
  const [exemptionId, setExemptionId] = useState<string | null>(null);

  // Payment Terms
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [customTerms, setCustomTerms] = useState('');

  // Notes
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Portal Access
  const [portalAccessEnabled, setPortalAccessEnabled] = useState(false);
  const [hasPasswordSet, setHasPasswordSet] = useState(false);
  const [passwordSetAt, setPasswordSetAt] = useState<string | null>(null);
  const [sendingWelcome, setSendingWelcome] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && customerId) {
      loadCustomerData();
    }
  }, [isOpen, customerId]);

  const loadCustomerData = async () => {
    setLoadingData(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Company not found');
      setCompanyId(profile.company_id);

      // Load customer
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;

      // Populate general info
      setCompanyName(customer.company_name || '');
      setEmail(customer.email || '');
      setPhone(customer.phone || '');
      setWebsite(customer.website || '');

      // Parse contact name
      const contactName = customer.contact_name || '';
      const nameParts = contactName.split(' ');
      setPrimaryFirstName(nameParts[0] || '');
      setPrimaryLastName(nameParts.slice(1).join(' ') || '');

      // Populate addresses
      setBillingAddress1(customer.billing_address_line1 || '');
      setBillingAddress2(customer.billing_address_line2 || '');
      setBillingCity(customer.billing_city || '');
      setBillingState(customer.billing_state || '');
      setBillingZip(customer.billing_zip || '');
      setBillingCountry(customer.billing_country || 'USA');

      setShippingAddress1(customer.shipping_address_line1 || '');
      setShippingAddress2(customer.shipping_address_line2 || '');
      setShippingCity(customer.shipping_city || '');
      setShippingState(customer.shipping_state || '');
      setShippingZip(customer.shipping_zip || '');
      setShippingCountry(customer.shipping_country || 'USA');

      // Tax exemption
      setIsTaxExempt(customer.tax_exempt || false);
      setTaxId(customer.tax_id || '');

      // Payment terms
      const terms = customer.payment_terms || 'Net 30';
      const standardTerms = ['Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];
      if (standardTerms.includes(terms)) {
        setPaymentTerms(terms);
      } else {
        setPaymentTerms('Custom');
        setCustomTerms(terms);
      }

      // Notes
      setNotes(customer.notes || '');
      setInternalNotes(customer.internal_notes || '');

      // Portal Access
      setPortalAccessEnabled(customer.portal_access_enabled || false);
      setHasPasswordSet(!!customer.portal_password_hash);
      setPasswordSetAt(customer.portal_password_set_at || null);

      // Load contacts
      const { data: contactsData } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false });

      if (contactsData) {
        const primaryContact = contactsData.find(c => c.is_primary);
        if (primaryContact) {
          setPrimaryContactId(primaryContact.id);
          const name = primaryContact.full_name || '';
          const parts = name.split(' ');
          setPrimaryFirstName(parts[0] || '');
          setPrimaryLastName(parts.slice(1).join(' ') || '');
          setEmail(primaryContact.email || '');
          setPhone(primaryContact.phone || '');
        }

        const additionalContacts = contactsData.filter(c => !c.is_primary).map(c => {
          const name = c.full_name || '';
          const parts = name.split(' ');
          return {
            id: c.id,
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' ') || '',
            email: c.email || '',
            phone: c.phone || '',
            title: c.title || '',
            is_primary: false
          };
        });
        setContacts(additionalContacts);
      }

      // Load payment methods
      const { data: paymentMethodsData } = await supabase
        .from('customer_payment_methods')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false });

      if (paymentMethodsData) {
        const methods = paymentMethodsData.map(pm => ({
          id: pm.id,
          type: pm.payment_method_type,
          name: pm.name || '',
          lastFour: pm.last_four || '',
          expiryMonth: pm.expiry_month?.toString() || '',
          expiryYear: pm.expiry_year?.toString() || '',
          bankName: pm.bank_name || '',
          accountType: pm.account_type || '',
          is_primary: pm.is_primary
        }));
        setPaymentMethods(methods);
      }

      // Load tax exemption
      if (customer.tax_exempt) {
        const { data: exemptionData } = await supabase
          .from('customer_tax_exemptions')
          .select('*')
          .eq('customer_id', customerId)
          .eq('is_active', true)
          .maybeSingle();

        if (exemptionData) {
          setExemptionId(exemptionData.id);
          setExemptionType(exemptionData.exemption_type || 'state');
          setExemptionNumber(exemptionData.exemption_number || '');
          setExemptionNotes(exemptionData.notes || '');
        }
      }

    } catch (error: any) {
      console.error('Error loading customer:', error);
      showNotification(error.message || 'Failed to load customer data', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const copyBillingToShipping = () => {
    setShippingAddress1(billingAddress1);
    setShippingAddress2(billingAddress2);
    setShippingCity(billingCity);
    setShippingState(billingState);
    setShippingZip(billingZip);
    setShippingCountry(billingCountry);
    showNotification('Billing address copied to shipping address', 'success');
  };

  const addContact = () => {
    setContacts([...contacts, { firstName: '', lastName: '', email: '', phone: '', title: '' }]);
  };

  const removeContact = async (index: number) => {
    const contact = contacts[index];
    if (contact.id) {
      const { error } = await supabase
        .from('customer_contacts')
        .delete()
        .eq('id', contact.id);

      if (error) {
        showNotification('Failed to delete contact', 'error');
        return;
      }
    }
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: keyof Contact, value: string) => {
    const updated = [...contacts];
    updated[index][field] = value;
    setContacts(updated);
  };

  const addPaymentMethod = () => {
    setPaymentMethods([...paymentMethods, {
      type: 'credit_card',
      name: '',
      lastFour: '',
      expiryMonth: '',
      expiryYear: '',
      bankName: '',
      accountType: ''
    }]);
  };

  const removePaymentMethod = async (index: number) => {
    const method = paymentMethods[index];
    if (method.id) {
      const { error } = await supabase
        .from('customer_payment_methods')
        .delete()
        .eq('id', method.id);

      if (error) {
        showNotification('Failed to delete payment method', 'error');
        return;
      }
    }
    setPaymentMethods(paymentMethods.filter((_, i) => i !== index));
  };

  const updatePaymentMethod = (index: number, field: keyof PaymentMethod, value: string) => {
    const updated = [...paymentMethods];
    updated[index][field] = value as any;
    setPaymentMethods(updated);
  };

  const handleSendWelcomeEmail = async () => {
    if (!email) {
      showNotification('Email address is required', 'error');
      return;
    }

    setSendingWelcome(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/send-customer-portal-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          customerId,
          email,
          customerName: `${primaryFirstName} ${primaryLastName}`.trim() || companyName
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showNotification('Welcome email sent successfully!', 'success');
      } else {
        showNotification(result.error || 'Failed to send welcome email', 'error');
      }
    } catch (error) {
      console.error('Error sending welcome email:', error);
      showNotification('Failed to send welcome email', 'error');
    } finally {
      setSendingWelcome(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      showNotification('Email address is required', 'error');
      return;
    }

    setSendingReset(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showNotification('Password reset email sent!', 'success');
      } else {
        showNotification('Failed to send password reset email', 'error');
      }
    } catch (error) {
      console.error('Error sending password reset:', error);
      showNotification('Failed to send password reset email', 'error');
    } finally {
      setSendingReset(false);
    }
  };

  const copyPortalLink = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.company_id) return;

      const { data: settings } = await supabase
        .from('company_settings')
        .select('inkops_subdomain, customer_url')
        .eq('id', profile.company_id)
        .maybeSingle();

      const portalUrl = settings?.customer_url ||
                        (settings?.inkops_subdomain ? `https://${settings.inkops_subdomain}.inkops.io/portal` : '') ||
                        `${window.location.origin}/portal/login`;

      await navigator.clipboard.writeText(portalUrl);
      showNotification('Portal link copied to clipboard!', 'success');
    } catch (error) {
      console.error('Error copying portal link:', error);
      showNotification('Failed to copy portal link', 'error');
    }
  };

  const validateForm = () => {
    if (!companyName.trim()) {
      showNotification('Company name is required', 'error');
      return false;
    }
    if (!primaryFirstName.trim() || !primaryLastName.trim()) {
      showNotification('Primary contact name is required', 'error');
      return false;
    }
    if (!email.trim()) {
      showNotification('Email is required', 'error');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showNotification('Please enter a valid email address', 'error');
      return false;
    }
    if (!billingAddress1.trim()) {
      showNotification('Billing address is required', 'error');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !companyId) return;

    setLoading(true);
    try {
      const finalPaymentTerms = paymentTerms === 'Custom' ? customTerms : paymentTerms;

      // Update customer
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          company_name: companyName,
          contact_name: `${primaryFirstName} ${primaryLastName}`,
          email: email,
          phone: phone,
          website: website,
          billing_address_line1: billingAddress1,
          billing_address_line2: billingAddress2,
          billing_city: billingCity,
          billing_state: billingState,
          billing_zip: billingZip,
          billing_country: billingCountry,
          shipping_address_line1: shippingAddress1,
          shipping_address_line2: shippingAddress2,
          shipping_city: shippingCity,
          shipping_state: shippingState,
          shipping_zip: shippingZip,
          shipping_country: shippingCountry,
          tax_exempt: isTaxExempt,
          tax_id: taxId,
          payment_terms: finalPaymentTerms,
          notes: notes,
          internal_notes: internalNotes,
          portal_access_enabled: portalAccessEnabled
        })
        .eq('id', customerId);

      if (customerError) throw customerError;

      // Update primary contact
      if (primaryContactId) {
        const { error: primaryContactError } = await supabase
          .from('customer_contacts')
          .update({
            full_name: `${primaryFirstName} ${primaryLastName}`,
            email: email,
            phone: phone
          })
          .eq('id', primaryContactId);

        if (primaryContactError) throw primaryContactError;
      }

      // Handle additional contacts
      for (const contact of contacts) {
        if (contact.firstName && contact.lastName) {
          if (contact.id) {
            // Update existing contact
            const { error } = await supabase
              .from('customer_contacts')
              .update({
                full_name: `${contact.firstName} ${contact.lastName}`,
                email: contact.email,
                phone: contact.phone,
                title: contact.title
              })
              .eq('id', contact.id);

            if (error) throw error;
          } else {
            // Insert new contact
            const { error } = await supabase
              .from('customer_contacts')
              .insert({
                customer_id: customerId,
                company_id: companyId,
                full_name: `${contact.firstName} ${contact.lastName}`,
                email: contact.email,
                phone: contact.phone,
                title: contact.title,
                is_primary: false
              });

            if (error) throw error;
          }
        }
      }

      // Handle payment methods
      for (const method of paymentMethods) {
        if (method.name) {
          if (method.id) {
            // Update existing payment method
            const { error } = await supabase
              .from('customer_payment_methods')
              .update({
                payment_method_type: method.type,
                name: method.name,
                last_four: method.lastFour,
                expiry_month: method.expiryMonth ? parseInt(method.expiryMonth) : null,
                expiry_year: method.expiryYear ? parseInt(method.expiryYear) : null,
                bank_name: method.bankName,
                account_type: method.accountType || null
              })
              .eq('id', method.id);

            if (error) throw error;
          } else {
            // Insert new payment method
            const { error } = await supabase
              .from('customer_payment_methods')
              .insert({
                customer_id: customerId,
                company_id: companyId,
                payment_method_type: method.type,
                name: method.name,
                last_four: method.lastFour,
                expiry_month: method.expiryMonth ? parseInt(method.expiryMonth) : null,
                expiry_year: method.expiryYear ? parseInt(method.expiryYear) : null,
                bank_name: method.bankName,
                account_type: method.accountType || null,
                is_primary: false
              });

            if (error) throw error;
          }
        }
      }

      // Handle tax exemption
      if (isTaxExempt) {
        if (exemptionId) {
          // Update existing exemption
          const { error } = await supabase
            .from('customer_tax_exemptions')
            .update({
              exemption_type: exemptionType,
              tax_id: taxId,
              exemption_number: exemptionNumber,
              notes: exemptionNotes
            })
            .eq('id', exemptionId);

          if (error) throw error;
        } else {
          // Create new exemption
          const { error } = await supabase
            .from('customer_tax_exemptions')
            .insert({
              customer_id: customerId,
              company_id: companyId,
              exemption_type: exemptionType,
              tax_id: taxId,
              exemption_number: exemptionNumber,
              notes: exemptionNotes,
              is_active: true
            });

          if (error) throw error;
        }
      } else if (exemptionId) {
        // Deactivate exemption if tax exempt is now false
        const { error } = await supabase
          .from('customer_tax_exemptions')
          .update({ is_active: false })
          .eq('id', exemptionId);

        if (error) throw error;
      }

      showNotification(`Customer "${companyName}" updated successfully!`, 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating customer:', error);
      showNotification(error.message || 'Failed to update customer', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Customer</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Update customer information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* SECTION: GENERAL */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-slate-700">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">General Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Primary Contact First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={primaryFirstName}
                      onChange={(e) => setPrimaryFirstName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="First name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Primary Contact Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={primaryLastName}
                      onChange={(e) => setPrimaryLastName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Last name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website</label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: BILLING ADDRESS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-slate-700">
                  <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Billing Address</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Address Line 1 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={billingAddress1}
                      onChange={(e) => setBillingAddress1(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Street address"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={billingAddress2}
                      onChange={(e) => setBillingAddress2(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Apartment, suite, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                    <input
                      type="text"
                      value={billingCity}
                      onChange={(e) => setBillingCity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                    <input
                      type="text"
                      value={billingState}
                      onChange={(e) => setBillingState(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="State"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      value={billingZip}
                      onChange={(e) => setBillingZip(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ZIP"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country</label>
                    <input
                      type="text"
                      value={billingCountry}
                      onChange={(e) => setBillingCountry(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: SHIPPING ADDRESS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Shipping Address</h3>
                  </div>
                  <button
                    type="button"
                    onClick={copyBillingToShipping}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy from Billing
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={shippingAddress1}
                      onChange={(e) => setShippingAddress1(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Street address"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={shippingAddress2}
                      onChange={(e) => setShippingAddress2(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Apartment, suite, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                    <input
                      type="text"
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                    <input
                      type="text"
                      value={shippingState}
                      onChange={(e) => setShippingState(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="State"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ZIP Code</label>
                    <input
                      type="text"
                      value={shippingZip}
                      onChange={(e) => setShippingZip(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="ZIP"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country</label>
                    <input
                      type="text"
                      value={shippingCountry}
                      onChange={(e) => setShippingCountry(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: ADDITIONAL CONTACTS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-600 dark:text-purple-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Contacts</h3>
                  </div>
                  <button
                    type="button"
                    onClick={addContact}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Contact
                  </button>
                </div>

                {contacts.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">No additional contacts added yet.</p>
                ) : (
                  <div className="space-y-4">
                    {contacts.map((contact, index) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Contact {index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeContact(index)}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={contact.firstName}
                            onChange={(e) => updateContact(index, 'firstName', e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="First name"
                          />
                          <input
                            type="text"
                            value={contact.lastName}
                            onChange={(e) => updateContact(index, 'lastName', e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Last name"
                          />
                          <input
                            type="text"
                            value={contact.title}
                            onChange={(e) => updateContact(index, 'title', e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Title"
                          />
                          <input
                            type="email"
                            value={contact.email}
                            onChange={(e) => updateContact(index, 'email', e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Email"
                          />
                          <input
                            type="tel"
                            value={contact.phone}
                            onChange={(e) => updateContact(index, 'phone', e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Phone"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: PAYMENT METHODS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-green-600 dark:text-green-500" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Methods</h3>
                  </div>
                  <button
                    type="button"
                    onClick={addPaymentMethod}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Payment Method
                  </button>
                </div>

                {paymentMethods.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">No payment methods added yet.</p>
                ) : (
                  <div className="space-y-4">
                    {paymentMethods.map((method, index) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method {index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removePaymentMethod(index)}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <select
                            value={method.type}
                            onChange={(e) => updatePaymentMethod(index, 'type', e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="credit_card">Credit Card</option>
                            <option value="bank_account">Bank Account</option>
                            <option value="check">Check</option>
                            <option value="other">Other</option>
                          </select>
                          <input
                            type="text"
                            value={method.name}
                            onChange={(e) => updatePaymentMethod(index, 'name', e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Name (e.g., Visa ending in 1234)"
                          />

                          {method.type === 'credit_card' && (
                            <>
                              <input
                                type="text"
                                value={method.lastFour}
                                onChange={(e) => updatePaymentMethod(index, 'lastFour', e.target.value)}
                                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Last 4 digits"
                                maxLength={4}
                              />
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={method.expiryMonth}
                                  onChange={(e) => updatePaymentMethod(index, 'expiryMonth', e.target.value)}
                                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="MM"
                                  maxLength={2}
                                />
                                <input
                                  type="text"
                                  value={method.expiryYear}
                                  onChange={(e) => updatePaymentMethod(index, 'expiryYear', e.target.value)}
                                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="YYYY"
                                  maxLength={4}
                                />
                              </div>
                            </>
                          )}

                          {method.type === 'bank_account' && (
                            <>
                              <input
                                type="text"
                                value={method.bankName}
                                onChange={(e) => updatePaymentMethod(index, 'bankName', e.target.value)}
                                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Bank name"
                              />
                              <select
                                value={method.accountType}
                                onChange={(e) => updatePaymentMethod(index, 'accountType', e.target.value)}
                                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select account type</option>
                                <option value="checking">Checking</option>
                                <option value="savings">Savings</option>
                              </select>
                              <input
                                type="text"
                                value={method.lastFour}
                                onChange={(e) => updatePaymentMethod(index, 'lastFour', e.target.value)}
                                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Last 4 digits"
                                maxLength={4}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: TAX EXEMPTIONS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-slate-700">
                  <FileText className="w-5 h-5 text-red-600 dark:text-red-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tax Exemption</h3>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTaxExempt}
                    onChange={(e) => setIsTaxExempt(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">This customer is tax exempt</span>
                </label>

                {isTaxExempt && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exemption Type</label>
                      <select
                        value={exemptionType}
                        onChange={(e) => setExemptionType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="federal">Federal</option>
                        <option value="state">State</option>
                        <option value="local">Local</option>
                        <option value="reseller">Reseller</option>
                        <option value="nonprofit">Non-Profit</option>
                        <option value="government">Government</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax ID / EIN</label>
                      <input
                        type="text"
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="XX-XXXXXXX"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exemption Certificate Number</label>
                      <input
                        type="text"
                        value={exemptionNumber}
                        onChange={(e) => setExemptionNumber(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Certificate number"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <textarea
                        value={exemptionNotes}
                        onChange={(e) => setExemptionNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Additional notes about tax exemption"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: PAYMENT TERMS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-slate-700">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Default Payment Terms</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Terms</label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Due on Receipt">Due on Receipt</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 45">Net 45</option>
                      <option value="Net 60">Net 60</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  {paymentTerms === 'Custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custom Terms</label>
                      <input
                        type="text"
                        value={customTerms}
                        onChange={(e) => setCustomTerms(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter custom payment terms"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION: PORTAL ACCESS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-slate-700">
                  <Globe className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Customer Portal Access</h3>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={portalAccessEnabled}
                      onChange={(e) => setPortalAccessEnabled(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable portal access for this customer</span>
                  </label>

                  {portalAccessEnabled && (
                    <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">Password Status</h4>
                          <div className="flex items-center gap-2">
                            {hasPasswordSet ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  Password set {passwordSetAt && `on ${format(new Date(passwordSetAt), 'MMM d, yyyy')}`}
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">No password set</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={handleSendWelcomeEmail}
                          disabled={sendingWelcome || !email}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {sendingWelcome ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Send Welcome Email
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={copyPortalLink}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                        >
                          <LinkIcon className="w-4 h-4" />
                          Copy Portal Link
                        </button>

                        {hasPasswordSet && (
                          <button
                            type="button"
                            onClick={handleResetPassword}
                            disabled={sendingReset || !email}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            {sendingReset ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Key className="w-4 h-4" />
                                Send Password Reset
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                          When enabled, customers can log in to view their invoices, quotes, proofs, and order history.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION: NOTES */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-slate-700">
                  <FileText className="w-5 h-5 text-gray-600 dark:text-gray-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Notes visible to customer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Internal Notes</label>
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Internal notes (not visible to customer)"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || loadingData}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Building2 className="w-4 h-4" />
                Update Customer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
