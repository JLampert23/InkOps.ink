import { useState, useEffect, lazy, Suspense } from 'react';
import { Building2, User, Shield, Save, Loader2, Plus, Trash2, Filter, Upload, CreditCard as Edit, Key, Clock, Layers, Zap, CreditCard, ChevronDown, ChevronUp, Settings as SettingsIcon, Link as LinkIcon, RefreshCw, Bug, MessageSquare, Eye, EyeOff, Grid3x3, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import AutomatedReports from './automation/AutomatedReports';

const WorkflowCustomization = lazy(() => import('./production/WorkflowCustomization').then(m => ({ default: m.WorkflowCustomization })));
const AutomationsDashboard = lazy(() => import('./automations/AutomationsDashboard').then(m => ({ default: m.AutomationsDashboard })));
const StripePayments = lazy(() => import('./production/StripePayments').then(m => ({ default: m.StripePayments })));
const PriceMatricesManager = lazy(() => import('./production/PriceMatricesManager').then(m => ({ default: m.PriceMatricesManager })));
const InkThreadColorsManager = lazy(() => import('./production/InkThreadColorsManager').then(m => ({ default: m.InkThreadColorsManager })));

interface CompanySettings {
  id: string;
  company_name: string;
  logo_url: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_logo_primary_url: string | null;
  company_logo_secondary_url: string | null;
  available_invoice_statuses: string[];
  selected_invoice_statuses: string[];
  billing_selected_invoice_statuses: string[];
  printavo_username: string | null;
  printavo_api_token_encrypted: string | null;
  resend_api_key: string | null;
  stripe_public_key: string | null;
  stripe_secret_key: string | null;
  stripe_webhook_secret: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

interface PrintavoStatus {
  id: string;
  name: string;
  color: string | null;
  position: number;
  type: string | null;
  is_billing_eligible: boolean;
}

interface InvoiceFee {
  id: string;
  company_id: string;
  fee_name: string;
  description: string;
  amount: number;
  amount_type: 'dollar' | 'percent';
  is_taxed: boolean;
  show_by_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DecorationLocation {
  id: string;
  company_id: string;
  decoration_name: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ColorStitchOption {
  id: string;
  company_id: string;
  option_label: string;
  option_value: string;
  option_type: 'color' | 'stitch' | 'other';
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TypeOfWork {
  id: string;
  company_id: string;
  work_type_name: string;
  color_type: 'ink' | 'thread' | 'none';
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type SettingsTab =
  | 'company-info' | 'quote-invoice-settings'
  | 'printavo-integration' | 'square-integration' | 'resend-integration' | 'twilio-integration' | 'stripe-payments'
  | 'user-management' | 'user-security'
  | 'billing-status-filters'
  | 'automated-reports' | 'workflow-setup' | 'automations'
  | 'production-general' | 'invoice-fees' | 'price-matrices';

interface AccountSettingsProps {
  initialTab?: SettingsTab;
  canAccessIntegrations?: boolean;
}

export function AccountSettings({ initialTab, canAccessIntegrations = true }: AccountSettingsProps = {}) {
  const { user } = useAuth();
  const { showNotification, confirm } = useNotification();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'company-info');
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  const [integrationsExpanded, setIntegrationsExpanded] = useState(false);
  const [productionExpanded, setProductionExpanded] = useState(false);
  const [accountingExpanded, setAccountingExpanded] = useState(false);
  const [companySettingsExpanded, setCompanySettingsExpanded] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [primaryLogoFile, setPrimaryLogoFile] = useState<File | null>(null);
  const [primaryLogoPreview, setPrimaryLogoPreview] = useState<string | null>(null);
  const [secondaryLogoFile, setSecondaryLogoFile] = useState<File | null>(null);
  const [secondaryLogoPreview, setSecondaryLogoPreview] = useState<string | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);

  const [printavoUsername, setPrintavoUsername] = useState('');
  const [printavoToken, setPrintavoToken] = useState('');
  const [showPrintavoToken, setShowPrintavoToken] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testData, setTestData] = useState<any>(null);

  const [squareAccessToken, setSquareAccessToken] = useState('');
  const [showSquareToken, setShowSquareToken] = useState(false);
  const [squareApplicationId, setSquareApplicationId] = useState('');
  const [squareLocationId, setSquareLocationId] = useState('');
  const [squareEnvironment, setSquareEnvironment] = useState('production');
  const [savingSquare, setSavingSquare] = useState(false);
  const [testingSquare, setTestingSquare] = useState(false);
  const [squareTestResult, setSquareTestResult] = useState<any>(null);

  const [resendApiKey, setResendApiKey] = useState('');
  const [showResendKey, setShowResendKey] = useState(false);
  const [emailFromAddress, setEmailFromAddress] = useState('');
  const [savingResend, setSavingResend] = useState(false);
  const [testingResend, setTestingResend] = useState(false);
  const [resendTestResult, setResendTestResult] = useState<any>(null);

  const [stripePublicKey, setStripePublicKey] = useState('');
  const [showStripePublicKey, setShowStripePublicKey] = useState(false);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [showStripeSecretKey, setShowStripeSecretKey] = useState(false);
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [showStripeWebhookSecret, setShowStripeWebhookSecret] = useState(false);
  const [savingStripe, setSavingStripe] = useState(false);
  const [testingStripe, setTestingStripe] = useState(false);
  const [stripeTestResult, setStripeTestResult] = useState<any>(null);

  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [showTwilioSid, setShowTwilioSid] = useState(false);
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [defaultSendMethod, setDefaultSendMethod] = useState('email');
  const [smsMessageTemplate, setSmsMessageTemplate] = useState('Hi {CustomerName}, your invoice {InvoiceNumber} is ready. Amount Due: ${Amount}. Pay here: {PaymentLink}. Reply STOP to unsubscribe.');
  const [savingTwilio, setSavingTwilio] = useState(false);
  const [testingTwilio, setTestingTwilio] = useState(false);
  const [twilioTestResult, setTwilioTestResult] = useState<any>(null);

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('admin');
  const [addingUser, setAddingUser] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserEmail, setEditingUserEmail] = useState('');
  const [editingUserName, setEditingUserName] = useState('');
  const [editingUserRole, setEditingUserRole] = useState('admin');
  const [editingUserPassword, setEditingUserPassword] = useState('');
  const [editingUserPasswordConfirm, setEditingUserPasswordConfirm] = useState('');
  const [updatingUser, setUpdatingUser] = useState(false);

  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [savingStatuses, setSavingStatuses] = useState(false);
  const [syncingStatuses, setSyncingStatuses] = useState(false);
  const [syncingPrintavoData, setSyncingPrintavoData] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const [billingSelectedStatuses, setBillingSelectedStatuses] = useState<string[]>([]);
  const [savingBillingStatuses, setSavingBillingStatuses] = useState(false);

  const [fullStatuses, setFullStatuses] = useState<PrintavoStatus[]>([]);
  const [pendingBillingChanges, setPendingBillingChanges] = useState<Map<string, boolean>>(new Map());
  const [savingBillingFilters, setSavingBillingFilters] = useState(false);
  const [billingFiltersSaveMessage, setBillingFiltersSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [unlockPin, setUnlockPin] = useState('');
  const [unlockPinConfirm, setUnlockPinConfirm] = useState('');

  const [invoiceFees, setInvoiceFees] = useState<InvoiceFee[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [showAddFeeModal, setShowAddFeeModal] = useState(false);
  const [showBulkAddFeesModal, setShowBulkAddFeesModal] = useState(false);
  const [bulkFeesText, setBulkFeesText] = useState('');
  const [savingBulkFees, setSavingBulkFees] = useState(false);
  const [feeFormData, setFeeFormData] = useState({
    fee_name: '',
    description: '',
    amount: '',
    amount_type: 'dollar' as 'dollar' | 'percent',
    is_taxed: false,
    show_by_default: false,
  });
  const [savingFee, setSavingFee] = useState(false);

  const [decorationLocations, setDecorationLocations] = useState<DecorationLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [showBulkAddLocationsModal, setShowBulkAddLocationsModal] = useState(false);
  const [bulkLocationsText, setBulkLocationsText] = useState('');
  const [savingBulkLocations, setSavingBulkLocations] = useState(false);
  const [locationFormData, setLocationFormData] = useState({
    decoration_name: '',
    address: '',
  });
  const [savingLocation, setSavingLocation] = useState(false);

  const [workTypes, setWorkTypes] = useState<TypeOfWork[]>([]);
  const [loadingWorkTypes, setLoadingWorkTypes] = useState(false);
  const [editingWorkTypeId, setEditingWorkTypeId] = useState<string | null>(null);
  const [showAddWorkTypeModal, setShowAddWorkTypeModal] = useState(false);
  const [showBulkAddWorkTypesModal, setShowBulkAddWorkTypesModal] = useState(false);
  const [bulkWorkTypesText, setBulkWorkTypesText] = useState('');
  const [bulkWorkTypeColorType, setBulkWorkTypeColorType] = useState<'ink' | 'thread' | 'none'>('ink');
  const [savingBulkWorkTypes, setSavingBulkWorkTypes] = useState(false);
  const [workTypeFormData, setWorkTypeFormData] = useState({
    work_type_name: '',
    color_type: 'ink' as 'ink' | 'thread' | 'none',
  });
  const [savingWorkType, setSavingWorkType] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [pinSaveMessage, setPinSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [useNumberPrefix, setUseNumberPrefix] = useState(false);
  const [numberStartNumber, setNumberStartNumber] = useState(1);
  const [savingNumberSettings, setSavingNumberSettings] = useState(false);

  const [colorStitchOptions, setColorStitchOptions] = useState<ColorStitchOption[]>([]);
  const [loadingColorStitch, setLoadingColorStitch] = useState(false);
  const [editingColorStitchId, setEditingColorStitchId] = useState<string | null>(null);
  const [showAddColorStitchModal, setShowAddColorStitchModal] = useState(false);
  const [colorStitchFormData, setColorStitchFormData] = useState({
    option_label: '',
    option_value: '',
    option_type: 'color' as 'color' | 'stitch' | 'other',
  });
  const [savingColorStitch, setSavingColorStitch] = useState(false);

  useEffect(() => {
    loadSettings();
    loadUsers();
    loadAvailableStatuses();
    loadStatusesFromDatabase();
    loadInvoiceFees();
    loadDecorationLocations();
    loadWorkTypes();
    loadColorStitchOptions();
  }, []);

  useEffect(() => {
    const integrationTabs: SettingsTab[] = [
      'printavo-integration',
      'square-integration',
      'resend-integration',
      'twilio-integration',
      'stripe-payments'
    ];

    if (!canAccessIntegrations && integrationTabs.includes(activeTab)) {
      setActiveTab('company-info');
    }
  }, [activeTab, canAccessIntegrations]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setCompanySettings(data);
        setCompanyName(data.company_name);
        setCompanyAddress(data.company_address || '');
        setCompanyPhone(data.company_phone || '');
        setCompanyEmail(data.company_email || '');
        setLogoPreview(data.logo_url);
        setPrimaryLogoPreview(data.company_logo_primary_url);
        setSecondaryLogoPreview(data.company_logo_secondary_url);
        setAvailableStatuses(data.available_invoice_statuses || []);
        setSelectedStatuses(data.selected_invoice_statuses || []);
        setBillingSelectedStatuses(data.billing_selected_invoice_statuses || []);
        setPrintavoUsername(data.printavo_username || '');
        setSquareEnvironment(data.square_environment || 'production');
        setEmailFromAddress(data.email_from_address || '');
        setStripePublicKey(data.stripe_public_key || '');
        setStripeSecretKey(data.stripe_secret_key || '');
        setStripeWebhookSecret(data.stripe_webhook_secret || '');
        setTwilioPhoneNumber(data.twilio_phone_number || '');
        setTwilioEnabled(data.twilio_enabled || false);
        setDefaultSendMethod(data.default_send_method || 'email');
        setSmsMessageTemplate(data.sms_message_template || 'Hi {CustomerName}, your invoice {InvoiceNumber} is ready. Amount Due: ${Amount}. Pay here: {PaymentLink}. Reply STOP to unsubscribe.');
        setUseNumberPrefix(data.use_number_prefix || false);
        setNumberStartNumber(data.number_start_number || 1);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);

      const currentProfile = data?.find(u => u.id === user?.id);
      if (currentProfile) {
        setCurrentUserProfile(currentProfile);
        setHasExistingPin(!!currentProfile.unlock_pin_hash);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const saveUnlockPin = async () => {
    if (!user) return;

    if (!unlockPin || unlockPin.length < 4) {
      setPinSaveMessage({ type: 'error', text: 'PIN must be at least 4 characters' });
      return;
    }

    if (unlockPin !== unlockPinConfirm) {
      setPinSaveMessage({ type: 'error', text: 'PINs do not match' });
      return;
    }

    if (hasExistingPin && !currentPin) {
      setPinSaveMessage({ type: 'error', text: 'Please enter your current PIN to change it' });
      return;
    }

    setSavingPin(true);
    setPinSaveMessage(null);

    try {
      if (hasExistingPin) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('unlock_pin_hash')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          const currentPinHash = await hashPin(currentPin);
          if (currentPinHash !== profile.unlock_pin_hash) {
            setPinSaveMessage({ type: 'error', text: 'Current PIN is incorrect' });
            setSavingPin(false);
            return;
          }
        }
      }

      const pinHash = await hashPin(unlockPin);

      const { error } = await supabase
        .from('user_profiles')
        .update({ unlock_pin_hash: pinHash })
        .eq('id', user.id);

      if (error) throw error;

      setPinSaveMessage({ type: 'success', text: hasExistingPin ? 'PIN updated successfully' : 'PIN set successfully' });
      setUnlockPin('');
      setUnlockPinConfirm('');
      setCurrentPin('');
      setHasExistingPin(true);
      await loadUsers();
    } catch (err) {
      console.error('Error saving PIN:', err);
      setPinSaveMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save PIN' });
    } finally {
      setSavingPin(false);
    }
  };

  const saveNumberingSettings = async () => {
    if (!companySettings?.id) {
      showNotification('error', 'No Company Settings', 'Please set up company settings first.');
      return;
    }

    if (numberStartNumber < 1) {
      showNotification('warning', 'Invalid Start Number', 'Start number must be at least 1.');
      return;
    }

    try {
      setSavingNumberSettings(true);

      const { error } = await supabase
        .from('company_settings')
        .update({
          use_number_prefix: useNumberPrefix,
          number_start_number: numberStartNumber,
          next_number: numberStartNumber,
        })
        .eq('id', companySettings.id);

      if (error) throw error;

      showNotification('success', 'Settings Saved', 'Quote/Invoice numbering settings have been updated successfully!');
      await loadSettings();
    } catch (err) {
      console.error('Error saving numbering settings:', err);
      showNotification('error', 'Save Failed', err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingNumberSettings(false);
    }
  };

  const loadAvailableStatuses = async (): Promise<string[]> => {
    try {
      setLoadingStatuses(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Session not ready yet, silently skip
        return [];
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/printavo-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Printavo API error:', response.status);
        console.error('Error details:', JSON.stringify(errorData, null, 2));
        console.warn('Could not fetch statuses from Printavo API, falling back to local data');
        const { data, error } = await supabase
          .from('printavo_invoices_calculated')
          .select('status')
          .not('status', 'is', null);

        if (error) throw error;

        const uniqueStatuses = Array.from(
          new Set(data?.map(item => item.status).filter(status => status && status.trim() !== '') || [])
        ).sort();

        setAvailableStatuses(uniqueStatuses);
        return uniqueStatuses;
      }

      const result = await response.json();

      if (result.success && result.statuses) {
        setAvailableStatuses(result.statuses);
        return result.statuses;
      } else {
        const { data, error } = await supabase
          .from('printavo_invoices_calculated')
          .select('status')
          .not('status', 'is', null);

        if (error) throw error;

        const uniqueStatuses = Array.from(
          new Set(data?.map(item => item.status).filter(status => status && status.trim() !== '') || [])
        ).sort();

        setAvailableStatuses(uniqueStatuses);
        return uniqueStatuses;
      }
    } catch (err) {
      console.error('Error loading statuses:', err);
      try {
        const { data, error } = await supabase
          .from('printavo_invoices_calculated')
          .select('status')
          .not('status', 'is', null);

        if (!error) {
          const uniqueStatuses = Array.from(
            new Set(data?.map(item => item.status).filter(status => status && status.trim() !== '') || [])
          ).sort();
          setAvailableStatuses(uniqueStatuses);
          return uniqueStatuses;
        }
      } catch (fallbackErr) {
        console.error('Fallback status loading also failed:', fallbackErr);
      }
      return [];
    } finally {
      setLoadingStatuses(false);
    }
  };

  const loadStatusesFromDatabase = async () => {
    try {
      const { data, error } = await supabase
        .from('printavo_statuses')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setFullStatuses(data);
        const billingEligible = data
          .filter(s => s.is_billing_eligible)
          .map(s => s.name);
        setBillingSelectedStatuses(billingEligible);
        const allNames = data.map(s => s.name);
        if (availableStatuses.length === 0) {
          setAvailableStatuses(allNames);
        }
      }
    } catch (err) {
      console.error('Error loading statuses from database:', err);
    }
  };

  const toggleBillingEligibility = (statusId: string, currentValue: boolean) => {
    const newPending = new Map(pendingBillingChanges);
    const currentPendingValue = newPending.get(statusId);

    if (currentPendingValue !== undefined) {
      if (currentPendingValue === currentValue) {
        newPending.delete(statusId);
      } else {
        newPending.set(statusId, !currentValue);
      }
    } else {
      newPending.set(statusId, !currentValue);
    }

    setPendingBillingChanges(newPending);
    setBillingFiltersSaveMessage(null);

    setFullStatuses(prev =>
      prev.map(s =>
        s.id === statusId
          ? { ...s, is_billing_eligible: !s.is_billing_eligible }
          : s
      )
    );
  };

  const getEffectiveBillingEligibility = (status: PrintavoStatus): boolean => {
    const pendingValue = pendingBillingChanges.get(status.id);
    return pendingValue !== undefined ? pendingValue : status.is_billing_eligible;
  };

  const saveBillingFilters = async () => {
    if (pendingBillingChanges.size === 0) {
      setBillingFiltersSaveMessage({ type: 'success', text: 'No changes to save' });
      setTimeout(() => setBillingFiltersSaveMessage(null), 3000);
      return;
    }

    try {
      setSavingBillingFilters(true);
      setBillingFiltersSaveMessage(null);

      for (const [statusId, isEligible] of pendingBillingChanges) {
        const { error } = await supabase
          .from('printavo_statuses')
          .update({
            is_billing_eligible: isEligible,
            updated_at: new Date().toISOString()
          })
          .eq('id', statusId);

        if (error) throw error;
      }

      const eligibleNames = fullStatuses
        .filter(s => s.is_billing_eligible)
        .map(s => s.name);
      setBillingSelectedStatuses(eligibleNames);

      setPendingBillingChanges(new Map());
      setBillingFiltersSaveMessage({ type: 'success', text: 'Billing status filters saved successfully!' });

      setTimeout(() => setBillingFiltersSaveMessage(null), 4000);
    } catch (err) {
      console.error('Error saving billing filters:', err);
      setBillingFiltersSaveMessage({ type: 'error', text: 'Failed to save filters. Please try again.' });

      await loadStatusesFromDatabase();
    } finally {
      setSavingBillingFilters(false);
    }
  };

  const discardBillingChanges = async () => {
    setPendingBillingChanges(new Map());
    setBillingFiltersSaveMessage(null);
    await loadStatusesFromDatabase();
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrimaryLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
      if (!validTypes.includes(file.type)) {
        showNotification('error', 'Invalid file type', 'Please upload a PNG, JPG, or SVG file.');
        return;
      }
      if (file.size > 5242880) {
        showNotification('error', 'File too large', 'File size must be less than 5MB.');
        return;
      }
      setPrimaryLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPrimaryLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSecondaryLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
      if (!validTypes.includes(file.type)) {
        showNotification('error', 'Invalid file type', 'Please upload a PNG, JPG, or SVG file.');
        return;
      }
      if (file.size > 5242880) {
        showNotification('error', 'File too large', 'File size must be less than 5MB.');
        return;
      }
      setSecondaryLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSecondaryLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePrimaryLogo = () => {
    setPrimaryLogoFile(null);
    setPrimaryLogoPreview(null);
  };

  const removeSecondaryLogo = () => {
    setSecondaryLogoFile(null);
    setSecondaryLogoPreview(null);
  };

  const uploadLogo = async () => {
    if (!logoFile) return null;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `logo-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(filePath, logoFile, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('company-logos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const saveCompanySettings = async () => {
    if (!isAdmin) {
      showNotification('error', 'Access Denied', 'Only Admins and Super Admins can edit Company Settings.');
      return;
    }

    if (!companyName.trim()) {
      showNotification('warning', 'Company Name Required', 'Please enter your company name.');
      return;
    }

    if (companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
      showNotification('warning', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setSavingCompany(true);

      let logoUrl = companySettings?.logo_url;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      let primaryLogoUrl = companySettings?.company_logo_primary_url;
      if (primaryLogoFile) {
        const timestamp = Date.now();
        const fileName = `primary-${timestamp}-${primaryLogoFile.name}`;
        const filePath = `${companySettings?.id || 'temp'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(filePath, primaryLogoFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('company-logos')
          .getPublicUrl(filePath);

        primaryLogoUrl = publicUrl;
      }

      let secondaryLogoUrl = companySettings?.company_logo_secondary_url;
      if (secondaryLogoFile) {
        const timestamp = Date.now();
        const fileName = `secondary-${timestamp}-${secondaryLogoFile.name}`;
        const filePath = `${companySettings?.id || 'temp'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(filePath, secondaryLogoFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('company-logos')
          .getPublicUrl(filePath);

        secondaryLogoUrl = publicUrl;
      }

      const settingsData = {
        company_name: companyName,
        company_address: companyAddress || null,
        company_phone: companyPhone || null,
        company_email: companyEmail || null,
        logo_url: logoUrl,
        company_logo_primary_url: primaryLogoUrl,
        company_logo_secondary_url: secondaryLogoUrl,
      };

      if (companySettings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', companySettings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert([{
            ...settingsData,
            owner_id: user.id
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      showNotification('success', 'Settings Saved', 'Company settings have been updated successfully!');
      setLogoFile(null);
      setPrimaryLogoFile(null);
      setSecondaryLogoFile(null);
      await loadSettings();
    } catch (err) {
      console.error('Error saving company settings:', err);
      showNotification('error', 'Save Failed', 'Failed to save company settings. Please try again.');
    } finally {
      setSavingCompany(false);
    }
  };

  const testPrintavoConnection = async () => {
    try {
      setTestingConnection(true);
      setTestResult(null);

      // Get session to check auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setTestResult({
          success: false,
          error: 'You must be logged in to test the connection',
        });
        return;
      }

      // Call the edge function with manual fetch to get full error details
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-printavo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      // Show full response including error details
      setTestResult(result);
    } catch (err) {
      console.error('Error testing connection:', err);
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to test connection',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const runPrintavoTest = async () => {
    setTestLoading(true);
    setTestData(null);
    try {
      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setTestData({
          success: false,
          error: 'You must be logged in to run this test'
        });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-printavo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      setTestData(result);
    } catch (error) {
      setTestData({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setTestLoading(false);
    }
  };

  const saveIntegration = async () => {
    if (!printavoUsername.trim()) {
      showNotification('warning', 'Username Required', 'Printavo username/email is required');
      return;
    }

    if (!printavoToken.trim()) {
      showNotification('warning', 'API Token Required', 'Printavo API token is required');
      return;
    }

    try {
      setSavingIntegration(true);

      if (!import.meta.env.VITE_SUPABASE_URL) {
        showNotification('error', 'Configuration Error', 'VITE_SUPABASE_URL environment variable is not set. Please configure it in your Vercel project settings.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showNotification('error', 'Not Authenticated', 'You must be logged in to update integration settings');
        return;
      }

      const encryptResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'encrypt',
          token: printavoToken,
        }),
      });

      if (!encryptResponse.ok) {
        const errorData = await encryptResponse.json();
        throw new Error(errorData.error || 'Failed to encrypt API token');
      }

      const { result: encryptedToken } = await encryptResponse.json();

      const settingsData = {
        printavo_username: printavoUsername,
        printavo_api_token_encrypted: encryptedToken,
        encryption_key_version: 'v1',
      };

      if (companySettings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', companySettings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert([{
            company_name: companyName || '',
            owner_id: user.id,
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      showNotification('success', 'Printavo Connected', 'Integration settings have been saved successfully!');
      setPrintavoToken('');
      setTestResult(null);
      await loadSettings();
      await loadAvailableStatuses();
    } catch (err) {
      console.error('Error saving integration settings:', err);
      showNotification('error', 'Save Failed', err instanceof Error ? err.message : 'Failed to save integration settings. Please try again.');
    } finally {
      setSavingIntegration(false);
    }
  };

  const saveSquareIntegration = async () => {
    if (!squareAccessToken.trim() && !companySettings?.id) {
      showNotification('warning', 'Token Required', 'Square Access Token is required');
      return;
    }

    try {
      setSavingSquare(true);

      if (!import.meta.env.VITE_SUPABASE_URL) {
        showNotification('error', 'Configuration Error', 'VITE_SUPABASE_URL environment variable is not set. Please configure it in your Vercel project settings.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showNotification('error', 'Not Authenticated', 'You must be logged in to update Square settings');
        return;
      }

      let encryptedToken = null;

      if (squareAccessToken.trim()) {
        const encryptResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'encrypt',
            token: squareAccessToken,
          }),
        });

        if (!encryptResponse.ok) {
          const errorData = await encryptResponse.json();
          throw new Error(errorData.error || 'Failed to encrypt Square access token');
        }

        const { result } = await encryptResponse.json();
        encryptedToken = result;
      }

      const settingsData: any = {
        square_application_id: squareApplicationId.trim() || null,
        square_location_id: squareLocationId.trim() || null,
        square_environment: squareEnvironment,
      };

      if (encryptedToken) {
        settingsData.square_access_token = encryptedToken;
      }

      if (companySettings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', companySettings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert([{
            company_name: companyName || '',
            owner_id: user.id,
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      showNotification('success', 'Square Connected', 'Integration settings have been saved successfully!');
      setSquareAccessToken('');
      setSquareTestResult(null);
      await loadSettings();
    } catch (err) {
      console.error('Error saving Square settings:', err);
      showNotification('error', 'Save Failed', err instanceof Error ? err.message : 'Failed to save Square settings. Please try again.');
    } finally {
      setSavingSquare(false);
    }
  };

  const saveResendIntegration = async () => {
    if (!resendApiKey.trim() && !companySettings?.id) {
      showNotification('warning', 'API Key Required', 'Resend API Key is required');
      return;
    }

    try {
      setSavingResend(true);

      if (!import.meta.env.VITE_SUPABASE_URL) {
        showNotification('error', 'Configuration Error', 'VITE_SUPABASE_URL environment variable is not set. Please configure it in your Vercel project settings.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showNotification('error', 'Not Authenticated', 'You must be logged in to update Resend settings');
        return;
      }

      let encryptedKey = null;

      if (resendApiKey.trim()) {
        const encryptResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'encrypt',
            token: resendApiKey,
          }),
        });

        if (!encryptResponse.ok) {
          const errorData = await encryptResponse.json();
          throw new Error(errorData.error || 'Failed to encrypt Resend API key');
        }

        const { result } = await encryptResponse.json();
        encryptedKey = result;
      }

      const settingsData: any = {};

      if (encryptedKey) {
        settingsData.resend_api_key = encryptedKey;
      }

      if (emailFromAddress.trim()) {
        settingsData.email_from_address = emailFromAddress.trim();
      }

      if (companySettings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', companySettings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert([{
            company_name: companyName || '',
            owner_id: user.id,
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      showNotification('success', 'Resend Connected', 'Integration settings have been saved successfully!');
      setResendApiKey('');
      setResendTestResult(null);
      await loadSettings();
    } catch (err) {
      console.error('Error saving Resend settings:', err);
      showNotification('error', 'Save Failed', err instanceof Error ? err.message : 'Failed to save Resend settings. Please try again.');
    } finally {
      setSavingResend(false);
    }
  };

  const saveStripeIntegration = async () => {
    if (!stripePublicKey.trim() && !stripeSecretKey.trim() && !companySettings?.id) {
      showNotification('warning', 'Credentials Required', 'At least one Stripe credential is required');
      return;
    }

    try {
      if (!import.meta.env.VITE_SUPABASE_URL) {
        showNotification('error', 'Configuration Error', 'VITE_SUPABASE_URL environment variable is not set. Please configure it in your Vercel project settings.');
        return;
      }
      setSavingStripe(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showNotification('error', 'Not Authenticated', 'You must be logged in to update Stripe settings');
        return;
      }

      let encryptedPublicKey = null;
      let encryptedSecretKey = null;
      let encryptedWebhookSecret = null;

      if (stripePublicKey.trim()) {
        const encryptResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'encrypt',
            token: stripePublicKey,
          }),
        });

        if (!encryptResponse.ok) {
          const errorData = await encryptResponse.json();
          throw new Error(errorData.error || 'Failed to encrypt Stripe public key');
        }

        const { result } = await encryptResponse.json();
        encryptedPublicKey = result;
      }

      if (stripeSecretKey.trim()) {
        const encryptResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'encrypt',
            token: stripeSecretKey,
          }),
        });

        if (!encryptResponse.ok) {
          const errorData = await encryptResponse.json();
          throw new Error(errorData.error || 'Failed to encrypt Stripe secret key');
        }

        const { result } = await encryptResponse.json();
        encryptedSecretKey = result;
      }

      if (stripeWebhookSecret.trim()) {
        const encryptResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'encrypt',
            token: stripeWebhookSecret,
          }),
        });

        if (!encryptResponse.ok) {
          const errorData = await encryptResponse.json();
          throw new Error(errorData.error || 'Failed to encrypt Stripe webhook secret');
        }

        const { result } = await encryptResponse.json();
        encryptedWebhookSecret = result;
      }

      const settingsData: any = {};

      if (encryptedPublicKey) {
        settingsData.stripe_public_key = encryptedPublicKey;
      }

      if (encryptedSecretKey) {
        settingsData.stripe_secret_key = encryptedSecretKey;
      }

      if (encryptedWebhookSecret) {
        settingsData.stripe_webhook_secret = encryptedWebhookSecret;
      }

      if (Object.keys(settingsData).length === 0) {
        showNotification('warning', 'No Credentials', 'No Stripe credentials to save');
        return;
      }

      if (companySettings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', companySettings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert([{
            company_name: companyName || '',
            owner_id: user.id,
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      showNotification('success', 'Stripe Connected', 'Integration settings have been saved successfully!');
      setStripePublicKey('');
      setStripeSecretKey('');
      setStripeWebhookSecret('');
      setStripeTestResult(null);
      await loadSettings();
    } catch (err) {
      console.error('Error saving Stripe settings:', err);
      showNotification('error', 'Save Failed', err instanceof Error ? err.message : 'Failed to save Stripe settings. Please try again.');
    } finally {
      setSavingStripe(false);
    }
  };

  const saveTwilioIntegration = async () => {
    if (!twilioAccountSid.trim() && !twilioAuthToken.trim() && !companySettings?.id) {
      showNotification('warning', 'Credentials Required', 'At least Twilio Account SID and Auth Token are required');
      return;
    }

    try {
      setSavingTwilio(true);

      if (!import.meta.env.VITE_SUPABASE_URL) {
        showNotification('error', 'Configuration Error', 'VITE_SUPABASE_URL environment variable is not set. Please configure it in your Vercel project settings.');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showNotification('error', 'Not Authenticated', 'You must be logged in to update Twilio settings');
        return;
      }

      let encryptedAccountSid = null;
      let encryptedAuthToken = null;

      if (twilioAccountSid.trim()) {
        const encryptResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'encrypt',
            token: twilioAccountSid,
          }),
        });

        if (!encryptResponse.ok) {
          const errorData = await encryptResponse.json();
          throw new Error(errorData.error || 'Failed to encrypt Twilio Account SID');
        }

        const { result } = await encryptResponse.json();
        encryptedAccountSid = result;
      }

      if (twilioAuthToken.trim()) {
        const encryptResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'encrypt',
            token: twilioAuthToken,
          }),
        });

        if (!encryptResponse.ok) {
          const errorData = await encryptResponse.json();
          throw new Error(errorData.error || 'Failed to encrypt Twilio Auth Token');
        }

        const { result } = await encryptResponse.json();
        encryptedAuthToken = result;
      }

      const settingsData: any = {};

      if (encryptedAccountSid) {
        settingsData.twilio_account_sid = encryptedAccountSid;
      }

      if (encryptedAuthToken) {
        settingsData.twilio_auth_token = encryptedAuthToken;
      }

      if (twilioPhoneNumber.trim()) {
        settingsData.twilio_phone_number = twilioPhoneNumber;
      }

      settingsData.twilio_enabled = twilioEnabled;
      settingsData.default_send_method = defaultSendMethod;
      settingsData.sms_message_template = smsMessageTemplate;

      if (Object.keys(settingsData).length === 0) {
        showNotification('warning', 'No Settings', 'No Twilio settings to save');
        return;
      }

      if (companySettings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', companySettings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert([{
            company_name: companyName || '',
            owner_id: user.id,
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      showNotification('success', 'Twilio Connected', 'Integration settings have been saved successfully!');
      setTwilioAccountSid('');
      setTwilioAuthToken('');
      setTwilioTestResult(null);
      await loadSettings();
    } catch (err) {
      console.error('Error saving Twilio settings:', err);
      showNotification('error', 'Save Failed', err instanceof Error ? err.message : 'Failed to save Twilio settings. Please try again.');
    } finally {
      setSavingTwilio(false);
    }
  };

  const testTwilioConnection = async () => {
    try {
      setTestingTwilio(true);
      setTwilioTestResult(null);

      if (!companySettings?.twilio_account_sid || !companySettings?.twilio_auth_token) {
        setTwilioTestResult({
          success: false,
          error: 'Twilio credentials not configured. Please save your credentials first.',
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setTwilioTestResult({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const testPhone = prompt('Enter a phone number to send a test SMS (E.164 format, e.g., +14155551234):');
      if (!testPhone) {
        setTwilioTestResult({
          success: false,
          error: 'Test cancelled',
        });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-sms`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: 'test-invoice',
          customerId: 'test-customer',
          phoneNumber: testPhone,
          messageBody: 'Test message from your Twilio integration. If you received this, your configuration is working!',
        }),
      });

      let result;
      try {
        const text = await response.text();
        console.log('Twilio test response status:', response.status);
        console.log('Twilio test response text:', text);
        result = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        result = { error: `Server returned invalid response (Status: ${response.status})` };
      }

      if (response.ok) {
        setTwilioTestResult({
          success: true,
          message: 'Test SMS sent successfully!',
          details: result,
        });
      } else {
        setTwilioTestResult({
          success: false,
          error: result.error || `Failed to send test SMS (Status: ${response.status})`,
          details: result,
        });
      }
    } catch (err) {
      console.error('Error testing Twilio:', err);
      setTwilioTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to test Twilio connection',
        details: err,
      });
    } finally {
      setTestingTwilio(false);
    }
  };

  const testStripeConnection = async () => {
    try {
      setTestingStripe(true);
      setStripeTestResult(null);

      if (!companySettings?.stripe_secret_key) {
        setStripeTestResult({
          success: false,
          error: 'Stripe secret key not configured. Please save your credentials first.',
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStripeTestResult({
          success: false,
          error: 'You must be logged in to test Stripe connection',
        });
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'testConnection',
          data: {},
        }),
      });

      const result = await response.json();
      console.log('Stripe test response:', { status: response.status, result });

      if (!response.ok) {
        console.error('Stripe test failed:', result);
        setStripeTestResult({
          success: false,
          error: result.error || 'Failed to test Stripe connection',
        });
        return;
      }

      console.log('Stripe test successful:', result);
      setStripeTestResult(result);
    } catch (err) {
      setStripeTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Connection test failed',
      });
    } finally {
      setTestingStripe(false);
    }
  };

  const testSquareConnection = async () => {
    try {
      setTestingSquare(true);
      setSquareTestResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to test the connection');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/square-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          endpoint: '/v2/locations',
          method: 'GET',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setSquareTestResult({
          success: false,
          error: result.error || 'Failed to connect to Square API',
          details: result,
        });
      } else {
        setSquareTestResult({
          success: true,
          message: `Successfully connected to Square! Found ${result.locations?.length || 0} location(s).`,
          locations: result.locations,
          details: result,
        });
      }
    } catch (err) {
      setSquareTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to test connection',
      });
    } finally {
      setTestingSquare(false);
    }
  };

  const testResendConnection = async () => {
    try {
      setTestingResend(true);
      setResendTestResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to test the connection');
      }

      if (!user?.email) {
        throw new Error('User email not found');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: user.email,
          subject: 'Resend Connection Test',
          template: 'custom',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8b5cf6;">Resend Connection Test Successful!</h2>
              <p>Your Resend integration is working correctly.</p>
              <p>This test email was sent to verify that:</p>
              <ul>
                <li>Your API key is properly configured</li>
                <li>The encryption/decryption is working</li>
                <li>Resend can send emails from your account</li>
              </ul>
              <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                Sent via ${companySettings?.company_name || 'Your Application'}
              </p>
            </div>
          `,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setResendTestResult({
          success: false,
          error: result.error || 'Failed to send test email',
          details: result,
        });
      } else {
        setResendTestResult({
          success: true,
          message: `Test email sent successfully to ${user.email}`,
          emailId: result.data?.id,
          details: result,
        });
      }
    } catch (err) {
      setResendTestResult({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to test connection',
      });
    } finally {
      setTestingResend(false);
    }
  };

  const addUser = async () => {
    if (!newUserEmail.trim()) {
      showNotification('warning', 'Email Required', 'Email is required');
      return;
    }

    try {
      setAddingUser(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showNotification('error', 'Not Authenticated', 'You must be logged in to add users');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'create',
          email: newUserEmail,
          full_name: newUserName || null,
          role: newUserRole,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error('Add user error response:', responseText);
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`Failed to create user: ${responseText}`);
        }
        throw new Error(errorData.error || 'Failed to create user');
      }

      showNotification('success', 'User Added', 'User added successfully! They will receive an email to set their password.');
      setShowAddUser(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('user');
      loadUsers();
    } catch (err) {
      console.error('Error adding user:', err);
      showNotification('error', 'Add User Failed', err instanceof Error ? err.message : 'Failed to add user. Please try again.');
    } finally {
      setAddingUser(false);
    }
  };

  const startEditUser = (userProfile: UserProfile) => {
    setEditingUserId(userProfile.id);
    setEditingUserEmail(userProfile.email);
    setEditingUserName(userProfile.full_name || '');
    setEditingUserRole(userProfile.role);
    setEditingUserPassword('');
    setEditingUserPasswordConfirm('');
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setEditingUserEmail('');
    setEditingUserName('');
    setEditingUserRole('user');
    setEditingUserPassword('');
    setEditingUserPasswordConfirm('');
  };

  const updateUser = async (userId: string) => {
    if (!editingUserEmail.trim()) {
      showNotification('warning', 'Email Required', 'Email is required');
      return;
    }

    if (editingUserPassword || editingUserPasswordConfirm) {
      if (editingUserPassword !== editingUserPasswordConfirm) {
        showNotification('warning', 'Password Mismatch', 'Passwords do not match');
        return;
      }
      if (editingUserPassword.length < 6) {
        showNotification('warning', 'Password Too Short', 'Password must be at least 6 characters');
        return;
      }
    }

    try {
      setUpdatingUser(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showNotification('error', 'Not Authenticated', 'You must be logged in to update users');
        return;
      }

      const requestBody: any = {
        action: 'update',
        userId: userId,
        email: editingUserEmail,
        full_name: editingUserName || null,
        role: editingUserRole,
      };

      if (editingUserPassword) {
        requestBody.password = editingUserPassword;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error('Update user error response:', responseText);
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          throw new Error(`Failed to update user: ${responseText}`);
        }
        throw new Error(errorData.error || 'Failed to update user');
      }

      showNotification('success', 'User Updated', 'User updated successfully!');
      cancelEditUser();
      loadUsers();
    } catch (err) {
      console.error('Error updating user:', err);
      showNotification('error', 'Update Failed', err instanceof Error ? err.message : 'Failed to update user. Please try again.');
    } finally {
      setUpdatingUser(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      showNotification('success', 'User Removed', 'User removed successfully!');
      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      showNotification('error', 'Remove Failed', 'Failed to remove user. Please try again.');
    }
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const saveStatusPreferences = async () => {
    try {
      setSavingStatuses(true);

      const settingsData = {
        available_invoice_statuses: availableStatuses,
        selected_invoice_statuses: selectedStatuses,
      };

      if (companySettings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', companySettings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert([{
            company_name: companyName || '',
            owner_id: user.id,
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      showNotification('success', 'Status Preferences Saved', 'Status preferences saved successfully!');
    } catch (err) {
      console.error('Error saving status preferences:', err);
      showNotification('error', 'Save Failed', 'Failed to save status preferences. Please try again.');
    } finally {
      setSavingStatuses(false);
    }
  };

  const toggleBillingStatus = (status: string) => {
    setBillingSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const saveBillingStatusPreferences = async () => {
    try {
      setSavingBillingStatuses(true);

      const settingsData = {
        billing_selected_invoice_statuses: billingSelectedStatuses,
      };

      if (companySettings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', companySettings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert([{
            company_name: companyName || '',
            owner_id: user.id,
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      showNotification('success', 'Billing Status Saved', 'Billing status preferences saved successfully!');
    } catch (err) {
      console.error('Error saving billing status preferences:', err);
      showNotification('error', 'Save Failed', 'Failed to save billing status preferences. Please try again.');
    } finally {
      setSavingBillingStatuses(false);
    }
  };

  const syncStatuses = async () => {
    try {
      setSyncingStatuses(true);
      await loadAvailableStatuses();
      await loadStatusesFromDatabase();
      showNotification('success', 'Statuses Synced', 'Successfully synced statuses from Printavo!');
    } catch (err) {
      console.error('Error syncing statuses:', err);
      showNotification('error', 'Sync Failed', 'Failed to sync statuses. Please try again.');
    } finally {
      setSyncingStatuses(false);
    }
  };

  const syncPrintavoData = async () => {
    try {
      setSyncingPrintavoData(true);
      setSyncResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be logged in to sync Printavo data');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/printavo-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mode: 'quick' }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start sync');
      }

      setSyncResult({
        success: true,
        message: 'Sync started successfully! This may take a few minutes. Your data will be updated in the background.',
      });
    } catch (err) {
      console.error('Error syncing Printavo data:', err);
      setSyncResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to sync data',
      });
    } finally {
      setSyncingPrintavoData(false);
    }
  };

  const loadInvoiceFees = async () => {
    try {
      setLoadingFees(true);
      const { data, error } = await supabase
        .from('invoice_fees')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoiceFees(data || []);
    } catch (err) {
      console.error('Error loading invoice fees:', err);
      showNotification('error', 'Load Failed', 'Failed to load invoice fees.');
    } finally {
      setLoadingFees(false);
    }
  };

  const resetFeeForm = () => {
    setFeeFormData({
      fee_name: '',
      description: '',
      amount: '',
      amount_type: 'dollar',
      is_taxed: false,
      show_by_default: false,
    });
    setEditingFeeId(null);
  };

  const openAddFeeModal = () => {
    resetFeeForm();
    setShowAddFeeModal(true);
  };

  const openEditFeeModal = (fee: InvoiceFee) => {
    setFeeFormData({
      fee_name: fee.fee_name,
      description: fee.description,
      amount: fee.amount.toString(),
      amount_type: fee.amount_type,
      is_taxed: fee.is_taxed,
      show_by_default: fee.show_by_default,
    });
    setEditingFeeId(fee.id);
    setShowAddFeeModal(true);
  };

  const saveFee = async () => {
    if (!feeFormData.fee_name.trim()) {
      showNotification('error', 'Validation Error', 'Fee name is required.');
      return;
    }

    const amount = parseFloat(feeFormData.amount);
    if (isNaN(amount) || amount < 0) {
      showNotification('error', 'Validation Error', 'Please enter a valid amount.');
      return;
    }

    if (feeFormData.amount_type === 'percent' && amount > 100) {
      showNotification('error', 'Validation Error', 'Percentage cannot exceed 100%.');
      return;
    }

    try {
      setSavingFee(true);

      if (editingFeeId) {
        const { error } = await supabase
          .from('invoice_fees')
          .update({
            fee_name: feeFormData.fee_name,
            description: feeFormData.description,
            amount: amount,
            amount_type: feeFormData.amount_type,
            is_taxed: feeFormData.is_taxed,
            show_by_default: feeFormData.show_by_default,
          })
          .eq('id', editingFeeId);

        if (error) throw error;
        showNotification('success', 'Fee Updated', 'Invoice fee updated successfully!');
      } else {
        if (!companySettings?.id) {
          showNotification('error', 'Error', 'Company settings not found. Please refresh the page.');
          setSavingFee(false);
          return;
        }

        console.log('Creating invoice fee with company_id:', companySettings.id);

        const { data, error } = await supabase
          .from('invoice_fees')
          .insert([{
            company_id: companySettings.id,
            fee_name: feeFormData.fee_name,
            description: feeFormData.description,
            amount: amount,
            amount_type: feeFormData.amount_type,
            is_taxed: feeFormData.is_taxed,
            show_by_default: feeFormData.show_by_default,
          }])
          .select();

        console.log('Insert result:', { data, error });

        if (error) throw error;
        showNotification('success', 'Fee Created', 'Invoice fee created successfully!');
      }

      setShowAddFeeModal(false);
      resetFeeForm();
      loadInvoiceFees();
    } catch (err: any) {
      console.error('Error saving fee:', err);
      const errorMessage = err?.message || 'Failed to save invoice fee. Please try again.';
      showNotification('error', 'Save Failed', errorMessage);
    } finally {
      setSavingFee(false);
    }
  };

  const deleteFee = async (feeId: string) => {
    const confirmed = await confirm(
      'Delete Invoice Fee?',
      'Are you sure you want to delete this invoice fee? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('invoice_fees')
        .update({ is_active: false })
        .eq('id', feeId);

      if (error) throw error;

      showNotification('success', 'Fee Deleted', 'Invoice fee deleted successfully!');
      loadInvoiceFees();
    } catch (err) {
      console.error('Error deleting fee:', err);
      showNotification('error', 'Delete Failed', 'Failed to delete invoice fee. Please try again.');
    }
  };

  const toggleFeeDefault = async (feeId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('invoice_fees')
        .update({ show_by_default: !currentValue })
        .eq('id', feeId);

      if (error) throw error;

      loadInvoiceFees();
      showNotification('success', 'Updated', `Fee will ${!currentValue ? 'now' : 'no longer'} be added by default.`);
    } catch (err) {
      console.error('Error toggling fee default:', err);
      showNotification('error', 'Update Failed', 'Failed to update fee default setting.');
    }
  };

  const bulkAddFees = async () => {
    if (!bulkFeesText.trim()) {
      showNotification('error', 'No Input', 'Please enter at least one fee.');
      return;
    }

    if (!companySettings?.id) {
      showNotification('error', 'Error', 'Company settings not found. Please refresh the page.');
      return;
    }

    try {
      setSavingBulkFees(true);

      const lines = bulkFeesText.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) {
        showNotification('error', 'No Valid Entries', 'Please enter valid fee names.');
        setSavingBulkFees(false);
        return;
      }

      const newFees = lines.map(feeName => ({
        company_id: companySettings.id,
        fee_name: feeName,
        description: '',
        amount: 0,
        amount_type: 'dollar',
        is_taxed: false,
        show_by_default: false,
      }));

      const { error } = await supabase
        .from('invoice_fees')
        .insert(newFees);

      if (error) throw error;

      showNotification('success', 'Bulk Add Complete', `Added ${lines.length} fee(s) successfully!`);
      setShowBulkAddFeesModal(false);
      setBulkFeesText('');
      loadInvoiceFees();
    } catch (err: any) {
      console.error('Error bulk adding fees:', err);
      showNotification('error', 'Bulk Add Failed', err?.message || 'Failed to add fees. Please try again.');
    } finally {
      setSavingBulkFees(false);
    }
  };

  const bulkAddLocations = async () => {
    if (!bulkLocationsText.trim()) {
      showNotification('error', 'No Input', 'Please enter at least one location.');
      return;
    }

    if (!companySettings?.id) {
      showNotification('error', 'Error', 'Company settings not found. Please refresh the page.');
      return;
    }

    try {
      setSavingBulkLocations(true);

      const lines = bulkLocationsText.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) {
        showNotification('error', 'No Valid Entries', 'Please enter valid location names.');
        setSavingBulkLocations(false);
        return;
      }

      const newLocations = lines.map(locationName => ({
        company_id: companySettings.id,
        decoration_name: locationName,
        address: '',
      }));

      const { error } = await supabase
        .from('decoration_locations')
        .insert(newLocations);

      if (error) throw error;

      showNotification('success', 'Bulk Add Complete', `Added ${lines.length} location(s) successfully!`);
      setShowBulkAddLocationsModal(false);
      setBulkLocationsText('');
      loadDecorationLocations();
    } catch (err: any) {
      console.error('Error bulk adding locations:', err);
      showNotification('error', 'Bulk Add Failed', err?.message || 'Failed to add locations. Please try again.');
    } finally {
      setSavingBulkLocations(false);
    }
  };

  const bulkAddWorkTypes = async () => {
    if (!bulkWorkTypesText.trim()) {
      showNotification('error', 'No Input', 'Please enter at least one work type.');
      return;
    }

    if (!companySettings?.id) {
      showNotification('error', 'Error', 'Company settings not found. Please refresh the page.');
      return;
    }

    try {
      setSavingBulkWorkTypes(true);

      const lines = bulkWorkTypesText.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) {
        showNotification('error', 'No Valid Entries', 'Please enter valid work type names.');
        setSavingBulkWorkTypes(false);
        return;
      }

      const newWorkTypes = lines.map(workTypeName => ({
        company_id: companySettings.id,
        work_type_name: workTypeName,
        color_type: bulkWorkTypeColorType,
      }));

      const { error } = await supabase
        .from('type_of_work')
        .insert(newWorkTypes);

      if (error) throw error;

      showNotification('success', 'Bulk Add Complete', `Added ${lines.length} work type(s) successfully!`);
      setShowBulkAddWorkTypesModal(false);
      setBulkWorkTypesText('');
      loadWorkTypes();
    } catch (err: any) {
      console.error('Error bulk adding work types:', err);
      showNotification('error', 'Bulk Add Failed', err?.message || 'Failed to add work types. Please try again.');
    } finally {
      setSavingBulkWorkTypes(false);
    }
  };

  const loadDecorationLocations = async () => {
    try {
      setLoadingLocations(true);
      const { data, error } = await supabase
        .from('decoration_locations')
        .select('*')
        .eq('is_active', true)
        .order('decoration_name');

      if (error) throw error;
      setDecorationLocations(data || []);
    } catch (err) {
      console.error('Error loading decoration locations:', err);
      showNotification('error', 'Load Failed', 'Failed to load decoration locations.');
    } finally {
      setLoadingLocations(false);
    }
  };

  const resetLocationForm = () => {
    setLocationFormData({
      decoration_name: '',
      address: '',
    });
    setEditingLocationId(null);
  };

  const openAddLocationModal = () => {
    resetLocationForm();
    setShowAddLocationModal(true);
  };

  const openEditLocationModal = (location: DecorationLocation) => {
    setLocationFormData({
      decoration_name: location.decoration_name,
      address: location.address || '',
    });
    setEditingLocationId(location.id);
    setShowAddLocationModal(true);
  };

  const saveLocation = async () => {
    if (!locationFormData.decoration_name.trim()) {
      showNotification('error', 'Validation Error', 'Decoration location name is required.');
      return;
    }

    try {
      setSavingLocation(true);

      if (editingLocationId) {
        const { error } = await supabase
          .from('decoration_locations')
          .update({
            decoration_name: locationFormData.decoration_name,
            address: locationFormData.address,
          })
          .eq('id', editingLocationId);

        if (error) throw error;
        showNotification('success', 'Location Updated', 'Decoration location updated successfully!');
      } else {
        if (!companySettings?.id) {
          showNotification('error', 'Error', 'Company settings not found. Please refresh the page.');
          setSavingLocation(false);
          return;
        }

        const { error } = await supabase
          .from('decoration_locations')
          .insert([{
            company_id: companySettings.id,
            decoration_name: locationFormData.decoration_name,
            address: locationFormData.address,
          }]);

        if (error) throw error;
        showNotification('success', 'Location Created', 'Decoration location created successfully!');
      }

      setShowAddLocationModal(false);
      resetLocationForm();
      loadDecorationLocations();
    } catch (err: any) {
      console.error('Error saving location:', err);
      const errorMessage = err?.message || 'Failed to save decoration location. Please try again.';
      showNotification('error', 'Save Failed', errorMessage);
    } finally {
      setSavingLocation(false);
    }
  };

  const deleteLocation = async (locationId: string) => {
    const confirmed = await confirm(
      'Delete Decoration Location?',
      'Are you sure you want to delete this location? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('decoration_locations')
        .update({ is_active: false })
        .eq('id', locationId);

      if (error) throw error;

      showNotification('success', 'Location Deleted', 'Decoration location deleted successfully!');
      loadDecorationLocations();
    } catch (err) {
      console.error('Error deleting location:', err);
      showNotification('error', 'Delete Failed', 'Failed to delete decoration location. Please try again.');
    }
  };

  const loadWorkTypes = async () => {
    try {
      setLoadingWorkTypes(true);
      const { data, error } = await supabase
        .from('type_of_work_settings')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setWorkTypes(data || []);
    } catch (err) {
      console.error('Error loading work types:', err);
      showNotification('error', 'Load Failed', 'Failed to load work types.');
    } finally {
      setLoadingWorkTypes(false);
    }
  };

  const resetWorkTypeForm = () => {
    setWorkTypeFormData({
      work_type_name: '',
      color_type: 'ink',
    });
    setEditingWorkTypeId(null);
  };

  const openAddWorkTypeModal = () => {
    resetWorkTypeForm();
    setShowAddWorkTypeModal(true);
  };

  const openEditWorkTypeModal = (workType: TypeOfWork) => {
    setWorkTypeFormData({
      work_type_name: workType.work_type_name,
      color_type: workType.color_type,
    });
    setEditingWorkTypeId(workType.id);
    setShowAddWorkTypeModal(true);
  };

  const saveWorkType = async () => {
    if (!workTypeFormData.work_type_name.trim()) {
      showNotification('error', 'Validation Error', 'Please enter a work type name.');
      return;
    }

    if (!companySettings?.id) {
      showNotification('error', 'Error', 'Company settings not found.');
      return;
    }

    try {
      setSavingWorkType(true);

      if (editingWorkTypeId) {
        const { error } = await supabase
          .from('type_of_work_settings')
          .update({
            work_type_name: workTypeFormData.work_type_name,
            color_type: workTypeFormData.color_type,
          })
          .eq('id', editingWorkTypeId);

        if (error) throw error;
        showNotification('success', 'Work Type Updated', 'Type of work updated successfully!');
      } else {
        const nextSortOrder = workTypes.length > 0
          ? Math.max(...workTypes.map(wt => wt.sort_order)) + 1
          : 0;

        const { error } = await supabase
          .from('type_of_work_settings')
          .insert([{
            company_id: companySettings.id,
            work_type_name: workTypeFormData.work_type_name,
            color_type: workTypeFormData.color_type,
            sort_order: nextSortOrder,
          }]);

        if (error) throw error;
        showNotification('success', 'Work Type Created', 'Type of work created successfully!');
      }

      setShowAddWorkTypeModal(false);
      resetWorkTypeForm();
      loadWorkTypes();
    } catch (err: any) {
      console.error('Error saving work type:', err);
      const errorMessage = err?.message || 'Failed to save work type. Please try again.';
      showNotification('error', 'Save Failed', errorMessage);
    } finally {
      setSavingWorkType(false);
    }
  };

  const deleteWorkType = async (workTypeId: string) => {
    const confirmed = await confirm(
      'Delete Type of Work?',
      'Are you sure you want to delete this type of work? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('type_of_work_settings')
        .update({ is_active: false })
        .eq('id', workTypeId);

      if (error) throw error;

      showNotification('success', 'Work Type Deleted', 'Type of work deleted successfully!');
      loadWorkTypes();
    } catch (err) {
      console.error('Error deleting work type:', err);
      showNotification('error', 'Delete Failed', 'Failed to delete work type. Please try again.');
    }
  };

  const loadColorStitchOptions = async () => {
    try {
      setLoadingColorStitch(true);
      const { data, error } = await supabase
        .from('color_stitch_options')
        .select('*')
        .eq('is_active', true)
        .order('option_type')
        .order('sort_order');

      if (error) throw error;
      setColorStitchOptions(data || []);
    } catch (err) {
      console.error('Error loading color/stitch options:', err);
      showNotification('error', 'Load Failed', 'Failed to load color/stitch options.');
    } finally {
      setLoadingColorStitch(false);
    }
  };

  const resetColorStitchForm = () => {
    setColorStitchFormData({
      option_label: '',
      option_value: '',
      option_type: 'color',
    });
    setEditingColorStitchId(null);
  };

  const openAddColorStitchModal = () => {
    resetColorStitchForm();
    setShowAddColorStitchModal(true);
  };

  const openEditColorStitchModal = (option: ColorStitchOption) => {
    setColorStitchFormData({
      option_label: option.option_label,
      option_value: option.option_value,
      option_type: option.option_type,
    });
    setEditingColorStitchId(option.id);
    setShowAddColorStitchModal(true);
  };

  const saveColorStitchOption = async () => {
    if (!colorStitchFormData.option_label || !colorStitchFormData.option_value) {
      showNotification('error', 'Missing Information', 'Please fill in all required fields.');
      return;
    }

    try {
      setSavingColorStitch(true);

      if (editingColorStitchId) {
        const { error } = await supabase
          .from('color_stitch_options')
          .update({
            option_label: colorStitchFormData.option_label,
            option_value: colorStitchFormData.option_value,
            option_type: colorStitchFormData.option_type,
          })
          .eq('id', editingColorStitchId);

        if (error) throw error;
        showNotification('success', 'Option Updated', 'Color/stitch option updated successfully!');
      } else {
        if (!companySettings?.id) {
          showNotification('error', 'Error', 'Company settings not found. Please refresh the page.');
          setSavingColorStitch(false);
          return;
        }

        const maxSortOrder = colorStitchOptions
          .filter(opt => opt.option_type === colorStitchFormData.option_type)
          .reduce((max, opt) => Math.max(max, opt.sort_order), 0);

        const { error } = await supabase
          .from('color_stitch_options')
          .insert([{
            company_id: companySettings.id,
            option_label: colorStitchFormData.option_label,
            option_value: colorStitchFormData.option_value,
            option_type: colorStitchFormData.option_type,
            sort_order: maxSortOrder + 1,
          }]);

        if (error) throw error;
        showNotification('success', 'Option Created', 'Color/stitch option created successfully!');
      }

      setShowAddColorStitchModal(false);
      resetColorStitchForm();
      loadColorStitchOptions();
    } catch (err: any) {
      console.error('Error saving color/stitch option:', err);
      const errorMessage = err?.message || 'Failed to save option. Please try again.';
      showNotification('error', 'Save Failed', errorMessage);
    } finally {
      setSavingColorStitch(false);
    }
  };

  const deleteColorStitchOption = async (optionId: string) => {
    const confirmed = await confirm(
      'Delete Option?',
      'Are you sure you want to delete this color/stitch option? This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('color_stitch_options')
        .update({ is_active: false })
        .eq('id', optionId);

      if (error) throw error;

      showNotification('success', 'Option Deleted', 'Color/stitch option deleted successfully!');
      loadColorStitchOptions();
    } catch (err) {
      console.error('Error deleting option:', err);
      showNotification('error', 'Delete Failed', 'Failed to delete option. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-500 animate-spin" />
      </div>
    );
  }

  const isAdmin = currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'super_admin';

  return (
    <div className="flex h-full">
      {/* Left Sidebar Navigation */}
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 overflow-y-auto flex-shrink-0">
        <nav className="px-2 pt-4 pb-4">
          {/* Company Settings Section - Collapsible */}
          <div className="mb-2">
            <button
              onClick={() => setCompanySettingsExpanded(!companySettingsExpanded)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-700/50"
            >
              <Building2 className="w-4 h-4 flex-shrink-0 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white" />
              <div className="flex-1 text-left">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  Company Settings
                </div>
              </div>
              {companySettingsExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 rotate-180" />
              )}
            </button>

            {companySettingsExpanded && (
              <div className="mt-1 ml-2 space-y-1 collapsible-section collapsible-section-enter">
                <button
                  onClick={() => setActiveTab('company-info')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'company-info'
                      ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Building2 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'company-info' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'company-info' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Company Info
                    </div>
                  </div>
                  {activeTab === 'company-info' && <div className="w-1 h-6 bg-blue-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                </button>

                <button
                  onClick={() => setActiveTab('quote-invoice-settings')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'quote-invoice-settings'
                      ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  style={{ animationDelay: '20ms' }}
                >
                  <FileText className={`w-4 h-4 flex-shrink-0 ${activeTab === 'quote-invoice-settings' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'quote-invoice-settings' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Quote/Invoice Settings
                    </div>
                  </div>
                  {activeTab === 'quote-invoice-settings' && <div className="w-1 h-6 bg-blue-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                </button>

                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('user-management')}
                    className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                      activeTab === 'user-management'
                        ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    style={{ animationDelay: '20ms' }}
                  >
                    <Shield className={`w-4 h-4 flex-shrink-0 ${activeTab === 'user-management' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                    <div className="flex-1 text-left">
                      <div className={`font-medium text-sm ${activeTab === 'user-management' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        User Management
                      </div>
                    </div>
                    {activeTab === 'user-management' && <div className="w-1 h-6 bg-blue-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('user-security')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'user-security'
                      ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  style={{ animationDelay: '40ms' }}
                >
                  <Key className={`w-4 h-4 flex-shrink-0 ${activeTab === 'user-security' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'user-security' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Security
                    </div>
                  </div>
                  {activeTab === 'user-security' && <div className="w-1 h-6 bg-blue-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                </button>
              </div>
            )}
          </div>

          {/* Integrations Section - Collapsible (Super Admin only) */}
          {canAccessIntegrations && (
            <div className="mb-2">
              <button
                onClick={() => setIntegrationsExpanded(!integrationsExpanded)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <LinkIcon className="w-4 h-4 flex-shrink-0 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white" />
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    Integrations
                  </div>
                </div>
                {integrationsExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 rotate-180" />
                )}
              </button>

              {integrationsExpanded && (
                <div className="mt-1 ml-2 space-y-1 collapsible-section collapsible-section-enter">
                  <button
                    onClick={() => setActiveTab('printavo-integration')}
                    className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                      activeTab === 'printavo-integration'
                        ? 'bg-green-50 dark:bg-blue-600/20 text-green-700 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Key className={`w-4 h-4 flex-shrink-0 ${activeTab === 'printavo-integration' ? 'text-green-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                    <div className="flex-1 text-left">
                      <div className={`font-medium text-sm ${activeTab === 'printavo-integration' ? 'text-green-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        Printavo
                      </div>
                    </div>
                    {activeTab === 'printavo-integration' && <div className="w-1 h-6 bg-green-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                  </button>

                  <button
                    onClick={() => setActiveTab('square-integration')}
                    className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                      activeTab === 'square-integration'
                        ? 'bg-green-50 dark:bg-blue-600/20 text-green-700 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    style={{ animationDelay: '20ms' }}
                  >
                    <CreditCard className={`w-4 h-4 flex-shrink-0 ${activeTab === 'square-integration' ? 'text-green-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                    <div className="flex-1 text-left">
                      <div className={`font-medium text-sm ${activeTab === 'square-integration' ? 'text-green-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        Square
                      </div>
                    </div>
                    {activeTab === 'square-integration' && <div className="w-1 h-6 bg-green-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                  </button>

                  <button
                    onClick={() => setActiveTab('resend-integration')}
                    className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                      activeTab === 'resend-integration'
                        ? 'bg-green-50 dark:bg-blue-600/20 text-green-700 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    style={{ animationDelay: '40ms' }}
                  >
                    <SettingsIcon className={`w-4 h-4 flex-shrink-0 ${activeTab === 'resend-integration' ? 'text-green-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                    <div className="flex-1 text-left">
                      <div className={`font-medium text-sm ${activeTab === 'resend-integration' ? 'text-green-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        Resend Email
                      </div>
                    </div>
                    {activeTab === 'resend-integration' && <div className="w-1 h-6 bg-green-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                  </button>

                  <button
                    onClick={() => setActiveTab('twilio-integration')}
                    className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                      activeTab === 'twilio-integration'
                        ? 'bg-green-50 dark:bg-blue-600/20 text-green-700 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    style={{ animationDelay: '50ms' }}
                  >
                    <MessageSquare className={`w-4 h-4 flex-shrink-0 ${activeTab === 'twilio-integration' ? 'text-green-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                    <div className="flex-1 text-left">
                      <div className={`font-medium text-sm ${activeTab === 'twilio-integration' ? 'text-green-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        Twilio SMS
                      </div>
                    </div>
                    {activeTab === 'twilio-integration' && <div className="w-1 h-6 bg-green-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                  </button>

                  <button
                    onClick={() => setActiveTab('stripe-payments')}
                    className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                      activeTab === 'stripe-payments'
                        ? 'bg-green-50 dark:bg-blue-600/20 text-green-700 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                    }`}
                    style={{ animationDelay: '60ms' }}
                  >
                    <CreditCard className={`w-4 h-4 flex-shrink-0 ${activeTab === 'stripe-payments' ? 'text-green-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                    <div className="flex-1 text-left">
                      <div className={`font-medium text-sm ${activeTab === 'stripe-payments' ? 'text-green-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        Stripe
                      </div>
                    </div>
                    {activeTab === 'stripe-payments' && <div className="w-1 h-6 bg-green-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Accounting Settings Section - Collapsible */}
          <div className="mb-2">
            <button
              onClick={() => setAccountingExpanded(!accountingExpanded)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-700/50"
            >
              <CreditCard className="w-4 h-4 flex-shrink-0 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white" />
              <div className="flex-1 text-left">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  Accounting Settings
                </div>
              </div>
              {accountingExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 rotate-180" />
              )}
            </button>

            {accountingExpanded && (
              <div className="mt-1 ml-2 space-y-1 collapsible-section collapsible-section-enter">
                <button
                  onClick={() => setActiveTab('billing-status-filters')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'billing-status-filters'
                      ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Filter className={`w-4 h-4 flex-shrink-0 ${activeTab === 'billing-status-filters' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'billing-status-filters' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Billing Filters
                    </div>
                  </div>
                  {activeTab === 'billing-status-filters' && <div className="w-1 h-6 bg-blue-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                </button>

                <button
                  onClick={() => setActiveTab('automated-reports')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'automated-reports'
                      ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  style={{ animationDelay: '20ms' }}
                >
                  <Clock className={`w-4 h-4 flex-shrink-0 ${activeTab === 'automated-reports' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'automated-reports' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Automated Reports
                    </div>
                  </div>
                  {activeTab === 'automated-reports' && <div className="w-1 h-6 bg-blue-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                </button>
              </div>
            )}
          </div>

          {/* Production Settings Section - Collapsible */}
          <div className="mb-2">
            <button
              onClick={() => setProductionExpanded(!productionExpanded)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-700/50"
            >
              <SettingsIcon className="w-4 h-4 flex-shrink-0 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white" />
              <div className="flex-1 text-left">
                <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                  Production Settings
                </div>
              </div>
              {productionExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 rotate-180" />
              )}
            </button>

            {productionExpanded && (
              <div className="mt-1 ml-2 space-y-1 collapsible-section collapsible-section-enter">
                <button
                  onClick={() => setActiveTab('production-general')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'production-general'
                      ? 'bg-green-50 dark:bg-green-600/20 text-green-700 dark:text-green-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <SettingsIcon className={`w-4 h-4 flex-shrink-0 ${activeTab === 'production-general' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'production-general' ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      General Settings
                    </div>
                  </div>
                  {activeTab === 'production-general' && <div className="w-1 h-6 bg-green-600 dark:bg-green-500 rounded-full absolute right-0" />}
                </button>

                <button
                  onClick={() => setActiveTab('workflow-setup')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'workflow-setup'
                      ? 'bg-green-50 dark:bg-green-600/20 text-green-700 dark:text-green-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  style={{ animationDelay: '40ms' }}
                >
                  <Layers className={`w-4 h-4 flex-shrink-0 ${activeTab === 'workflow-setup' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'workflow-setup' ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Workflow Setup
                    </div>
                  </div>
                  {activeTab === 'workflow-setup' && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                </button>

                <button
                  onClick={() => setActiveTab('automations')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'automations'
                      ? 'bg-green-50 dark:bg-green-600/20 text-green-700 dark:text-green-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  style={{ animationDelay: '60ms' }}
                >
                  <Zap className={`w-4 h-4 flex-shrink-0 ${activeTab === 'automations' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'automations' ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Automations
                    </div>
                  </div>
                  {activeTab === 'automations' && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                </button>

                <button
                  onClick={() => setActiveTab('price-matrices')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'price-matrices'
                      ? 'bg-green-50 dark:bg-green-600/20 text-green-700 dark:text-green-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  style={{ animationDelay: '80ms' }}
                >
                  <Grid3x3 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'price-matrices' ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'price-matrices' ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      Price Matrices
                    </div>
                  </div>
                  {activeTab === 'price-matrices' && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900">
        <div className="p-8 max-w-4xl mx-auto">
          {activeTab === 'company-info' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Settings</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Manage your company information and branding</p>
                {!isAdmin && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm">
                    Access Denied: Only Admins and Super Admins can edit Company Settings.
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="border-b border-gray-200 dark:border-slate-700 pb-6">
                  <h3 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-4">Company Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Company Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        disabled={!isAdmin}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                        placeholder="Enter company name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Company Address
                      </label>
                      <textarea
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        disabled={!isAdmin}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                        placeholder="Enter company address&#10;Street Address&#10;City, State ZIP"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Company Phone
                        </label>
                        <input
                          type="tel"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          disabled={!isAdmin}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                          placeholder="(555) 123-4567"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Company Email
                        </label>
                        <input
                          type="email"
                          value={companyEmail}
                          onChange={(e) => setCompanyEmail(e.target.value)}
                          disabled={!isAdmin}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                          placeholder="info@company.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-b border-gray-200 dark:border-slate-700 pb-6">
                  <h3 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-4">Company Branding</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Primary Logo
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Used for invoice PDFs, emails, and customer-facing branding
                      </p>
                      {primaryLogoPreview ? (
                        <div className="space-y-3">
                          <div className="w-64 h-48 border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 flex items-center justify-center p-4">
                            <img
                              src={primaryLogoPreview}
                              alt="Primary logo"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors cursor-pointer text-sm">
                                <Edit className="w-4 h-4" />
                                Replace Logo
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                                  onChange={handlePrimaryLogoChange}
                                  className="hidden"
                                />
                              </label>
                              <button
                                onClick={removePrimaryLogo}
                                className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 dark:bg-slate-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove Logo
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center gap-3 px-6 py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg transition-colors ${isAdmin ? 'hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer' : 'bg-gray-50 dark:bg-slate-800 cursor-not-allowed'}`}>
                          <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                          <div className="text-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {isAdmin ? 'Click to upload primary logo' : 'No primary logo uploaded'}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              PNG, JPG, or SVG (max 5MB)
                            </p>
                          </div>
                          {isAdmin && (
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                              onChange={handlePrimaryLogoChange}
                              className="hidden"
                            />
                          )}
                        </label>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Secondary Logo
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Used for dark mode, alternate layouts, or watermarking
                      </p>
                      {secondaryLogoPreview ? (
                        <div className="space-y-3">
                          <div className="w-64 h-48 border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 flex items-center justify-center p-4">
                            <img
                              src={secondaryLogoPreview}
                              alt="Secondary logo"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors cursor-pointer text-sm">
                                <Edit className="w-4 h-4" />
                                Replace Logo
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                                  onChange={handleSecondaryLogoChange}
                                  className="hidden"
                                />
                              </label>
                              <button
                                onClick={removeSecondaryLogo}
                                className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 dark:bg-slate-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm"
                              >
                                <Trash2 className="w-4 h-4" />
                                Remove Logo
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center gap-3 px-6 py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg transition-colors ${isAdmin ? 'hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer' : 'bg-gray-50 dark:bg-slate-800 cursor-not-allowed'}`}>
                          <Upload className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                          <div className="text-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {isAdmin ? 'Click to upload secondary logo' : 'No secondary logo uploaded'}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              PNG, JPG, or SVG (max 5MB)
                            </p>
                          </div>
                          {isAdmin && (
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                              onChange={handleSecondaryLogoChange}
                              className="hidden"
                            />
                          )}
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="pt-4">
                    <button
                      onClick={saveCompanySettings}
                      disabled={savingCompany}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 transition-colors"
                    >
                      {savingCompany ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'printavo-integration' && canAccessIntegrations && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Printavo Integration</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Connect your Printavo account to sync data</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Printavo Email / Username
                  </label>
                  <input
                    type="email"
                    value={printavoUsername}
                    onChange={(e) => setPrintavoUsername(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your Printavo account email</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Printavo API Token
                  </label>
                  <div className="relative">
                    <input
                      type={showPrintavoToken ? 'text' : 'password'}
                      value={printavoToken}
                      onChange={(e) => setPrintavoToken(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={companySettings?.printavo_api_token_encrypted ? '••••••••••••••••' : 'Enter your API token'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPrintavoToken(!showPrintavoToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPrintavoToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {companySettings?.printavo_api_token_encrypted
                      ? 'Token is saved and encrypted. Enter a new token to update it.'
                      : 'Find your API token in Printavo Settings → Integrations'}
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    onClick={saveIntegration}
                    disabled={savingIntegration}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingIntegration ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Credentials
                      </>
                    )}
                  </button>
                </div>

                {companySettings?.printavo_username && (
                  <>
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                          <Key className="w-5 h-5" />
                          <div>
                            <p className="font-medium">Integration Active</p>
                            <p className="text-sm mt-1">Connected as: {companySettings.printavo_username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={syncPrintavoData}
                            disabled={syncingPrintavoData}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {syncingPrintavoData ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4" />
                                Sync Now
                              </>
                            )}
                          </button>
                          <button
                            onClick={testPrintavoConnection}
                            disabled={testingConnection}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 disabled:opacity-50 transition-colors"
                          >
                            {testingConnection ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              'Test Connection'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {syncResult && (
                      <div className={`mt-4 p-4 rounded-lg border ${syncResult.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                        <p className={`text-sm ${syncResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                          {syncResult.message}
                        </p>
                      </div>
                    )}

                    {testResult && (
                      <div className={`p-4 rounded-lg border ${
                        testResult.success
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : testResult.error === 'Rate limit exceeded'
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }`}>
                        <div className="space-y-3">
                          <div className={`font-medium text-lg ${
                            testResult.success
                              ? 'text-green-800 dark:text-green-200'
                              : testResult.error === 'Rate limit exceeded'
                                ? 'text-yellow-800 dark:text-yellow-200'
                                : 'text-red-800 dark:text-red-200'
                          }`}>
                            {testResult.success
                              ? '✓ Connection Successful!'
                              : testResult.error === 'Rate limit exceeded'
                                ? '⚠ Rate Limit Exceeded'
                                : '✗ Connection Failed'}
                          </div>

                          {testResult.success && testResult.company && (
                            <div className="text-sm text-green-700 dark:text-green-300">
                              Connected to: <strong>{testResult.company.name}</strong>
                            </div>
                          )}

                          {testResult.error === 'Rate limit exceeded' && (
                            <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-2">
                              <p className="font-medium">
                                {testResult.printavoError || 'Too many requests to Printavo API. Please wait a moment before testing again.'}
                              </p>
                              <p className="text-xs">
                                Your credentials may be correct, but Printavo is temporarily limiting API requests.
                                Wait 30-60 seconds and try again.
                              </p>
                            </div>
                          )}

                          {testResult.error && testResult.error !== 'Rate limit exceeded' && (
                            <div className="text-sm text-red-700 dark:text-red-300 font-medium">
                              Error: {testResult.error}
                            </div>
                          )}

                          {testResult.printavoError && testResult.error !== 'Rate limit exceeded' && (
                            <div className="text-sm text-red-700 dark:text-red-300 font-medium">
                              Printavo Error: {testResult.printavoError}
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Diagnostics:</div>
                            <pre className="text-xs p-3 bg-white dark:bg-slate-900 rounded border border-gray-300 dark:border-gray-600 overflow-x-auto max-h-96">
                              {JSON.stringify(testResult, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bug className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                          <span className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">Debug: Test Printavo Data Structure</span>
                        </div>
                        <button
                          onClick={runPrintavoTest}
                          disabled={testLoading}
                          className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                        >
                          {testLoading ? 'Loading...' : 'Run Test'}
                        </button>
                      </div>
                    </div>

                    {testData && (
                      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border border-gray-200 dark:border-slate-600">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Printavo API Response</h3>
                          <button
                            onClick={() => setTestData(null)}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            Close
                          </button>
                        </div>
                        <pre className="bg-gray-50 dark:bg-slate-900 p-4 rounded overflow-auto max-h-96 text-xs">
                          {JSON.stringify(testData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'square-integration' && canAccessIntegrations && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Square Integration</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Connect your Square account to access payment data</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Square Access Token <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSquareToken ? 'text' : 'password'}
                      value={squareAccessToken}
                      onChange={(e) => setSquareAccessToken(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder={companySettings?.square_access_token ? '••••••••••••••••' : 'Enter your Square access token'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSquareToken(!showSquareToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showSquareToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {companySettings?.square_access_token
                      ? 'Token is saved and encrypted. Enter a new token to update it.'
                      : 'Find your access token in Square Developer Dashboard'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Application ID
                  </label>
                  <input
                    type="text"
                    value={squareApplicationId}
                    onChange={(e) => setSquareApplicationId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="sq0idp-XXXXXXXXXXXXXXXXXXXX"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your Square Application ID</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location ID
                  </label>
                  <input
                    type="text"
                    value={squareLocationId}
                    onChange={(e) => setSquareLocationId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="L1234567890"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your Square Location ID (leave blank for all locations)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Environment
                  </label>
                  <select
                    value={squareEnvironment}
                    onChange={(e) => setSquareEnvironment(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="production">Production</option>
                    <option value="sandbox">Sandbox (Testing)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select production for live data or sandbox for testing</p>
                </div>

                <div className="pt-4">
                  <button
                    onClick={saveSquareIntegration}
                    disabled={savingSquare}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {savingSquare ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Square Credentials
                      </>
                    )}
                  </button>
                </div>

                {companySettings?.square_access_token && (
                  <>
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                          <Key className="w-5 h-5" />
                          <div>
                            <p className="font-medium">Square Integration Active</p>
                            <p className="text-sm mt-1">Environment: {companySettings.square_environment || 'production'}</p>
                          </div>
                        </div>
                        <button
                          onClick={testSquareConnection}
                          disabled={testingSquare}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 disabled:opacity-50 transition-colors"
                        >
                          {testingSquare ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            'Test Connection'
                          )}
                        </button>
                      </div>
                    </div>

                    {squareTestResult && (
                      <div className={`p-4 rounded-lg border ${squareTestResult.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                        <div className="space-y-3">
                          {squareTestResult.success ? (
                            <>
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                  ✓
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-green-900 dark:text-green-100">Connection Successful!</h4>
                                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">{squareTestResult.message}</p>
                                  {squareTestResult.locations && squareTestResult.locations.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-medium text-green-900 dark:text-green-100 mb-2">Locations:</p>
                                      <ul className="text-xs text-green-800 dark:text-green-200 space-y-1">
                                        {squareTestResult.locations.slice(0, 5).map((loc: any) => (
                                          <li key={loc.id}>
                                            {loc.name} ({loc.id})
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-bold">
                                  ✕
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-red-900 dark:text-red-100">Connection Failed</h4>
                                  <p className="text-sm text-red-800 dark:text-red-200 mt-1">{squareTestResult.error}</p>
                                </div>
                              </div>
                            </>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Diagnostics:</div>
                            <pre className="text-xs p-3 bg-white dark:bg-slate-900 rounded border border-gray-300 dark:border-gray-600 overflow-x-auto max-h-96">
                              {JSON.stringify(squareTestResult, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'resend-integration' && canAccessIntegrations && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resend Email Integration</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Connect Resend to send transactional emails</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Resend API Key <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showResendKey ? 'text' : 'password'}
                      value={resendApiKey}
                      onChange={(e) => setResendApiKey(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={companySettings?.resend_api_key ? '••••••••••••••••' : 'Enter your Resend API key'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowResendKey(!showResendKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showResendKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {companySettings?.resend_api_key
                      ? 'API key is saved and encrypted. Enter a new key to update it.'
                      : 'Get your API key from Resend Dashboard → API Keys'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    From Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={emailFromAddress}
                    onChange={(e) => setEmailFromAddress(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="invoices@yourdomain.com"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Must use an email address from your verified domain (e.g., invoices@toddssportinggoods.com)
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    <strong>Note:</strong> You'll also need to verify your sending domain in the Resend dashboard before you can send emails.
                  </p>
                  <a
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline mt-2 inline-block"
                  >
                    Get API Key from Resend →
                  </a>
                </div>

                <div className="pt-4">
                  <button
                    onClick={saveResendIntegration}
                    disabled={savingResend}
                    className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {savingResend ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Resend Credentials
                      </>
                    )}
                  </button>
                </div>

                {companySettings?.resend_api_key && (
                  <>
                    <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-800 dark:text-purple-200">
                          <Key className="w-5 h-5" />
                          <div>
                            <p className="font-medium">Resend Integration Active</p>
                            <p className="text-sm mt-1">Email sending is configured and ready to use</p>
                          </div>
                        </div>
                        <button
                          onClick={testResendConnection}
                          disabled={testingResend}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 disabled:opacity-50 transition-colors"
                        >
                          {testingResend ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            'Test Connection'
                          )}
                        </button>
                      </div>
                    </div>

                    {resendTestResult && (
                      <div className={`p-4 rounded-lg border ${resendTestResult.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                        <div className="space-y-3">
                          {resendTestResult.success ? (
                            <>
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                  ✓
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-green-900 dark:text-green-100">Connection Successful!</h4>
                                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">{resendTestResult.message}</p>
                                  {resendTestResult.emailId && (
                                    <p className="text-xs text-green-700 dark:text-green-300 mt-2">Email ID: {resendTestResult.emailId}</p>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-bold">
                                  ✕
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-red-900 dark:text-red-100">Connection Failed</h4>
                                  <p className="text-sm text-red-800 dark:text-red-200 mt-1">{resendTestResult.error}</p>
                                </div>
                              </div>
                            </>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Diagnostics:</div>
                            <pre className="text-xs p-3 bg-white dark:bg-slate-900 rounded border border-gray-300 dark:border-gray-600 overflow-x-auto max-h-96">
                              {JSON.stringify(resendTestResult, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Available Email Templates:</p>
                  <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-4 list-disc">
                    <li>Invoice Reminders</li>
                    <li>Payment Confirmations</li>
                    <li>Overdue Notices</li>
                    <li>Welcome Emails</li>
                    <li>Custom HTML Emails</li>
                  </ul>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    See <code className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded">EMAIL_GUIDE.md</code> for usage examples
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'twilio-integration' && canAccessIntegrations && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Twilio SMS Integration</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Connect Twilio to send invoice notifications via text message</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Twilio Account SID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showTwilioSid ? 'text' : 'password'}
                      value={twilioAccountSid}
                      onChange={(e) => setTwilioAccountSid(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder={companySettings?.twilio_account_sid ? '••••••••••••••••' : 'Enter your Twilio Account SID'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowTwilioSid(!showTwilioSid)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showTwilioSid ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {companySettings?.twilio_account_sid
                      ? 'Account SID is saved and encrypted. Enter a new value to update it.'
                      : 'Found in your Twilio Console Dashboard'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Twilio Auth Token <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showTwilioToken ? 'text' : 'password'}
                      value={twilioAuthToken}
                      onChange={(e) => setTwilioAuthToken(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder={companySettings?.twilio_auth_token ? '••••••••••••••••' : 'Enter your Twilio Auth Token'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowTwilioToken(!showTwilioToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showTwilioToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {companySettings?.twilio_auth_token
                      ? 'Auth Token is saved and encrypted. Enter a new value to update it.'
                      : 'Found in your Twilio Console Dashboard'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Twilio Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={twilioPhoneNumber}
                    onChange={(e) => setTwilioPhoneNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="+14155551234"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Your Twilio phone number in E.164 format (e.g., +14155551234)
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={twilioEnabled}
                      onChange={(e) => setTwilioEnabled(e.target.checked)}
                      className="w-4 h-4 text-green-600 border-gray-300 dark:border-gray-600 rounded focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable SMS sending</span>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                    When enabled, you can send invoices via text message
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Default Send Method
                  </label>
                  <select
                    value={defaultSendMethod}
                    onChange={(e) => setDefaultSendMethod(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="email">Email Only</option>
                    <option value="sms">Text Message Only</option>
                    <option value="both">Both Email and Text</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Default method for sending invoices (can be changed per invoice)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SMS Message Template
                  </label>
                  <textarea
                    value={smsMessageTemplate}
                    onChange={(e) => setSmsMessageTemplate(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                    placeholder="Hi {CustomerName}, your invoice {InvoiceNumber} is ready..."
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Available placeholders: {'{CustomerName}'}, {'{InvoiceNumber}'}, {'{Amount}'}, {'{PaymentLink}'}
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    <strong>Note:</strong> Make sure your Twilio account is active and has sufficient credits to send SMS messages. Standard SMS rates apply.
                  </p>
                  <a
                    href="https://console.twilio.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline mt-2 inline-block"
                  >
                    Open Twilio Console →
                  </a>
                </div>

                <div className="pt-4">
                  <button
                    onClick={saveTwilioIntegration}
                    disabled={savingTwilio}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {savingTwilio ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Twilio Credentials
                      </>
                    )}
                  </button>
                </div>

                {companySettings?.twilio_account_sid && (
                  <>
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                          <MessageSquare className="w-5 h-5" />
                          <div>
                            <p className="font-medium">Twilio Integration Active</p>
                            <p className="text-sm mt-1">SMS sending is configured and ready to use</p>
                          </div>
                        </div>
                        <button
                          onClick={testTwilioConnection}
                          disabled={testingTwilio}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 disabled:opacity-50 transition-colors"
                        >
                          {testingTwilio ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            'Test Connection'
                          )}
                        </button>
                      </div>
                    </div>

                    {twilioTestResult && (
                      <div className={`p-4 rounded-lg border ${twilioTestResult.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                        <div className="space-y-3">
                          {twilioTestResult.success ? (
                            <>
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                  ✓
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-green-900 dark:text-green-100">Connection Successful!</h4>
                                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">{twilioTestResult.message}</p>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-bold">
                                  ✕
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-red-900 dark:text-red-100">Connection Failed</h4>
                                  <p className="text-sm text-red-800 dark:text-red-200 mt-1">{twilioTestResult.error}</p>
                                </div>
                              </div>
                            </>
                          )}

                          {twilioTestResult.details && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Diagnostics:</div>
                              <pre className="text-xs p-3 bg-white dark:bg-slate-900 rounded border border-gray-300 dark:border-gray-600 overflow-x-auto max-h-96">
                                {JSON.stringify(twilioTestResult.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'user-management' && isAdmin && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">User Management</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Add and manage team members</p>
                </div>
                <button
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </button>
              </div>

              {showAddUser && (
                <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Add New User</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-600 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="user@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-600 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Role
                      </label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-600 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addUser}
                        disabled={addingUser}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {addingUser ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Add User
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowAddUser(false)}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="divide-y divide-gray-200 dark:divide-slate-600 border border-gray-200 dark:border-slate-600 rounded-lg">
                {users.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">No users found</p>
                ) : (
                  users.map((userProfile) => (
                    <div key={userProfile.id}>
                      {editingUserId === userProfile.id ? (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20">
                          <div className="flex items-center gap-2 mb-4">
                            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            <h4 className="font-medium text-gray-900 dark:text-white">Edit User</h4>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Email Address *
                              </label>
                              <input
                                type="email"
                                value={editingUserEmail}
                                onChange={(e) => setEditingUserEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="user@example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Full Name
                              </label>
                              <input
                                type="text"
                                value={editingUserName}
                                onChange={(e) => setEditingUserName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="John Doe"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Role
                              </label>
                              <select
                                value={editingUserRole}
                                onChange={(e) => setEditingUserRole(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="super_admin">Super Admin</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                            <div className="border-t border-gray-200 dark:border-slate-600 pt-3">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Change Password (Optional)</p>
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    New Password
                                  </label>
                                  <input
                                    type="password"
                                    value={editingUserPassword}
                                    onChange={(e) => setEditingUserPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Leave blank to keep current password"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Confirm New Password
                                  </label>
                                  <input
                                    type="password"
                                    value={editingUserPasswordConfirm}
                                    onChange={(e) => setEditingUserPasswordConfirm(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Re-enter new password"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateUser(userProfile.id)}
                                disabled={updatingUser}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {updatingUser ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Updating...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                  </>
                                )}
                              </button>
                              <button
                                onClick={cancelEditUser}
                                disabled={updatingUser}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {userProfile.full_name || 'No name'}
                                {userProfile.id === user?.id && (
                                  <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(You)</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {userProfile.email}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-slate-700 rounded-full">
                              <Shield className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {userProfile.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                              </span>
                            </div>
                            <button
                              onClick={() => startEditUser(userProfile)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {userProfile.id !== user?.id && (
                              <button
                                onClick={() => deleteUser(userProfile.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'user-security' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Security Settings</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Manage your unlock PIN for financially locked invoices</p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Unlock PIN</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {hasExistingPin
                    ? 'You have set an unlock PIN. Enter your current PIN to change it.'
                    : 'Set a PIN to unlock financially locked invoices. Minimum 4 characters.'}
                </p>

                <div className="space-y-4">
                  {hasExistingPin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Current PIN
                      </label>
                      <input
                        type="password"
                        value={currentPin}
                        onChange={(e) => setCurrentPin(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter current PIN"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {hasExistingPin ? 'New PIN' : 'PIN'}
                    </label>
                    <input
                      type="password"
                      value={unlockPin}
                      onChange={(e) => setUnlockPin(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter PIN (min 4 characters)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirm {hasExistingPin ? 'New ' : ''}PIN
                    </label>
                    <input
                      type="password"
                      value={unlockPinConfirm}
                      onChange={(e) => setUnlockPinConfirm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Confirm PIN"
                    />
                  </div>

                  {pinSaveMessage && (
                    <div className={`p-3 rounded-lg ${
                      pinSaveMessage.type === 'success'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                    }`}>
                      {pinSaveMessage.text}
                    </div>
                  )}

                  <button
                    onClick={saveUnlockPin}
                    disabled={savingPin}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingPin ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {hasExistingPin ? 'Update PIN' : 'Set PIN'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">About Unlock PINs</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                  <li>PINs are used to unlock financially locked invoices</li>
                  <li>Each user sets their own unique PIN</li>
                  <li>PINs are encrypted and stored securely</li>
                  <li>Only users with the correct PIN can unlock invoices</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'billing-status-filters' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Billing & Payments Status Filters</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Select which statuses should appear in Billing Queue, then click Save to apply.</p>
                </div>
                <button
                  onClick={syncStatuses}
                  disabled={syncingStatuses || loadingStatuses}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {syncingStatuses ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Sync from Printavo
                    </>
                  )}
                </button>
              </div>

              {billingFiltersSaveMessage && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  billingFiltersSaveMessage.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}>
                  {billingFiltersSaveMessage.type === 'success' ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className="text-sm font-medium">{billingFiltersSaveMessage.text}</span>
                </div>
              )}

              {loadingStatuses ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              ) : fullStatuses.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No statuses found. Click "Sync from Printavo" to fetch all available statuses.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {fullStatuses.filter(s => s.is_billing_eligible).length} of {fullStatuses.length} statuses enabled for billing
                      {pendingBillingChanges.size > 0 && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                          ({pendingBillingChanges.size} unsaved change{pendingBillingChanges.size !== 1 ? 's' : ''})
                        </span>
                      )}
                    </p>
                  </div>

                  {['Invoice', 'Quote'].map(statusType => {
                    const typeStatuses = fullStatuses.filter(s => s.type === statusType);
                    if (typeStatuses.length === 0) return null;
                    return (
                      <div key={statusType} className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                          <Layers className="w-4 h-4" />
                          {statusType} Statuses ({typeStatuses.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {typeStatuses.map(status => (
                            <button
                              key={status.id}
                              onClick={() => toggleBillingEligibility(status.id, status.is_billing_eligible)}
                              className={`flex items-center gap-3 p-3 rounded-lg transition-all border ${
                                status.is_billing_eligible
                                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                  : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'
                              }`}
                            >
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600"
                                style={{ backgroundColor: status.color || '#9ca3af' }}
                              />
                              <span className={`text-sm flex-1 text-left ${status.is_billing_eligible ? 'text-blue-900 dark:text-blue-200 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                                {status.name}
                              </span>
                              <div className={`w-5 h-5 rounded flex items-center justify-center ${
                                status.is_billing_eligible ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                              }`}>
                                {status.is_billing_eligible && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {fullStatuses.filter(s => !s.type || (s.type !== 'Invoice' && s.type !== 'Quote')).length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        Other Statuses
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {fullStatuses.filter(s => !s.type || (s.type !== 'Invoice' && s.type !== 'Quote')).map(status => (
                          <button
                            key={status.id}
                            onClick={() => toggleBillingEligibility(status.id, status.is_billing_eligible)}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-all border ${
                              status.is_billing_eligible
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'
                            }`}
                          >
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600"
                              style={{ backgroundColor: status.color || '#9ca3af' }}
                            />
                            <span className={`text-sm flex-1 text-left ${status.is_billing_eligible ? 'text-blue-900 dark:text-blue-200 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                              {status.name}
                            </span>
                            <div className={`w-5 h-5 rounded flex items-center justify-center ${
                              status.is_billing_eligible ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                            }`}>
                              {status.is_billing_eligible && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-6 border-t border-gray-200 dark:border-slate-600 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={saveBillingFilters}
                        disabled={savingBillingFilters || pendingBillingChanges.size === 0}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                          pendingBillingChanges.size > 0
                            ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        } disabled:opacity-50`}
                      >
                        {savingBillingFilters ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Filters
                          </>
                        )}
                      </button>
                      {pendingBillingChanges.size > 0 && (
                        <button
                          onClick={discardBillingChanges}
                          disabled={savingBillingFilters}
                          className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          Discard Changes
                        </button>
                      )}
                    </div>
                    {pendingBillingChanges.size > 0 && (
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        You have unsaved changes
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}


          {activeTab === 'automated-reports' && (
            <AutomatedReports />
          )}

          {activeTab === 'workflow-setup' && (
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              }>
                <WorkflowCustomization />
              </Suspense>
          )}

          {activeTab === 'automations' && (
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
              </div>
            }>
              <AutomationsDashboard />
            </Suspense>
          )}

          {activeTab === 'price-matrices' && (
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-green-600 dark:text-green-400 animate-spin" />
              </div>
            }>
              <PriceMatricesManager />
            </Suspense>
          )}

          {activeTab === 'stripe-payments' && canAccessIntegrations && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Stripe Payment Integration</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Configure Stripe to accept online payments from customers</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Stripe Publishable Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={stripePublicKey}
                    onChange={(e) => setStripePublicKey(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={companySettings?.stripe_public_key ? '••••••••••••••••' : 'pk_live_...'}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {companySettings?.stripe_public_key
                      ? 'Publishable key is saved and encrypted. Enter a new key to update it.'
                      : 'Your publishable key from Stripe Dashboard → Developers → API keys'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Stripe Secret Key <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showStripeSecretKey ? 'text' : 'password'}
                      value={stripeSecretKey}
                      onChange={(e) => setStripeSecretKey(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={companySettings?.stripe_secret_key ? '••••••••••••••••' : 'sk_live_...'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowStripeSecretKey(!showStripeSecretKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showStripeSecretKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {companySettings?.stripe_secret_key
                      ? 'Secret key is saved and encrypted. Enter a new key to update it.'
                      : 'Your secret key from Stripe Dashboard → Developers → API keys (keep this confidential)'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Stripe Webhook Secret
                  </label>
                  <div className="relative">
                    <input
                      type={showStripeWebhookSecret ? 'text' : 'password'}
                      value={stripeWebhookSecret}
                      onChange={(e) => setStripeWebhookSecret(e.target.value)}
                      className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={companySettings?.stripe_webhook_secret ? '••••••••••••••••' : 'whsec_...'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowStripeWebhookSecret(!showStripeWebhookSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showStripeWebhookSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {companySettings?.stripe_webhook_secret
                      ? 'Webhook secret is saved and encrypted. Enter a new secret to update it.'
                      : 'Your webhook signing secret from Stripe Dashboard → Developers → Webhooks'}
                  </p>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">Setup Instructions:</p>
                    <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside ml-2">
                      <li>Create a Stripe account at <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="underline">stripe.com</a></li>
                      <li>Get your API keys from Stripe Dashboard → Developers → API keys</li>
                      <li>Set up a webhook endpoint for payment notifications (optional)</li>
                      <li>Enter your credentials above and save</li>
                    </ol>
                  </div>
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline inline-block"
                  >
                    Get API Keys from Stripe →
                  </a>
                </div>

                <div className="pt-4">
                  <button
                    onClick={saveStripeIntegration}
                    disabled={savingStripe}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {savingStripe ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Stripe Credentials
                      </>
                    )}
                  </button>
                </div>

                {companySettings?.stripe_secret_key && (
                  <>
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                          <CreditCard className="w-5 h-5" />
                          <div>
                            <p className="font-medium">Stripe Integration Active</p>
                            <p className="text-sm mt-1">Payment processing is configured and ready to use</p>
                          </div>
                        </div>
                        <button
                          onClick={testStripeConnection}
                          disabled={testingStripe}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors"
                        >
                          {testingStripe ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            'Test Connection'
                          )}
                        </button>
                      </div>
                    </div>

                    {stripeTestResult && (
                      <div className={`p-4 rounded-lg border ${stripeTestResult.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                        <div className="space-y-3">
                          {stripeTestResult.success ? (
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                ✓
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-green-900 dark:text-green-100">Connection Successful!</h4>
                                <p className="text-sm text-green-800 dark:text-green-200 mt-1">{stripeTestResult.message}</p>
                                {stripeTestResult.balance && (
                                  <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded border border-green-200 dark:border-green-700">
                                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Account Balance:</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Available</p>
                                        <p className="text-lg font-semibold text-green-700 dark:text-green-400">
                                          ${stripeTestResult.balance.available.toFixed(2)} {stripeTestResult.balance.currency.toUpperCase()}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
                                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                                          ${stripeTestResult.balance.pending.toFixed(2)} {stripeTestResult.balance.currency.toUpperCase()}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-bold">
                                ✕
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-red-900 dark:text-red-100">Connection Failed</h4>
                                <p className="text-sm text-red-800 dark:text-red-200 mt-1">{stripeTestResult.error}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Production General Settings Section */}
          {activeTab === 'production-general' && (
            <div className="space-y-3">
              {/* Invoice Fees */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Invoice Fees</h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Configure additional fees for invoices</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowBulkAddFeesModal(true)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Bulk
                    </button>
                    <button
                      onClick={openAddFeeModal}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                </div>

                {loadingFees ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                ) : invoiceFees.length === 0 ? (
                  <div className="text-center py-3 text-gray-500 dark:text-gray-400">
                    <p className="text-xs">No invoice fees yet. Click "Add" to create one.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {invoiceFees.map((fee) => (
                      <div
                        key={fee.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded hover:bg-gray-100 dark:hover:bg-slate-650 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate">{fee.fee_name}</h3>
                            <span className="px-1 py-0.5 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 whitespace-nowrap">
                              {fee.amount_type === 'dollar' ? `$${fee.amount.toFixed(2)}` : `${fee.amount}%`}
                            </span>
                            {fee.is_taxed && (
                              <span className="px-1 py-0.5 text-xs font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 whitespace-nowrap">
                                Tax
                              </span>
                            )}
                            {fee.show_by_default && (
                              <span className="px-1 py-0.5 text-xs font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 whitespace-nowrap">
                                Auto
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 ml-2">
                          <button
                            onClick={() => openEditFeeModal(fee)}
                            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteFee(fee.id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Decoration Locations */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Decoration Locations</h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Positions on garments (e.g., Left Front, Full Back)</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowBulkAddLocationsModal(true)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Bulk
                    </button>
                    <button
                      onClick={openAddLocationModal}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                </div>

                {loadingLocations ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                ) : decorationLocations.length === 0 ? (
                  <div className="text-center py-3 text-gray-500 dark:text-gray-400">
                    <p className="text-xs">No decoration locations yet. Click "Add" to create one.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {decorationLocations.map((location) => (
                      <div
                        key={location.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded hover:bg-gray-100 dark:hover:bg-slate-650 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate">{location.decoration_name}</h3>
                        </div>
                        <div className="flex items-center gap-0.5 ml-2">
                          <button
                            onClick={() => openEditLocationModal(location)}
                            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteLocation(location.id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Type of Work */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Type of Work</h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Decoration methods (Screen Print, Embroidery, DTG)</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowBulkAddWorkTypesModal(true)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Bulk
                    </button>
                    <button
                      onClick={openAddWorkTypeModal}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                </div>

                {loadingWorkTypes ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                ) : workTypes.length === 0 ? (
                  <div className="text-center py-3 text-gray-500 dark:text-gray-400">
                    <p className="text-xs">No work types yet. Click "Add" to create one.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {workTypes.map((workType) => (
                      <div
                        key={workType.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded hover:bg-gray-100 dark:hover:bg-slate-650 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-medium text-gray-900 dark:text-white truncate">{workType.work_type_name}</h3>
                            <span className={`px-1 py-0.5 text-xs font-medium rounded whitespace-nowrap ${
                              workType.color_type === 'ink'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                                : workType.color_type === 'thread'
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                                : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200'
                            }`}>
                              {workType.color_type === 'ink' ? 'Ink' : workType.color_type === 'thread' ? 'Thread' : 'None'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 ml-2">
                          <button
                            onClick={() => openEditWorkTypeModal(workType)}
                            className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => deleteWorkType(workType.id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ink Colors */}
              <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" /></div>}>
                <InkThreadColorsManager colorType="ink" />
              </Suspense>

              {/* Thread Colors */}
              <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" /></div>}>
                <InkThreadColorsManager colorType="thread" />
              </Suspense>
            </div>
          )}

          {/* Invoice Fees Section */}
          {activeTab === 'invoice-fees' && (
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Invoice Fees</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Configure additional fees that can be applied to invoices</p>
                </div>
                <button
                  onClick={openAddFeeModal}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Fee
                </button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Invoice Fee Management</h3>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Create fees that auto-populate in quotes/invoices. Fees marked as "Show By Default" will be automatically added to new quotes and invoices.
                    </p>
                  </div>
                </div>
              </div>

              {loadingFees ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              ) : invoiceFees.length === 0 ? (
                <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-8 text-center">
                  <CreditCard className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Invoice Fees</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    You haven't created any invoice fees yet. Click "Add Fee" to create your first fee.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoiceFees.map((fee) => (
                    <div
                      key={fee.id}
                      className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{fee.fee_name}</h3>
                            {fee.show_by_default && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">
                                Auto-Add
                              </span>
                            )}
                            {fee.is_taxed && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-medium">
                                Taxed
                              </span>
                            )}
                          </div>
                          {fee.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{fee.description}</p>
                          )}
                          <div className="text-lg font-bold text-gray-900 dark:text-white">
                            {fee.amount_type === 'dollar' ? `$${fee.amount.toFixed(2)}` : `${fee.amount}%`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleFeeDefault(fee.id, fee.show_by_default)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                            title={fee.show_by_default ? 'Disable auto-add' : 'Enable auto-add'}
                          >
                            {fee.show_by_default ? (
                              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                                <circle cx="10" cy="10" r="8" strokeWidth="2" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => openEditFeeModal(fee)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteFee(fee.id)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add/Edit Fee Modal */}
          {showAddFeeModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {editingFeeId ? 'Edit Invoice Fee' : 'Add Invoice Fee'}
                    </h2>
                    <button
                      onClick={() => setShowAddFeeModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Fee Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={feeFormData.fee_name}
                        onChange={(e) => setFeeFormData({ ...feeFormData, fee_name: e.target.value })}
                        placeholder="e.g., Processing Fee, Late Fee"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <textarea
                        value={feeFormData.description}
                        onChange={(e) => setFeeFormData({ ...feeFormData, description: e.target.value })}
                        placeholder="Optional description"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Amount <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={feeFormData.amount}
                          onChange={(e) => setFeeFormData({ ...feeFormData, amount: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Type
                        </label>
                        <select
                          value={feeFormData.amount_type}
                          onChange={(e) => setFeeFormData({ ...feeFormData, amount_type: e.target.value as 'dollar' | 'percent' })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        >
                          <option value="dollar">$ Dollar</option>
                          <option value="percent">% Percent</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={feeFormData.is_taxed}
                          onChange={(e) => setFeeFormData({ ...feeFormData, is_taxed: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">This fee is taxed</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={feeFormData.show_by_default}
                          onChange={(e) => setFeeFormData({ ...feeFormData, show_by_default: e.target.checked })}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Show by default (auto-add to new quotes/invoices)</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowAddFeeModal(false)}
                      disabled={savingFee}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveFee}
                      disabled={savingFee}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingFee ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {editingFeeId ? 'Update Fee' : 'Create Fee'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add/Edit Decoration Location Modal */}
          {showAddLocationModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {editingLocationId ? 'Edit Decoration Location' : 'Add Decoration Location'}
                    </h2>
                    <button
                      onClick={() => setShowAddLocationModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Location Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={locationFormData.decoration_name}
                        onChange={(e) => setLocationFormData({ ...locationFormData, decoration_name: e.target.value })}
                        placeholder="e.g., Left Front, Full Back, Left Sleeve"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description (Optional)
                      </label>
                      <textarea
                        value={locationFormData.address}
                        onChange={(e) => setLocationFormData({ ...locationFormData, address: e.target.value })}
                        placeholder="Optional description or notes about this decoration location"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowAddLocationModal(false)}
                      disabled={savingLocation}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveLocation}
                      disabled={savingLocation}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingLocation ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {editingLocationId ? 'Update Location' : 'Create Location'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add/Edit Type of Work Modal */}
          {showAddWorkTypeModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {editingWorkTypeId ? 'Edit Type of Work' : 'Add Type of Work'}
                    </h2>
                    <button
                      onClick={() => setShowAddWorkTypeModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Work Type Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={workTypeFormData.work_type_name}
                        onChange={(e) => setWorkTypeFormData({ ...workTypeFormData, work_type_name: e.target.value })}
                        placeholder="e.g., Screen Print, Embroidery, DTG"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Color Type Selection</h3>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                        Choose whether this decoration method uses ink colors, thread colors, or no colors.
                      </p>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors">
                          <input
                            type="radio"
                            checked={workTypeFormData.color_type === 'ink'}
                            onChange={() => setWorkTypeFormData({ ...workTypeFormData, color_type: 'ink' })}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Uses Ink Colors</span>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Screen Printing, DTG, DTF, etc.</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors">
                          <input
                            type="radio"
                            checked={workTypeFormData.color_type === 'thread'}
                            onChange={() => setWorkTypeFormData({ ...workTypeFormData, color_type: 'thread' })}
                            className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Uses Thread Colors</span>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Embroidery</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors">
                          <input
                            type="radio"
                            checked={workTypeFormData.color_type === 'none'}
                            onChange={() => setWorkTypeFormData({ ...workTypeFormData, color_type: 'none' })}
                            className="w-4 h-4 text-gray-600 border-gray-300 focus:ring-gray-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">No Colors</span>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Laser Engraving, Heat Press, etc.</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowAddWorkTypeModal(false)}
                      disabled={savingWorkType}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveWorkType}
                      disabled={savingWorkType}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingWorkType ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {editingWorkTypeId ? 'Update Work Type' : 'Create Work Type'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Add/Edit Thread/Ink Color Modal */}
          {showAddColorStitchModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {editingColorStitchId ? 'Edit Color' : 'Add Thread/Ink Color'}
                    </h2>
                    <button
                      onClick={() => setShowAddColorStitchModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Color Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={colorStitchFormData.option_label}
                        onChange={(e) => setColorStitchFormData({ ...colorStitchFormData, option_label: e.target.value, option_value: e.target.value })}
                        placeholder="e.g., Red, Blue, White, Black, Navy, Forest Green"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter the name of the thread or ink color</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowAddColorStitchModal(false)}
                      disabled={savingColorStitch}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveColorStitchOption}
                      disabled={savingColorStitch}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingColorStitch ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {editingColorStitchId ? 'Update Color' : 'Create Color'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Add Invoice Fees Modal */}
          {showBulkAddFeesModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Bulk Add Invoice Fees
                    </h2>
                    <button
                      onClick={() => setShowBulkAddFeesModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Enter one fee name per line. All fees will be added with default values ($0, not taxed) that you can edit later.
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                        Example:<br />
                        Processing Fee<br />
                        Shipping Fee<br />
                        Setup Fee
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Fee Names (one per line)
                      </label>
                      <textarea
                        value={bulkFeesText}
                        onChange={(e) => setBulkFeesText(e.target.value)}
                        placeholder="Processing Fee&#10;Shipping Fee&#10;Setup Fee"
                        rows={10}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowBulkAddFeesModal(false)}
                      disabled={savingBulkFees}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={bulkAddFees}
                      disabled={savingBulkFees}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingBulkFees ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Add All Fees
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Add Decoration Locations Modal */}
          {showBulkAddLocationsModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Bulk Add Decoration Locations
                    </h2>
                    <button
                      onClick={() => setShowBulkAddLocationsModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Enter one decoration location per line.
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                        Example:<br />
                        Left Front<br />
                        Full Back<br />
                        Left Sleeve<br />
                        Right Sleeve
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Location Names (one per line)
                      </label>
                      <textarea
                        value={bulkLocationsText}
                        onChange={(e) => setBulkLocationsText(e.target.value)}
                        placeholder="Left Front&#10;Full Back&#10;Left Sleeve"
                        rows={10}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowBulkAddLocationsModal(false)}
                      disabled={savingBulkLocations}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={bulkAddLocations}
                      disabled={savingBulkLocations}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingBulkLocations ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Add All Locations
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Add Type of Work Modal */}
          {showBulkAddWorkTypesModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Bulk Add Type of Work
                    </h2>
                    <button
                      onClick={() => setShowBulkAddWorkTypesModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Enter one work type per line. All work types will use the color type you select below.
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                        Example:<br />
                        Screen Print<br />
                        DTG<br />
                        DTF
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Color Type for All Work Types
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors">
                          <input
                            type="radio"
                            checked={bulkWorkTypeColorType === 'ink'}
                            onChange={() => setBulkWorkTypeColorType('ink')}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Uses Ink Colors</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors">
                          <input
                            type="radio"
                            checked={bulkWorkTypeColorType === 'thread'}
                            onChange={() => setBulkWorkTypeColorType('thread')}
                            className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Uses Thread Colors</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors">
                          <input
                            type="radio"
                            checked={bulkWorkTypeColorType === 'none'}
                            onChange={() => setBulkWorkTypeColorType('none')}
                            className="w-4 h-4 text-gray-600 border-gray-300 focus:ring-gray-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">No Colors</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Work Type Names (one per line)
                      </label>
                      <textarea
                        value={bulkWorkTypesText}
                        onChange={(e) => setBulkWorkTypesText(e.target.value)}
                        placeholder="Screen Print&#10;DTG&#10;DTF"
                        rows={10}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                    <button
                      onClick={() => setShowBulkAddWorkTypesModal(false)}
                      disabled={savingBulkWorkTypes}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={bulkAddWorkTypes}
                      disabled={savingBulkWorkTypes}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingBulkWorkTypes ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Add All Work Types
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quote/Invoice Settings Section */}
          {activeTab === 'quote-invoice-settings' && (
            <div className="space-y-4">
              {/* Quote/Invoice Numbering Settings */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Quote/Invoice Number</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Configure sequential numbering for quotes and invoices with optional prefixes</p>
                </div>

                <div className="space-y-4 border-t border-gray-200 dark:border-slate-700 pt-4">
                  {/* Enable Prefix */}
                  <div className="flex items-start gap-3">
                    <div className="flex items-center h-9">
                      <input
                        type="checkbox"
                        id="use-number-prefix"
                        checked={useNumberPrefix}
                        onChange={(e) => setUseNumberPrefix(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label htmlFor="use-number-prefix" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Use Prefix
                      </label>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        When enabled:
                        <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                          <li>Quotes will use <span className="font-mono font-semibold">QTE-</span> prefix</li>
                          <li>Invoices will use <span className="font-mono font-semibold">INV-</span> prefix</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Start Number */}
                  <div>
                    <label htmlFor="number-start-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Starting Number
                    </label>
                    <input
                      type="number"
                      id="number-start-number"
                      value={numberStartNumber}
                      onChange={(e) => setNumberStartNumber(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Starting number for sequential numbering (minimum 4 digits)
                    </p>
                  </div>

                  {/* Preview */}
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 border border-gray-200 dark:border-slate-600">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Preview:</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Quote:</span>
                        <span className="text-base font-mono font-bold text-gray-900 dark:text-white">
                          {useNumberPrefix ? 'QTE-' : ''}
                          {numberStartNumber.toString().padStart(4, '0')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-16">Invoice:</span>
                        <span className="text-base font-mono font-bold text-gray-900 dark:text-white">
                          {useNumberPrefix ? 'INV-' : ''}
                          {numberStartNumber.toString().padStart(4, '0')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={saveNumberingSettings}
                    disabled={savingNumberSettings}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingNumberSettings ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Numbering Settings
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Custom Invoice Status */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Custom Invoice Status</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Create and manage custom invoice status labels for your workflow</p>
                </div>

              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Filter className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">Custom Status Management</h3>
                      <p className="text-sm text-green-800 dark:text-green-200">
                        Define custom status labels beyond the standard Printavo statuses to better match your unique business processes and workflows.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-6 text-center">
                  <Filter className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Custom Status Labels Coming Soon</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                    The ability to create custom invoice status labels will be available in an upcoming release. This feature will enable you to define status categories that align with your specific business needs and reporting requirements.
                  </p>
                </div>
              </div>
            </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
