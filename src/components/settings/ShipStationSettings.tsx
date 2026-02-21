import { useState, useEffect } from 'react';
import { Package, Save, Loader2, AlertCircle, CheckCircle, Eye, EyeOff, TestTube, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';
import { useNotification } from '../../contexts/NotificationContext';
import { encryptToken, decryptToken } from '../../services/crypto-service';

interface ShipStationSettingsData {
  api_key: string;
  api_secret: string;
  default_ship_from_name: string;
  default_ship_from_company: string;
  default_ship_from_address1: string;
  default_ship_from_address2: string;
  default_ship_from_city: string;
  default_ship_from_state: string;
  default_ship_from_postal_code: string;
  default_ship_from_country: string;
  default_carrier_code: string;
  default_service_code: string;
}

interface CompanySettings {
  id: string;
  shipstation_api_key: string | null;
  shipstation_api_secret: string | null;
  shipstation_default_ship_from_name: string | null;
  shipstation_default_ship_from_company: string | null;
  shipstation_default_ship_from_address1: string | null;
  shipstation_default_ship_from_address2: string | null;
  shipstation_default_ship_from_city: string | null;
  shipstation_default_ship_from_state: string | null;
  shipstation_default_ship_from_postal_code: string | null;
  shipstation_default_ship_from_country: string | null;
  shipstation_default_carrier_code: string | null;
  shipstation_default_service_code: string | null;
}

interface CarrierService {
  code: string;
  name: string;
  domestic: boolean;
  international: boolean;
}

interface ConnectedCarrier {
  name: string;
  code: string;
  accountNumber?: string;
  nickname?: string;
  services: CarrierService[];
}

export function ShipStationSettings() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loadingCarriers, setLoadingCarriers] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [companySettingsId, setCompanySettingsId] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [connectedCarriers, setConnectedCarriers] = useState<ConnectedCarrier[]>([]);

  const [settings, setSettings] = useState<ShipStationSettingsData>({
    api_key: '',
    api_secret: '',
    default_ship_from_name: '',
    default_ship_from_company: '',
    default_ship_from_address1: '',
    default_ship_from_address2: '',
    default_ship_from_city: '',
    default_ship_from_state: '',
    default_ship_from_postal_code: '',
    default_ship_from_country: 'US',
    default_carrier_code: '',
    default_service_code: '',
  });

  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    carriers?: Array<{ name: string; code: string }>;
  } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (hasCredentials && testResult?.success) {
      loadCarriersFromAccount();
    }
  }, [hasCredentials, testResult?.success]);

  const loadCarriersFromAccount = async () => {
    if (!companySettingsId || !hasCredentials) return;

    try {
      setLoadingCarriers(true);

      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('shipstation_api_key, shipstation_api_secret')
        .eq('id', companySettingsId)
        .single();

      if (!companySettings?.shipstation_api_key || !companySettings?.shipstation_api_secret) {
        return;
      }

      const apiKey = await decryptToken(companySettings.shipstation_api_key);
      const apiSecret = await decryptToken(companySettings.shipstation_api_secret);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipstation-test`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey,
            apiSecret,
            action: 'list_carriers',
          }),
        }
      );

      const result = await response.json();

      if (result.success && result.carriers) {
        setConnectedCarriers(result.carriers);
      }
    } catch (err) {
      console.error('Error loading carriers:', err);
    } finally {
      setLoadingCarriers(false);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('No company found');

      const { data: companySettings, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      if (error) throw error;

      if (companySettings) {
        setCompanySettingsId(companySettings.id);
        const hasCreds = !!(companySettings.shipstation_api_key && companySettings.shipstation_api_secret);
        setHasCredentials(hasCreds);

        setSettings({
          api_key: hasCreds ? '••••••••••••••••' : '',
          api_secret: hasCreds ? '••••••••••••••••' : '',
          default_ship_from_name: companySettings.shipstation_default_ship_from_name || '',
          default_ship_from_company: companySettings.shipstation_default_ship_from_company || '',
          default_ship_from_address1: companySettings.shipstation_default_ship_from_address1 || '',
          default_ship_from_address2: companySettings.shipstation_default_ship_from_address2 || '',
          default_ship_from_city: companySettings.shipstation_default_ship_from_city || '',
          default_ship_from_state: companySettings.shipstation_default_ship_from_state || '',
          default_ship_from_postal_code: companySettings.shipstation_default_ship_from_postal_code || '',
          default_ship_from_country: companySettings.shipstation_default_ship_from_country || 'US',
          default_carrier_code: companySettings.shipstation_default_carrier_code || '',
          default_service_code: companySettings.shipstation_default_service_code || '',
        });
      }
    } catch (err) {
      console.error('Error loading ShipStation settings:', err);
      showNotification('error', 'Load Failed', 'Failed to load ShipStation settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      let apiKeyToTest = settings.api_key;
      let apiSecretToTest = settings.api_secret;

      if (settings.api_key === '••••••••••••••••' || !settings.api_key.trim()) {
        if (!hasCredentials) {
          setTestResult({
            success: false,
            message: 'Please enter your API credentials before testing',
          });
          return;
        }

        if (!companySettingsId) {
          setTestResult({
            success: false,
            message: 'Company settings not found',
          });
          return;
        }

        const { data: companySettings } = await supabase
          .from('company_settings')
          .select('shipstation_api_key, shipstation_api_secret')
          .eq('id', companySettingsId)
          .single();

        if (!companySettings?.shipstation_api_key || !companySettings?.shipstation_api_secret) {
          setTestResult({
            success: false,
            message: 'No saved credentials found',
          });
          return;
        }

        apiKeyToTest = await decryptToken(companySettings.shipstation_api_key);
        apiSecretToTest = await decryptToken(companySettings.shipstation_api_secret);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shipstation-test`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: apiKeyToTest,
            apiSecret: apiSecretToTest,
          }),
        }
      );

      const result = await response.json();

      setTestResult({
        success: result.success,
        message: result.success ? result.message : result.error,
        carriers: result.carriers,
      });

      if (result.success) {
        showNotification('success', 'Connection Successful', `Connected to ShipStation! Found ${result.carriersCount || 0} carrier(s).`);
        if (hasCredentials) {
          loadCarriersFromAccount();
        }
      } else {
        showNotification('error', 'Connection Failed', result.error);
      }
    } catch (err) {
      console.error('Error testing ShipStation connection:', err);
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to test connection',
      });
      showNotification('error', 'Test Failed', 'Failed to test ShipStation connection');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (!companySettingsId) {
        throw new Error('Company settings ID not found');
      }

      const updateData: any = {
        shipstation_default_ship_from_name: settings.default_ship_from_name || null,
        shipstation_default_ship_from_company: settings.default_ship_from_company || null,
        shipstation_default_ship_from_address1: settings.default_ship_from_address1 || null,
        shipstation_default_ship_from_address2: settings.default_ship_from_address2 || null,
        shipstation_default_ship_from_city: settings.default_ship_from_city || null,
        shipstation_default_ship_from_state: settings.default_ship_from_state || null,
        shipstation_default_ship_from_postal_code: settings.default_ship_from_postal_code || null,
        shipstation_default_ship_from_country: settings.default_ship_from_country || 'US',
        shipstation_default_carrier_code: settings.default_carrier_code || null,
        shipstation_default_service_code: settings.default_service_code || null,
      };

      if (settings.api_key && settings.api_key !== '••••••••••••••••') {
        const encryptedKey = await encryptToken(settings.api_key);
        updateData.shipstation_api_key = encryptedKey;
      }

      if (settings.api_secret && settings.api_secret !== '••••••••••••••••') {
        const encryptedSecret = await encryptToken(settings.api_secret);
        updateData.shipstation_api_secret = encryptedSecret;
      }

      const { error } = await supabase
        .from('company_settings')
        .update(updateData)
        .eq('id', companySettingsId);

      if (error) throw error;

      showNotification('success', 'Settings Saved', 'ShipStation settings have been saved successfully!');

      if (settings.api_key !== '••••••••••••••••') {
        setSettings(prev => ({
          ...prev,
          api_key: '••••••••••••••••',
          api_secret: '••••••••••••••••',
        }));
        setHasCredentials(true);
      }

      setTestResult(null);
    } catch (err) {
      console.error('Error saving ShipStation settings:', err);
      showNotification('error', 'Save Failed', 'Failed to save ShipStation settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  const selectedCarrier = connectedCarriers.find(c => c.code === settings.default_carrier_code);
  const availableServiceOptions = selectedCarrier?.services?.length
    ? [{ value: '', label: 'Select Service' }, ...selectedCarrier.services.map(s => ({ value: s.code, label: s.name }))]
    : settings.default_carrier_code
      ? [{ value: '', label: 'No services available' }]
      : [{ value: '', label: 'Select Carrier First' }];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">ShipStation Integration</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Connect your ShipStation account to manage order fulfillment and shipping directly from InkOps.
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Getting Your API Credentials</h3>
        <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
          <li>Log in to your <a href="https://ship.shipstation.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">ShipStation account</a></li>
          <li>Go to Settings → Account → API Settings</li>
          <li>Generate a new API Key and Secret (or use existing ones)</li>
          <li>Copy both values and paste them below</li>
        </ol>
      </div>

      <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">API Credentials</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Key <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={settings.api_key}
              onChange={(e) => setSettings(prev => ({ ...prev, api_key: e.target.value }))}
              placeholder="Enter your ShipStation API Key"
              className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Secret <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showApiSecret ? 'text' : 'password'}
              value={settings.api_secret}
              onChange={(e) => setSettings(prev => ({ ...prev, api_secret: e.target.value }))}
              placeholder="Enter your ShipStation API Secret"
              className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowApiSecret(!showApiSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          onClick={handleTestConnection}
          disabled={testing || (!settings.api_key && !hasCredentials)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Testing Connection...
            </>
          ) : (
            <>
              <TestTube className="w-4 h-4" />
              Test Connection
            </>
          )}
        </button>

        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${
                  testResult.success
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                </p>
                <p className={`text-sm mt-1 ${
                  testResult.success
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {testResult.message}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Default Ship From Address</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This address will be used as the default shipping origin for orders.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contact Name
            </label>
            <input
              type="text"
              value={settings.default_ship_from_name}
              onChange={(e) => setSettings(prev => ({ ...prev, default_ship_from_name: e.target.value }))}
              placeholder="John Doe"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={settings.default_ship_from_company}
              onChange={(e) => setSettings(prev => ({ ...prev, default_ship_from_company: e.target.value }))}
              placeholder="Your Company Name"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Address Line 1
          </label>
          <input
            type="text"
            value={settings.default_ship_from_address1}
            onChange={(e) => setSettings(prev => ({ ...prev, default_ship_from_address1: e.target.value }))}
            placeholder="123 Main Street"
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Address Line 2
          </label>
          <input
            type="text"
            value={settings.default_ship_from_address2}
            onChange={(e) => setSettings(prev => ({ ...prev, default_ship_from_address2: e.target.value }))}
            placeholder="Suite 100 (optional)"
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              City
            </label>
            <input
              type="text"
              value={settings.default_ship_from_city}
              onChange={(e) => setSettings(prev => ({ ...prev, default_ship_from_city: e.target.value }))}
              placeholder="Los Angeles"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              State
            </label>
            <input
              type="text"
              value={settings.default_ship_from_state}
              onChange={(e) => setSettings(prev => ({ ...prev, default_ship_from_state: e.target.value }))}
              placeholder="CA"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Postal Code
            </label>
            <input
              type="text"
              value={settings.default_ship_from_postal_code}
              onChange={(e) => setSettings(prev => ({ ...prev, default_ship_from_postal_code: e.target.value }))}
              placeholder="90001"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Country
          </label>
          <select
            value={settings.default_ship_from_country}
            onChange={(e) => setSettings(prev => ({ ...prev, default_ship_from_country: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          >
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="GB">United Kingdom</option>
            <option value="AU">Australia</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Default Shipping Preferences</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select from carriers connected to your ShipStation account.
            </p>
          </div>
          {hasCredentials && (
            <button
              onClick={loadCarriersFromAccount}
              disabled={loadingCarriers}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loadingCarriers ? 'animate-spin' : ''}`} />
              Refresh Carriers
            </button>
          )}
        </div>

        {connectedCarriers.length === 0 && hasCredentials && !loadingCarriers && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">No Carriers Found</p>
                <p className="text-sm mt-1 text-amber-700 dark:text-amber-300">
                  No carriers are connected to your ShipStation account. Please go to{' '}
                  <a
                    href="https://ship.shipstation.com/settings/shipping/carriers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-900 dark:hover:text-amber-100"
                  >
                    ShipStation Settings &rarr; Shipping &rarr; Carriers
                  </a>{' '}
                  to connect a carrier (UPS, FedEx, USPS, etc.), then click "Refresh Carriers" above.
                </p>
              </div>
            </div>
          </div>
        )}

        {loadingCarriers && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading carriers from your ShipStation account...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default Carrier
            </label>
            <select
              value={settings.default_carrier_code}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                default_carrier_code: e.target.value,
                default_service_code: '',
              }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
            >
              <option value="">Select Carrier</option>
              {connectedCarriers.map(carrier => (
                <option key={carrier.code} value={carrier.code}>
                  {carrier.nickname || carrier.name} ({carrier.code})
                </option>
              ))}
            </select>
            {connectedCarriers.length === 0 && !loadingCarriers && hasCredentials && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Test connection and refresh carriers to see available options
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default Service
            </label>
            <select
              value={settings.default_service_code}
              onChange={(e) => setSettings(prev => ({ ...prev, default_service_code: e.target.value }))}
              disabled={!settings.default_carrier_code || availableServiceOptions.length <= 1}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {availableServiceOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving Settings...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save ShipStation Settings
            </>
          )}
        </button>
      </div>

      {hasCredentials && testResult?.success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">ShipStation Connected</p>
              <p className="text-sm mt-1">
                Your ShipStation account is connected and ready to use for order fulfillment.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShipStationSettings;
