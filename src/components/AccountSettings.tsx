import { useState, useEffect } from 'react';
import { Building2, Upload, User, Mail, Shield, Save, Loader2, X, Plus, Trash2, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase-client';
import { useAuth } from '../contexts/AuthContext';

interface CompanySettings {
  id: string;
  company_name: string;
  logo_url: string | null;
  printavo_company_id: string | null;
  printavo_data: any;
  available_invoice_statuses: string[];
  selected_invoice_statuses: string[];
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [fetchingPrintavo, setFetchingPrintavo] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
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
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableStatuses = async () => {
    try {
      setLoadingStatuses(true);
      const { data, error } = await supabase
        .from('printavo_invoices')
        .select('status')
        .not('status', 'is', null);

      if (error) throw error;

      const uniqueStatuses = Array.from(new Set(data?.map(item => item.status) || [])).sort();
      setAvailableStatuses(uniqueStatuses);
    } catch (err) {
      console.error('Error loading statuses:', err);
    } finally {
      setLoadingStatuses(false);
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
        setEditEmail(currentProfile.email);
        setEditName(currentProfile.full_name || '');
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  const saveProfile = async () => {
    if (!user?.id || !currentUserProfile) return;

    if (!editEmail.trim()) {
      alert('Email is required');
      return;
    }

    try {
      setSavingProfile(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to update your profile');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'update',
          userId: user.id,
          email: editEmail,
          full_name: editName || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      alert('Profile updated successfully!');
      setEditingProfile(false);
      loadUsers();
    } catch (err) {
      console.error('Error updating profile:', err);
      alert(err instanceof Error ? err.message : 'Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const fetchPrintavoCompanyInfo = async () => {
    try {
      setFetchingPrintavo(true);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/printavo-company`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch company info from Printavo');
      }

      const data = await response.json();
      if (data.company) {
        setCompanyName(data.company.name || '');
        setCompanySettings(prev => prev ? {
          ...prev,
          printavo_company_id: data.company.id,
          printavo_data: data.company
        } : null);
      }
    } catch (err) {
      console.error('Error fetching Printavo company info:', err);
      alert('Failed to fetch company info from Printavo. Please check your API credentials.');
    } finally {
      setFetchingPrintavo(false);
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

  const saveSettings = async () => {
    try {
      setSaving(true);

      let logoUrl = companySettings?.logo_url;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      const settingsData = {
        company_name: companyName,
        logo_url: logoUrl,
        printavo_company_id: companySettings?.printavo_company_id,
        printavo_data: companySettings?.printavo_data,
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

      alert('Settings saved successfully!');
      setLogoFile(null);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addUser = async () => {
    if (!newUserEmail.trim()) {
      alert('Email is required');
      return;
    }

    try {
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
        const errorData = await response.json();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Information */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Company Information</h2>
              <p className="text-sm text-gray-500">Manage your company profile</p>
            </div>
          </div>
          <button
            onClick={fetchPrintavoCompanyInfo}
            disabled={fetchingPrintavo}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {fetchingPrintavo ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Fetch from Printavo'
            )}
          </button>
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
                <div className="w-32 h-32 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
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

          <div className="flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* My Profile */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <User className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
              <p className="text-sm text-gray-500">Manage your account information</p>
            </div>
          </div>
          {!editingProfile && (
            <button
              onClick={() => setEditingProfile(true)}
              className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {editingProfile ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 capitalize">
                {currentUserProfile?.role}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {savingProfile ? (
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
              <button
                onClick={() => {
                  setEditingProfile(false);
                  setEditEmail(currentUserProfile?.email || '');
                  setEditName(currentUserProfile?.full_name || '');
                }}
                disabled={savingProfile}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="text-gray-900">{currentUserProfile?.email}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="text-gray-900">{currentUserProfile?.full_name || 'Not set'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full w-fit">
                <Shield className="w-3 h-3 text-gray-600" />
                <span className="text-xs font-medium text-gray-700 capitalize">
                  {currentUserProfile?.role}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <User className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">User Management</h2>
              <p className="text-sm text-gray-500">Add and manage users</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            {showAddUser ? (
              <>
                <X className="w-4 h-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add User
              </>
            )}
          </button>
        </div>

        {showAddUser && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button
                onClick={addUser}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add User
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-200">
          {users.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No users found</p>
          ) : (
            users.map((userProfile) => (
              <div key={userProfile.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {userProfile.full_name || 'No name'}
                      {userProfile.id === user?.id && (
                        <span className="ml-2 text-xs text-blue-600">(You)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Mail className="w-3 h-3" />
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
            ))
          )}
        </div>
      </div>

      {/* Invoice Status Preferences */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Filter className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Invoice Status Preferences</h2>
            <p className="text-sm text-gray-500">Select which statuses to include in AR reports</p>
          </div>
        </div>

        {loadingStatuses ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
          </div>
        ) : (
          <>
            {availableStatuses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No invoice statuses found. Sync your Printavo data to see available statuses.
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-600">
                      Select the statuses you want to include when filtering AR reports
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedStatuses(availableStatuses)}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Select All
                      </button>
                      <span className="text-gray-400">|</span>
                      <button
                        onClick={() => setSelectedStatuses([])}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {availableStatuses.map(status => (
                    <label
                      key={status}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors border border-gray-200"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStatuses.includes(status)}
                        onChange={() => toggleStatus(status)}
                        className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-900 break-words flex-1">{status}</span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    {selectedStatuses.length} of {availableStatuses.length} statuses selected
                  </p>
                  <button
                    onClick={saveStatusPreferences}
                    disabled={savingStatuses}
                    className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
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
          </>
        )}
      </div>
    </div>
  );
}
