import { useState, useEffect, lazy, Suspense } from 'react';
import { Building2, User, Shield, Save, Loader2, Plus, Trash2, Filter, Upload, Edit, Key, Clock, Layers, Zap, CreditCard, ChevronDown, ChevronUp, Settings as SettingsIcon, Link as LinkIcon, RefreshCw, Bug } from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import { useAuth } from '../contexts/AuthContext';
import AutomatedReports from './automation/AutomatedReports';

const WorkflowCustomization = lazy(() => import('./production/WorkflowCustomization').then(m => ({ default: m.WorkflowCustomization })));
const AutomationsDashboard = lazy(() => import('./automations/AutomationsDashboard').then(m => ({ default: m.AutomationsDashboard })));
const StripePayments = lazy(() => import('./production/StripePayments').then(m => ({ default: m.StripePayments })));

interface CompanySettings {
  id: string;
  company_name: string;
  logo_url: string | null;
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

type SettingsTab =
  | 'company-info'
  | 'printavo-integration' | 'square-integration' | 'resend-integration' | 'stripe-payments'
  | 'user-management'
  | 'status-filters' | 'billing-status-filters'
  | 'automated-reports' | 'workflow-setup' | 'automations';

interface AccountSettingsProps {
  initialTab?: SettingsTab;
}

export function AccountSettings({ initialTab }: AccountSettingsProps = {}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'company-info');
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  const [integrationsExpanded, setIntegrationsExpanded] = useState(false);
  const [automationExpanded, setAutomationExpanded] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);

  const [printavoUsername, setPrintavoUsername] = useState('');
  const [printavoToken, setPrintavoToken] = useState('');
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testData, setTestData] = useState<any>(null);

  const [squareAccessToken, setSquareAccessToken] = useState('');
  const [squareApplicationId, setSquareApplicationId] = useState('');
  const [squareLocationId, setSquareLocationId] = useState('');
  const [squareEnvironment, setSquareEnvironment] = useState('production');
  const [savingSquare, setSavingSquare] = useState(false);
  const [testingSquare, setTestingSquare] = useState(false);
  const [squareTestResult, setSquareTestResult] = useState<any>(null);

  const [resendApiKey, setResendApiKey] = useState('');
  const [emailFromAddress, setEmailFromAddress] = useState('');
  const [savingResend, setSavingResend] = useState(false);
  const [testingResend, setTestingResend] = useState(false);
  const [resendTestResult, setResendTestResult] = useState<any>(null);

  const [stripePublicKey, setStripePublicKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [savingStripe, setSavingStripe] = useState(false);
  const [testingStripe, setTestingStripe] = useState(false);
  const [stripeTestResult, setStripeTestResult] = useState<any>(null);

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [addingUser, setAddingUser] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserEmail, setEditingUserEmail] = useState('');
  const [editingUserName, setEditingUserName] = useState('');
  const [editingUserRole, setEditingUserRole] = useState('user');
  const [editingUserPassword, setEditingUserPassword] = useState('');
  const [editingUserPasswordConfirm, setEditingUserPasswordConfirm] = useState('');
  const [updatingUser, setUpdatingUser] = useState(false);

  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [savingStatuses, setSavingStatuses] = useState(false);
  const [syncingStatuses, setSyncingStatuses] = useState(false);

  const [billingSelectedStatuses, setBillingSelectedStatuses] = useState<string[]>([]);
  const [savingBillingStatuses, setSavingBillingStatuses] = useState(false);

  const [fullStatuses, setFullStatuses] = useState<PrintavoStatus[]>([]);
  const [pendingBillingChanges, setPendingBillingChanges] = useState<Map<string, boolean>>(new Map());
  const [savingBillingFilters, setSavingBillingFilters] = useState(false);
  const [billingFiltersSaveMessage, setBillingFiltersSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
    loadUsers();
    loadAvailableStatuses();
    loadStatusesFromDatabase();
  }, []);

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
        setLogoPreview(data.logo_url);
        setAvailableStatuses(data.available_invoice_statuses || []);
        setSelectedStatuses(data.selected_invoice_statuses || []);
        setBillingSelectedStatuses(data.billing_selected_invoice_statuses || []);
        setPrintavoUsername(data.printavo_username || '');
        setSquareEnvironment(data.square_environment || 'production');
        setEmailFromAddress(data.email_from_address || '');
        setStripePublicKey(data.stripe_public_key || '');
        setStripeSecretKey(data.stripe_secret_key || '');
        setStripeWebhookSecret(data.stripe_webhook_secret || '');
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
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const loadAvailableStatuses = async (): Promise<string[]> => {
    try {
      setLoadingStatuses(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
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
    try {
      setSavingCompany(true);

      let logoUrl = companySettings?.logo_url;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      const settingsData = {
        company_name: companyName,
        logo_url: logoUrl,
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
          .insert([settingsData])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      alert('Company settings saved successfully!');
      setLogoFile(null);
    } catch (err) {
      console.error('Error saving company settings:', err);
      alert('Failed to save company settings. Please try again.');
    } finally {
      setSavingCompany(false);
    }
  };

  const testPrintavoConnection = async () => {
    try {
      setTestingConnection(true);
      setTestResult(null);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-printavo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-printavo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        }
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
      alert('Printavo username/email is required');
      return;
    }

    if (!printavoToken.trim()) {
      alert('Printavo API token is required');
      return;
    }

    try {
      setSavingIntegration(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to update integration settings');
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
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      alert('Printavo integration settings saved successfully!');
      setPrintavoToken('');
      setTestResult(null);
      await loadSettings();
      await loadAvailableStatuses();
    } catch (err) {
      console.error('Error saving integration settings:', err);
      alert(err instanceof Error ? err.message : 'Failed to save integration settings. Please try again.');
    } finally {
      setSavingIntegration(false);
    }
  };

  const saveSquareIntegration = async () => {
    if (!squareAccessToken.trim() && !companySettings?.id) {
      alert('Square Access Token is required');
      return;
    }

    try {
      setSavingSquare(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to update Square settings');
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
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      alert('Square integration settings saved successfully!');
      setSquareAccessToken('');
      setSquareTestResult(null);
      await loadSettings();
    } catch (err) {
      console.error('Error saving Square settings:', err);
      alert(err instanceof Error ? err.message : 'Failed to save Square settings. Please try again.');
    } finally {
      setSavingSquare(false);
    }
  };

  const saveResendIntegration = async () => {
    if (!resendApiKey.trim() && !companySettings?.id) {
      alert('Resend API Key is required');
      return;
    }

    try {
      setSavingResend(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to update Resend settings');
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
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      alert('Resend integration settings saved successfully!');
      setResendApiKey('');
      setResendTestResult(null);
      await loadSettings();
    } catch (err) {
      console.error('Error saving Resend settings:', err);
      alert(err instanceof Error ? err.message : 'Failed to save Resend settings. Please try again.');
    } finally {
      setSavingResend(false);
    }
  };

  const saveStripeIntegration = async () => {
    if (!stripePublicKey.trim() && !stripeSecretKey.trim() && !companySettings?.id) {
      alert('At least one Stripe credential is required');
      return;
    }

    try {
      setSavingStripe(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to update Stripe settings');
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
        alert('No Stripe credentials to save');
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
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      alert('Stripe integration settings saved successfully!');
      setStripePublicKey('');
      setStripeSecretKey('');
      setStripeWebhookSecret('');
      setStripeTestResult(null);
      await loadSettings();
    } catch (err) {
      console.error('Error saving Stripe settings:', err);
      alert(err instanceof Error ? err.message : 'Failed to save Stripe settings. Please try again.');
    } finally {
      setSavingStripe(false);
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

      if (!response.ok) {
        setStripeTestResult({
          success: false,
          error: result.error || 'Failed to test Stripe connection',
        });
        return;
      }

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
      alert('Email is required');
      return;
    }

    try {
      setAddingUser(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to add users');
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

      alert('User added successfully! They will receive an email to set their password.');
      setShowAddUser(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('user');
      loadUsers();
    } catch (err) {
      console.error('Error adding user:', err);
      alert(err instanceof Error ? err.message : 'Failed to add user. Please try again.');
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
      alert('Email is required');
      return;
    }

    if (editingUserPassword || editingUserPasswordConfirm) {
      if (editingUserPassword !== editingUserPasswordConfirm) {
        alert('Passwords do not match');
        return;
      }
      if (editingUserPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
      }
    }

    try {
      setUpdatingUser(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to update users');
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

      alert('User updated successfully!');
      cancelEditUser();
      loadUsers();
    } catch (err) {
      console.error('Error updating user:', err);
      alert(err instanceof Error ? err.message : 'Failed to update user. Please try again.');
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

      alert('User removed successfully!');
      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to remove user. Please try again.');
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
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      alert('Status preferences saved successfully!');
    } catch (err) {
      console.error('Error saving status preferences:', err);
      alert('Failed to save status preferences. Please try again.');
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
            ...settingsData
          }])
          .select()
          .single();

        if (error) throw error;
        setCompanySettings(data);
      }

      alert('Billing status preferences saved successfully!');
    } catch (err) {
      console.error('Error saving billing status preferences:', err);
      alert('Failed to save billing status preferences. Please try again.');
    } finally {
      setSavingBillingStatuses(false);
    }
  };

  const syncStatuses = async () => {
    try {
      setSyncingStatuses(true);
      await loadAvailableStatuses();
      await loadStatusesFromDatabase();
      alert(`Successfully synced statuses from Printavo!`);
    } catch (err) {
      console.error('Error syncing statuses:', err);
      alert('Failed to sync statuses. Please try again.');
    } finally {
      setSyncingStatuses(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const isAdmin = currentUserProfile?.role === 'admin';

  return (
    <div className="flex h-full">
      {/* Left Sidebar Navigation */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
        <div className="p-4">
          <h1 className="text-lg font-bold text-gray-900 mb-1">Account Settings</h1>
          <p className="text-xs text-gray-600">Manage your account</p>
        </div>

        <nav className="px-2 pb-4">
          {/* Company Settings Section */}
          <div className="mb-2">
            <button
              onClick={() => setActiveTab('company-info')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                activeTab === 'company-info'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Building2 className={`w-4 h-4 flex-shrink-0 ${activeTab === 'company-info' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              <div className="flex-1 text-left">
                <div className={`font-medium text-sm ${activeTab === 'company-info' ? 'text-blue-700' : 'text-gray-700'}`}>
                  Company Settings
                </div>
              </div>
              {activeTab === 'company-info' && <div className="w-1 h-6 bg-blue-600 rounded-full absolute right-0" />}
            </button>
          </div>

          {/* Integrations Section - Collapsible */}
          <div className="mb-2">
            <button
              onClick={() => setIntegrationsExpanded(!integrationsExpanded)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-gray-900 hover:bg-gray-50"
            >
              <LinkIcon className="w-4 h-4 flex-shrink-0 text-gray-600 group-hover:text-gray-900" />
              <div className="flex-1 text-left">
                <div className="font-medium text-sm text-gray-900">
                  Integrations
                </div>
              </div>
              {integrationsExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500 transition-transform duration-200" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-500 transition-transform duration-200 rotate-180" />
              )}
            </button>

            {integrationsExpanded && (
              <div className="mt-1 ml-2 space-y-1 collapsible-section collapsible-section-enter">
                <button
                  onClick={() => setActiveTab('printavo-integration')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'printavo-integration'
                      ? 'bg-green-50 text-green-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Key className={`w-4 h-4 flex-shrink-0 ${activeTab === 'printavo-integration' ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'printavo-integration' ? 'text-green-700' : 'text-gray-700'}`}>
                      Printavo
                    </div>
                  </div>
                  {activeTab === 'printavo-integration' && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                </button>

                <button
                  onClick={() => setActiveTab('square-integration')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'square-integration'
                      ? 'bg-green-50 text-green-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  style={{ animationDelay: '20ms' }}
                >
                  <CreditCard className={`w-4 h-4 flex-shrink-0 ${activeTab === 'square-integration' ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'square-integration' ? 'text-green-700' : 'text-gray-700'}`}>
                      Square
                    </div>
                  </div>
                  {activeTab === 'square-integration' && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                </button>

                <button
                  onClick={() => setActiveTab('resend-integration')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'resend-integration'
                      ? 'bg-green-50 text-green-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  style={{ animationDelay: '40ms' }}
                >
                  <SettingsIcon className={`w-4 h-4 flex-shrink-0 ${activeTab === 'resend-integration' ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'resend-integration' ? 'text-green-700' : 'text-gray-700'}`}>
                      Resend Email
                    </div>
                  </div>
                  {activeTab === 'resend-integration' && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                </button>

                <button
                  onClick={() => setActiveTab('stripe-payments')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'stripe-payments'
                      ? 'bg-green-50 text-green-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  style={{ animationDelay: '60ms' }}
                >
                  <CreditCard className={`w-4 h-4 flex-shrink-0 ${activeTab === 'stripe-payments' ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'stripe-payments' ? 'text-green-700' : 'text-gray-700'}`}>
                      Stripe
                    </div>
                  </div>
                  {activeTab === 'stripe-payments' && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                </button>
              </div>
            )}
          </div>

          {/* User Management (Admin only) */}
          {isAdmin && (
            <div className="mb-2">
              <button
                onClick={() => setActiveTab('user-management')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  activeTab === 'user-management'
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Shield className={`w-4 h-4 flex-shrink-0 ${activeTab === 'user-management' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <div className="flex-1 text-left">
                  <div className={`font-medium text-sm ${activeTab === 'user-management' ? 'text-blue-700' : 'text-gray-700'}`}>
                    User Management
                  </div>
                </div>
                {activeTab === 'user-management' && <div className="w-1 h-6 bg-blue-600 rounded-full absolute right-0" />}
              </button>
            </div>
          )}

          {/* Status Filters */}
          <div className="mb-2">
            <button
              onClick={() => setActiveTab('status-filters')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                activeTab === 'status-filters'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Filter className={`w-4 h-4 flex-shrink-0 ${activeTab === 'status-filters' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              <div className="flex-1 text-left">
                <div className={`font-medium text-sm ${activeTab === 'status-filters' ? 'text-blue-700' : 'text-gray-700'}`}>
                  Dashboard Filters
                </div>
              </div>
              {activeTab === 'status-filters' && <div className="w-1 h-6 bg-blue-600 rounded-full absolute right-0" />}
            </button>
          </div>

          {/* Billing Status Filters */}
          <div className="mb-2">
            <button
              onClick={() => setActiveTab('billing-status-filters')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                activeTab === 'billing-status-filters'
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Filter className={`w-4 h-4 flex-shrink-0 ${activeTab === 'billing-status-filters' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              <div className="flex-1 text-left">
                <div className={`font-medium text-sm ${activeTab === 'billing-status-filters' ? 'text-blue-700' : 'text-gray-700'}`}>
                  Billing Filters
                </div>
              </div>
              {activeTab === 'billing-status-filters' && <div className="w-1 h-6 bg-blue-600 rounded-full absolute right-0" />}
            </button>
          </div>

          {/* Automation Section - Collapsible */}
          <div className="mb-2">
            <button
              onClick={() => setAutomationExpanded(!automationExpanded)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-gray-900 hover:bg-gray-50"
            >
              <Zap className="w-4 h-4 flex-shrink-0 text-gray-600 group-hover:text-gray-900" />
              <div className="flex-1 text-left">
                <div className="font-medium text-sm text-gray-900">
                  Automation
                </div>
              </div>
              {automationExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500 transition-transform duration-200" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-500 transition-transform duration-200 rotate-180" />
              )}
            </button>

            {automationExpanded && (
              <div className="mt-1 ml-2 space-y-1 collapsible-section collapsible-section-enter">
                <button
                  onClick={() => setActiveTab('automated-reports')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'automated-reports'
                      ? 'bg-green-50 text-green-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Clock className={`w-4 h-4 flex-shrink-0 ${activeTab === 'automated-reports' ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'automated-reports' ? 'text-green-700' : 'text-gray-700'}`}>
                      Automated Reports
                    </div>
                  </div>
                  {activeTab === 'automated-reports' && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                </button>

                <button
                  onClick={() => setActiveTab('workflow-setup')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'workflow-setup'
                      ? 'bg-green-50 text-green-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  style={{ animationDelay: '20ms' }}
                >
                  <Layers className={`w-4 h-4 flex-shrink-0 ${activeTab === 'workflow-setup' ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'workflow-setup' ? 'text-green-700' : 'text-gray-700'}`}>
                      Workflow Setup
                    </div>
                  </div>
                  {activeTab === 'workflow-setup' && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                </button>

                <button
                  onClick={() => setActiveTab('automations')}
                  className={`collapsible-item w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
                    activeTab === 'automations'
                      ? 'bg-green-50 text-green-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  style={{ animationDelay: '40ms' }}
                >
                  <Zap className={`w-4 h-4 flex-shrink-0 ${activeTab === 'automations' ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-medium text-sm ${activeTab === 'automations' ? 'text-green-700' : 'text-gray-700'}`}>
                      Automations
                    </div>
                  </div>
                  {activeTab === 'automations' && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-8 max-w-4xl mx-auto">
          {activeTab === 'company-info' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
                <p className="text-sm text-gray-600 mb-6">Manage your company details</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter company name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Logo
                  </label>
                  <div className="flex items-start gap-4">
                    {logoPreview && (
                      <div className="w-32 h-32 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center flex-shrink-0">
                        <img
                          src={logoPreview}
                          alt="Company logo"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer">
                        <Upload className="w-5 h-5 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          {logoFile ? logoFile.name : 'Upload Logo'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-gray-500 mt-2">
                        Recommended: Square image, at least 200x200px
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={saveCompanySettings}
                    disabled={savingCompany}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
              </div>
            </div>
          )}

          {activeTab === 'printavo-integration' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Printavo Integration</h2>
                <p className="text-sm text-gray-600 mb-6">Connect your Printavo account to sync data</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Printavo Email / Username
                  </label>
                  <input
                    type="email"
                    value={printavoUsername}
                    onChange={(e) => setPrintavoUsername(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your Printavo account email</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Printavo API Token
                  </label>
                  <input
                    type="password"
                    value={printavoToken}
                    onChange={(e) => setPrintavoToken(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={companySettings?.printavo_api_token_encrypted ? '••••••••••••••••' : 'Enter your API token'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
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
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-800">
                          <Key className="w-5 h-5" />
                          <div>
                            <p className="font-medium">Integration Active</p>
                            <p className="text-sm mt-1">Connected as: {companySettings.printavo_username}</p>
                          </div>
                        </div>
                        <button
                          onClick={testPrintavoConnection}
                          disabled={testingConnection}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50 transition-colors"
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

                    {testResult && (
                      <div className={`p-4 rounded-lg border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="space-y-3">
                          <div className={`font-medium text-lg ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                            {testResult.success ? '✓ Connection Successful!' : '✗ Connection Failed'}
                          </div>

                          {testResult.success && testResult.company && (
                            <div className="text-sm text-green-700">
                              Connected to: <strong>{testResult.company.name}</strong>
                            </div>
                          )}

                          {testResult.error && (
                            <div className="text-sm text-red-700 font-medium">
                              Error: {testResult.error}
                            </div>
                          )}

                          {testResult.printavoError && (
                            <div className="text-sm text-red-700 font-medium">
                              Printavo Error: {testResult.printavoError}
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-xs font-medium text-gray-700 mb-2">Diagnostics:</div>
                            <pre className="text-xs p-3 bg-white rounded border border-gray-300 overflow-x-auto max-h-96">
                              {JSON.stringify(testResult, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bug className="w-5 h-5 text-yellow-600" />
                          <span className="text-sm text-yellow-800 font-medium">Debug: Test Printavo Data Structure</span>
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
                      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">Printavo API Response</h3>
                          <button
                            onClick={() => setTestData(null)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            Close
                          </button>
                        </div>
                        <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-96 text-xs">
                          {JSON.stringify(testData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'square-integration' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Square Integration</h2>
                <p className="text-sm text-gray-600 mb-6">Connect your Square account to access payment data</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Square Access Token <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={squareAccessToken}
                    onChange={(e) => setSquareAccessToken(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder={companySettings?.square_access_token ? '••••••••••••••••' : 'Enter your Square access token'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {companySettings?.square_access_token
                      ? 'Token is saved and encrypted. Enter a new token to update it.'
                      : 'Find your access token in Square Developer Dashboard'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Application ID
                  </label>
                  <input
                    type="text"
                    value={squareApplicationId}
                    onChange={(e) => setSquareApplicationId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="sq0idp-XXXXXXXXXXXXXXXXXXXX"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your Square Application ID</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location ID
                  </label>
                  <input
                    type="text"
                    value={squareLocationId}
                    onChange={(e) => setSquareLocationId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="L1234567890"
                  />
                  <p className="text-xs text-gray-500 mt-1">Your Square Location ID (leave blank for all locations)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Environment
                  </label>
                  <select
                    value={squareEnvironment}
                    onChange={(e) => setSquareEnvironment(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-green-800">
                          <Key className="w-5 h-5" />
                          <div>
                            <p className="font-medium">Square Integration Active</p>
                            <p className="text-sm mt-1">Environment: {companySettings.square_environment || 'production'}</p>
                          </div>
                        </div>
                        <button
                          onClick={testSquareConnection}
                          disabled={testingSquare}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50 transition-colors"
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
                      <div className={`p-4 rounded-lg border ${squareTestResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="space-y-3">
                          {squareTestResult.success ? (
                            <>
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                  ✓
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-green-900">Connection Successful!</h4>
                                  <p className="text-sm text-green-800 mt-1">{squareTestResult.message}</p>
                                  {squareTestResult.locations && squareTestResult.locations.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-medium text-green-900 mb-2">Locations:</p>
                                      <ul className="text-xs text-green-800 space-y-1">
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
                                  <h4 className="font-medium text-red-900">Connection Failed</h4>
                                  <p className="text-sm text-red-800 mt-1">{squareTestResult.error}</p>
                                </div>
                              </div>
                            </>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-xs font-medium text-gray-700 mb-2">Diagnostics:</div>
                            <pre className="text-xs p-3 bg-white rounded border border-gray-300 overflow-x-auto max-h-96">
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

          {activeTab === 'resend-integration' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Resend Email Integration</h2>
                <p className="text-sm text-gray-600 mb-6">Connect Resend to send transactional emails</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resend API Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={resendApiKey}
                    onChange={(e) => setResendApiKey(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder={companySettings?.resend_api_key ? '••••••••••••••••' : 'Enter your Resend API key'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {companySettings?.resend_api_key
                      ? 'API key is saved and encrypted. Enter a new key to update it.'
                      : 'Get your API key from Resend Dashboard → API Keys'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={emailFromAddress}
                    onChange={(e) => setEmailFromAddress(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="invoices@yourdomain.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Must use an email address from your verified domain (e.g., invoices@toddssportinggoods.com)
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Note:</strong> You'll also need to verify your sending domain in the Resend dashboard before you can send emails.
                  </p>
                  <a
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 underline mt-2 inline-block"
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
                    <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-800">
                          <Key className="w-5 h-5" />
                          <div>
                            <p className="font-medium">Resend Integration Active</p>
                            <p className="text-sm mt-1">Email sending is configured and ready to use</p>
                          </div>
                        </div>
                        <button
                          onClick={testResendConnection}
                          disabled={testingResend}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 disabled:opacity-50 transition-colors"
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
                      <div className={`p-4 rounded-lg border ${resendTestResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="space-y-3">
                          {resendTestResult.success ? (
                            <>
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                  ✓
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-green-900">Connection Successful!</h4>
                                  <p className="text-sm text-green-800 mt-1">{resendTestResult.message}</p>
                                  {resendTestResult.emailId && (
                                    <p className="text-xs text-green-700 mt-2">Email ID: {resendTestResult.emailId}</p>
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
                                  <h4 className="font-medium text-red-900">Connection Failed</h4>
                                  <p className="text-sm text-red-800 mt-1">{resendTestResult.error}</p>
                                </div>
                              </div>
                            </>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-xs font-medium text-gray-700 mb-2">Diagnostics:</div>
                            <pre className="text-xs p-3 bg-white rounded border border-gray-300 overflow-x-auto max-h-96">
                              {JSON.stringify(resendTestResult, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 mb-2">Available Email Templates:</p>
                  <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
                    <li>Invoice Reminders</li>
                    <li>Payment Confirmations</li>
                    <li>Overdue Notices</li>
                    <li>Welcome Emails</li>
                    <li>Custom HTML Emails</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-3">
                    See <code className="bg-white px-2 py-0.5 rounded">EMAIL_GUIDE.md</code> for usage examples
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'user-management' && isAdmin && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">User Management</h2>
                  <p className="text-sm text-gray-600">Add and manage team members</p>
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
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-4">Add New User</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="user@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role
                      </label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                        <option value="viewer">Viewer</option>
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
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg">
                {users.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No users found</p>
                ) : (
                  users.map((userProfile) => (
                    <div key={userProfile.id}>
                      {editingUserId === userProfile.id ? (
                        <div className="p-4 bg-blue-50">
                          <div className="flex items-center gap-2 mb-4">
                            <User className="w-5 h-5 text-blue-600" />
                            <h4 className="font-medium text-gray-900">Edit User</h4>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email Address *
                              </label>
                              <input
                                type="email"
                                value={editingUserEmail}
                                onChange={(e) => setEditingUserEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="user@example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Full Name
                              </label>
                              <input
                                type="text"
                                value={editingUserName}
                                onChange={(e) => setEditingUserName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="John Doe"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Role
                              </label>
                              <select
                                value={editingUserRole}
                                onChange={(e) => setEditingUserRole(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              >
                                <option value="admin">Admin</option>
                                <option value="user">User</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            </div>
                            <div className="border-t border-gray-200 pt-3">
                              <p className="text-sm font-medium text-gray-700 mb-2">Change Password (Optional)</p>
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    New Password
                                  </label>
                                  <input
                                    type="password"
                                    value={editingUserPassword}
                                    onChange={(e) => setEditingUserPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Leave blank to keep current password"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Confirm New Password
                                  </label>
                                  <input
                                    type="password"
                                    value={editingUserPasswordConfirm}
                                    onChange={(e) => setEditingUserPasswordConfirm(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-full">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {userProfile.full_name || 'No name'}
                                {userProfile.id === user?.id && (
                                  <span className="ml-2 text-xs text-blue-600">(You)</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500">
                                {userProfile.email}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full">
                              <Shield className="w-3 h-3 text-gray-600" />
                              <span className="text-xs font-medium text-gray-700 capitalize">
                                {userProfile.role}
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

          {activeTab === 'status-filters' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Printavo Dashboard Status Filters</h2>
                <p className="text-sm text-gray-600">Select statuses to display in Printavo Dashboard section</p>
              </div>

              {loadingStatuses ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : availableStatuses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No invoice statuses found. Configure your Printavo integration and test the connection to load available statuses.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">
                      {selectedStatuses.length} of {availableStatuses.length} statuses selected
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedStatuses(availableStatuses)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-gray-400">|</span>
                      <button
                        onClick={() => setSelectedStatuses([])}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                    {availableStatuses.map(status => (
                      <label
                        key={status}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-200"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes(status)}
                          onChange={() => toggleStatus(status)}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 break-words flex-1">{status}</span>
                      </label>
                    ))}
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={saveStatusPreferences}
                      disabled={savingStatuses}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {savingStatuses ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Preferences
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'billing-status-filters' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Billing & Payments Status Filters</h2>
                  <p className="text-sm text-gray-600">Select which statuses should appear in Billing Queue, then click Save to apply.</p>
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
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
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
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : fullStatuses.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No statuses found. Click "Sync from Printavo" to fetch all available statuses.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">
                      {fullStatuses.filter(s => s.is_billing_eligible).length} of {fullStatuses.length} statuses enabled for billing
                      {pendingBillingChanges.size > 0 && (
                        <span className="ml-2 text-amber-600 font-medium">
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
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
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
                                  ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-300"
                                style={{ backgroundColor: status.color || '#9ca3af' }}
                              />
                              <span className={`text-sm flex-1 text-left ${status.is_billing_eligible ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                                {status.name}
                              </span>
                              <div className={`w-5 h-5 rounded flex items-center justify-center ${
                                status.is_billing_eligible ? 'bg-blue-600' : 'bg-gray-200'
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
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
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
                                ? 'bg-blue-50 border-blue-300 hover:bg-blue-100'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div
                              className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-300"
                              style={{ backgroundColor: status.color || '#9ca3af' }}
                            />
                            <span className={`text-sm flex-1 text-left ${status.is_billing_eligible ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                              {status.name}
                            </span>
                            <div className={`w-5 h-5 rounded flex items-center justify-center ${
                              status.is_billing_eligible ? 'bg-blue-600' : 'bg-gray-200'
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

                  <div className="pt-6 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={saveBillingFilters}
                        disabled={savingBillingFilters || pendingBillingChanges.size === 0}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                          pendingBillingChanges.size > 0
                            ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
                          className="px-4 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Discard Changes
                        </button>
                      )}
                    </div>
                    {pendingBillingChanges.size > 0 && (
                      <p className="text-sm text-amber-600">
                        You have unsaved changes
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}


          {activeTab === 'automated-reports' && (
            <div className="bg-white rounded-lg shadow p-6">
              <AutomatedReports />
            </div>
          )}

          {activeTab === 'workflow-setup' && (
            <div className="bg-white rounded-lg shadow p-6">
              <Suspense fallback={
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              }>
                <WorkflowCustomization />
              </Suspense>
            </div>
          )}

          {activeTab === 'automations' && (
            <div className="bg-white rounded-lg shadow p-6">
              <Suspense fallback={
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                </div>
              }>
                <AutomationsDashboard />
              </Suspense>
            </div>
          )}

          {activeTab === 'stripe-payments' && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Stripe Payment Integration</h2>
                <p className="text-sm text-gray-600 mb-6">Configure Stripe to accept online payments from customers</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stripe Publishable Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={stripePublicKey}
                    onChange={(e) => setStripePublicKey(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={companySettings?.stripe_public_key ? '••••••••••••••••' : 'pk_live_...'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {companySettings?.stripe_public_key
                      ? 'Publishable key is saved and encrypted. Enter a new key to update it.'
                      : 'Your publishable key from Stripe Dashboard → Developers → API keys'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stripe Secret Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={stripeSecretKey}
                    onChange={(e) => setStripeSecretKey(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={companySettings?.stripe_secret_key ? '••••••••••••••••' : 'sk_live_...'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {companySettings?.stripe_secret_key
                      ? 'Secret key is saved and encrypted. Enter a new key to update it.'
                      : 'Your secret key from Stripe Dashboard → Developers → API keys (keep this confidential)'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stripe Webhook Secret
                  </label>
                  <input
                    type="password"
                    value={stripeWebhookSecret}
                    onChange={(e) => setStripeWebhookSecret(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={companySettings?.stripe_webhook_secret ? '••••••••••••••••' : 'whsec_...'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {companySettings?.stripe_webhook_secret
                      ? 'Webhook secret is saved and encrypted. Enter a new secret to update it.'
                      : 'Your webhook signing secret from Stripe Dashboard → Developers → Webhooks'}
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-2">Setup Instructions:</p>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside ml-2">
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
                    className="text-sm text-blue-600 hover:text-blue-700 underline inline-block"
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
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-800">
                          <CreditCard className="w-5 h-5" />
                          <div>
                            <p className="font-medium">Stripe Integration Active</p>
                            <p className="text-sm mt-1">Payment processing is configured and ready to use</p>
                          </div>
                        </div>
                        <button
                          onClick={testStripeConnection}
                          disabled={testingStripe}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
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
                      <div className={`p-4 rounded-lg border ${stripeTestResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="space-y-3">
                          {stripeTestResult.success ? (
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold">
                                ✓
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-green-900">Connection Successful!</h4>
                                <p className="text-sm text-green-800 mt-1">{stripeTestResult.message}</p>
                                {stripeTestResult.balance && (
                                  <div className="mt-3 p-3 bg-white rounded border border-green-200">
                                    <p className="text-xs font-medium text-gray-600 mb-2">Account Balance:</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-xs text-gray-500">Available</p>
                                        <p className="text-lg font-semibold text-green-700">
                                          ${stripeTestResult.balance.available.toFixed(2)} {stripeTestResult.balance.currency.toUpperCase()}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-gray-500">Pending</p>
                                        <p className="text-lg font-semibold text-gray-700">
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
                                <h4 className="font-medium text-red-900">Connection Failed</h4>
                                <p className="text-sm text-red-800 mt-1">{stripeTestResult.error}</p>
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
        </div>
      </div>
    </div>
  );
}
