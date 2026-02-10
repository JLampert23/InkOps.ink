import { useState, useEffect } from 'react';
import { ArrowRight, Settings, Copy, Check, Loader2, Save, Globe, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useRBAC } from '../../hooks/useRBAC';
import {
  chipplySettingsService,
  ChipplyEndpointSettings,
  ChipplyImportBehavior,
} from '../../services/chipply-settings-service';

interface Props {
  onBack: () => void;
}

export function ChipplyIntegrationSettings({ onBack }: Props) {
  const { isSuperAdmin, loading: rbacLoading } = useRBAC();

  const [endpointSettings, setEndpointSettings] = useState<ChipplyEndpointSettings>({
    auth_type: 'basic',
    username: '',
    password: '',
    api_key: '',
  });
  const [importBehavior, setImportBehavior] = useState<ChipplyImportBehavior>({
    create_quote_on_import: true,
    auto_approve_quote: false,
    store_sale_order_in_notes: true,
    populate_nickname: true,
  });

  const [loadingEndpoint, setLoadingEndpoint] = useState(true);
  const [loadingBehavior, setLoadingBehavior] = useState(true);
  const [savingEndpoint, setSavingEndpoint] = useState(false);
  const [savingBehavior, setSavingBehavior] = useState(false);
  const [endpointSuccess, setEndpointSuccess] = useState(false);
  const [behaviorSuccess, setBehaviorSuccess] = useState(false);
  const [endpointError, setEndpointError] = useState<string | null>(null);
  const [behaviorError, setBehaviorError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const endpointUrl = chipplySettingsService.getEndpointUrl();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const [ep, bh] = await Promise.all([
      chipplySettingsService.getEndpointSettings(),
      chipplySettingsService.getImportBehavior(),
    ]);
    setEndpointSettings(ep);
    setImportBehavior(bh);
    setLoadingEndpoint(false);
    setLoadingBehavior(false);
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateEndpoint = (): string | null => {
    if (endpointSettings.auth_type === 'basic') {
      if (!endpointSettings.username.trim() || !endpointSettings.password.trim()) {
        return 'Username and password are required for Basic Auth.';
      }
    } else {
      if (!endpointSettings.api_key.trim()) {
        return 'API Key is required.';
      }
    }
    return null;
  };

  const handleSaveEndpoint = async () => {
    const validationError = validateEndpoint();
    if (validationError) {
      setEndpointError(validationError);
      return;
    }

    setEndpointError(null);
    setSavingEndpoint(true);
    const { error } = await chipplySettingsService.saveEndpointSettings(endpointSettings);
    setSavingEndpoint(false);

    if (error) {
      setEndpointError(error);
    } else {
      setEndpointSuccess(true);
      setTimeout(() => setEndpointSuccess(false), 3000);
    }
  };

  const handleSaveBehavior = async () => {
    setBehaviorError(null);
    setSavingBehavior(true);
    const { error } = await chipplySettingsService.saveImportBehavior(importBehavior);
    setSavingBehavior(false);

    if (error) {
      setBehaviorError(error);
    } else {
      setBehaviorSuccess(true);
      setTimeout(() => setBehaviorSuccess(false), 3000);
    }
  };

  if (rbacLoading || loadingEndpoint || loadingBehavior) {
    return (
      <div className="space-y-6">
        <PageHeader onBack={onBack} />
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader onBack={onBack} />
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm p-10 text-center">
          <ShieldCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Super Admin Required
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Only Super Admin users can access integration settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader onBack={onBack} />

      {/* Endpoint Configuration */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
            <Globe className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Endpoint Configuration
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Configure how Chipply authenticates with your webhook endpoint.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Public Endpoint URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Public Endpoint URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={endpointUrl}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 font-mono cursor-default"
              />
              <button
                onClick={handleCopyUrl}
                className="px-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                title="Copy URL"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Auto-generated from your Supabase project. Provide this URL to Chipply.
            </p>
          </div>

          {/* Authentication Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Authentication Type
            </label>
            <select
              value={endpointSettings.auth_type}
              onChange={e =>
                setEndpointSettings(prev => ({
                  ...prev,
                  auth_type: e.target.value as 'basic' | 'api_key',
                }))
              }
              className="w-full max-w-xs px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
            >
              <option value="basic">Basic Auth</option>
              <option value="api_key">API Key</option>
            </select>
          </div>

          {/* Basic Auth fields */}
          {endpointSettings.auth_type === 'basic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={endpointSettings.username}
                  onChange={e =>
                    setEndpointSettings(prev => ({ ...prev, username: e.target.value }))
                  }
                  placeholder="Enter username"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={endpointSettings.password}
                    onChange={e =>
                      setEndpointSettings(prev => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Enter password"
                    className="w-full px-3 py-2 pr-10 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* API Key field */}
          {endpointSettings.auth_type === 'api_key' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                API Key
              </label>
              <div className="relative max-w-lg">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={endpointSettings.api_key}
                  onChange={e =>
                    setEndpointSettings(prev => ({ ...prev, api_key: e.target.value }))
                  }
                  placeholder="Enter API key"
                  className="w-full px-3 py-2 pr-10 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {endpointError && (
            <p className="text-sm text-red-600 dark:text-red-400">{endpointError}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveEndpoint}
              disabled={savingEndpoint}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm font-medium text-sm disabled:opacity-50"
            >
              {savingEndpoint ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Endpoint Settings
            </button>
            {endpointSuccess && (
              <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Import Behavior */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Import Behavior
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Control how imported Chipply work orders are processed.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-1">
          <ToggleRow
            label="Create Quote (QTE) on import"
            description="Automatically generate a new Quote from each incoming Chipply work order."
            checked={importBehavior.create_quote_on_import}
            onChange={v => setImportBehavior(prev => ({ ...prev, create_quote_on_import: v }))}
          />
          <ToggleRow
            label="Auto-approve quote"
            description="Immediately approve the generated quote without manual review."
            checked={importBehavior.auto_approve_quote}
            onChange={v => setImportBehavior(prev => ({ ...prev, auto_approve_quote: v }))}
          />
          <ToggleRow
            label="Store Chipply Sale Order in Production Notes"
            description="Copy the original Chipply sale order number into the quote's production notes field."
            checked={importBehavior.store_sale_order_in_notes}
            onChange={v => setImportBehavior(prev => ({ ...prev, store_sale_order_in_notes: v }))}
          />
          <ToggleRow
            label="Populate Nickname with Store Name + Batch Number"
            description="Set the quote nickname to the Chipply store name combined with the batch number."
            checked={importBehavior.populate_nickname}
            onChange={v => setImportBehavior(prev => ({ ...prev, populate_nickname: v }))}
          />

          {behaviorError && (
            <p className="text-sm text-red-600 dark:text-red-400 pt-3">{behaviorError}</p>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={handleSaveBehavior}
              disabled={savingBehavior}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm font-medium text-sm disabled:opacity-50"
            >
              {savingBehavior ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Import Settings
            </button>
            {behaviorSuccess && (
              <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Back
      </button>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Chipply Integration Settings
      </h1>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 dark:border-slate-700/60 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
          checked ? 'bg-teal-600' : 'bg-gray-200 dark:bg-slate-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
