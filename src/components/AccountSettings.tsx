import { useState, useEffect } from 'react';
import { Building2, User, Shield, Save, Loader2, Plus, Trash2, Filter, Upload, Edit, Key, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import { useAuth } from '../contexts/AuthContext';
import AutomatedReports from './automation/AutomatedReports';

interface CompanySettings {
  id: string;
  company_name: string;
  logo_url: string | null;
  available_invoice_statuses: string[];
  selected_invoice_statuses: string[];
  printavo_username: string | null;
  printavo_api_token_encrypted: string | null;
  resend_api_key: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

export function AccountSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'company' | 'integration' | 'users' | 'statuses' | 'automation'>('company');
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);

  const [printavoUsername, setPrintavoUsername] = useState('');
  const [printavoToken, setPrintavoToken] = useState('');
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const [squareAccessToken, setSquareAccessToken] = useState('');
  const [squareApplicationId, setSquareApplicationId] = useState('');
  const [squareLocationId, setSquareLocationId] = useState('');
  const [squareEnvironment, setSquareEnvironment] = useState('production');
  const [savingSquare, setSavingSquare] = useState(false);
  const [testingSquare, setTestingSquare] = useState(false);
  const [squareTestResult, setSquareTestResult] = useState<any>(null);

  const [resendApiKey, setResendApiKey] = useState('');
  const [savingResend, setSavingResend] = useState(false);
  const [testingResend, setTestingResend] = useState(false);
  const [resendTestResult, setResendTestResult] = useState<any>(null);

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

  useEffect(() => {
    loadSettings();
    loadUsers();
    loadAvailableStatuses();
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
        setSelectedStatuses(data.selected_invoice_statuses || []);
        setPrintavoUsername(data.printavo_username || '');
        setSquareEnvironment(data.square_environment || 'production');
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

  const loadAvailableStatuses = async () => {
    try {
      setLoadingStatuses(true);
      const { data, error } = await supabase
        .from('printavo_invoices_calculated')
        .select('status')
        .not('status', 'is', null);

      if (error) throw error;

      const uniqueStatuses = Array.from(
        new Set(data?.map(item => item.status).filter(status => status && status.trim() !== '') || [])
      ).sort();

      setAvailableStatuses(uniqueStatuses);
    } catch (err) {
      console.error('Error loading statuses:', err);
    } finally {
      setLoadingStatuses(false);
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const isAdmin = currentUserProfile?.role === 'admin';

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-600">Manage your company, integrations, and preferences</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('company')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'company'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Company Settings
              </div>
            </button>
            <button
              onClick={() => setActiveTab('integration')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'integration'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Integration
              </div>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Users
                </div>
              </button>
            )}
            <button
              onClick={() => setActiveTab('statuses')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'statuses'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Status Filters
              </div>
            </button>
            <button
              onClick={() => setActiveTab('automation')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'automation'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Automated Reports
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
                <p className="text-sm text-gray-600 mb-6">Manage your company details</p>
              </div>

              <div className="space-y-4 max-w-xl">
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

          {activeTab === 'integration' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Printavo Integration</h2>
                <p className="text-sm text-gray-600 mb-6">Connect your Printavo account to sync data</p>
              </div>

              <div className="space-y-4 max-w-xl">
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
                  </>
                )}
              </div>

              {/* Square Integration Section */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Square Integration</h2>
                  <p className="text-sm text-gray-600 mb-6">Connect your Square account to access payment data</p>
                </div>

                <div className="space-y-4 max-w-xl">
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

              {/* Resend Email Integration Section */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Resend Email Integration</h2>
                  <p className="text-sm text-gray-600 mb-6">Connect Resend to send transactional emails</p>
                </div>

                <div className="space-y-4 max-w-xl">
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
            </div>
          )}

          {activeTab === 'users' && isAdmin && (
            <div className="space-y-6">
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

          {activeTab === 'statuses' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Invoice Status Filters</h2>
                <p className="text-sm text-gray-600">Select statuses to enable filtering in reports</p>
              </div>

              {loadingStatuses ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : availableStatuses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No invoice statuses found. Sync your Printavo data to see available statuses.
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

          {activeTab === 'automation' && (
            <AutomatedReports />
          )}
        </div>
      </div>
    </div>
  );
}
