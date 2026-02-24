import React, { useState, useEffect } from 'react';
import { Check, X, Loader2, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface DiagnosticResult {
  name: string;
  status: 'checking' | 'success' | 'error' | 'disabled';
  message: string;
  details?: any;
}

export function IntegrationsDiagnostic() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [portalTesting, setPortalTesting] = useState(false);
  const [portalResult, setPortalResult] = useState<any>(null);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setTesting(true);
    const diagnostics: DiagnosticResult[] = [];

    // 1. Check authentication
    diagnostics.push({ name: 'Authentication', status: 'checking', message: 'Checking...' });
    setResults([...diagnostics]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        diagnostics[0] = { name: 'Authentication', status: 'error', message: 'Not authenticated' };
        setResults([...diagnostics]);
        setTesting(false);
        return;
      }
      diagnostics[0] = { name: 'Authentication', status: 'success', message: 'Authenticated', details: { userId: session.user.id } };
      setResults([...diagnostics]);

      // 2. Check company settings
      diagnostics.push({ name: 'Company Settings', status: 'checking', message: 'Loading...' });
      setResults([...diagnostics]);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile?.company_id) {
        diagnostics[1] = { name: 'Company Settings', status: 'error', message: 'No company found' };
        setResults([...diagnostics]);
        setTesting(false);
        return;
      }

      const { data: settings } = await supabase
        .from('company_settings')
        .select('sanmar_enabled, ssactivewear_enabled, sanmar_promo_username, sanmar_promo_password_encrypted, ssactivewear_username, ssactivewear_api_key_encrypted')
        .eq('id', profile.company_id)
        .maybeSingle();

      diagnostics[1] = {
        name: 'Company Settings',
        status: 'success',
        message: 'Loaded',
        details: {
          companyId: profile.company_id,
          sanmarEnabled: settings?.sanmar_enabled || false,
          ssaEnabled: settings?.ssactivewear_enabled || false,
        }
      };
      setResults([...diagnostics]);

      // 3. Check SanMar configuration
      diagnostics.push({ name: 'SanMar Configuration', status: 'checking', message: 'Checking...' });
      setResults([...diagnostics]);

      if (!settings?.sanmar_enabled) {
        diagnostics[2] = { name: 'SanMar Configuration', status: 'disabled', message: 'SanMar integration is disabled' };
      } else if (!settings?.sanmar_promo_username || !settings?.sanmar_promo_password_encrypted) {
        diagnostics[2] = { name: 'SanMar Configuration', status: 'error', message: 'SanMar credentials not configured' };
      } else {
        diagnostics[2] = {
          name: 'SanMar Configuration',
          status: 'success',
          message: 'Credentials configured',
          details: {
            username: settings.sanmar_promo_username,
            hasPassword: !!settings.sanmar_promo_password_encrypted
          }
        };
      }
      setResults([...diagnostics]);

      // 4. Check SSActivewear configuration
      diagnostics.push({ name: 'SSActivewear Configuration', status: 'checking', message: 'Checking...' });
      setResults([...diagnostics]);

      if (!settings?.ssactivewear_enabled) {
        diagnostics[3] = { name: 'SSActivewear Configuration', status: 'disabled', message: 'SSActivewear integration is disabled' };
      } else if (!settings?.ssactivewear_username || !settings?.ssactivewear_api_key_encrypted) {
        diagnostics[3] = { name: 'SSActivewear Configuration', status: 'error', message: 'SSActivewear credentials not configured' };
      } else {
        diagnostics[3] = {
          name: 'SSActivewear Configuration',
          status: 'success',
          message: 'Credentials configured',
          details: {
            accountNumber: settings.ssactivewear_username,
            hasApiKey: !!settings.ssactivewear_api_key_encrypted
          }
        };
      }
      setResults([...diagnostics]);

      // 5. Test product search endpoint
      if (settings?.sanmar_enabled || settings?.ssactivewear_enabled) {
        diagnostics.push({ name: 'Product Search API', status: 'checking', message: 'Testing with PC54...' });
        setResults([...diagnostics]);

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-search?style=PC54`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const data = await response.json();

          if (response.ok && data.success) {
            diagnostics[4] = {
              name: 'Product Search API',
              status: 'success',
              message: `Found ${data.count} result(s)`,
              details: data
            };
          } else {
            diagnostics[4] = {
              name: 'Product Search API',
              status: 'error',
              message: data.error || 'Search failed',
              details: data
            };
          }
        } catch (error: any) {
          diagnostics[4] = {
            name: 'Product Search API',
            status: 'error',
            message: error.message || 'Network error',
            details: { error: error.toString() }
          };
        }
        setResults([...diagnostics]);
      }

    } catch (error: any) {
      console.error('Diagnostic error:', error);
    }

    setTesting(false);
  };

  const testPortalData = async () => {
    setPortalTesting(true);
    setPortalResult(null);

    try {
      const testEmail = 'Jamie@toddssportinggoods.com';

      const { data: customer } = await supabase
        .from('customers')
        .select('id, email, company_id')
        .ilike('email', testEmail)
        .maybeSingle();

      if (!customer) {
        setPortalResult({
          status: 'error',
          message: 'Customer not found in database',
          data: { email: testEmail }
        });
        setPortalTesting(false);
        return;
      }

      const { data: session } = await supabase
        .from('customer_portal_sessions')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!session) {
        setPortalResult({
          status: 'info',
          message: 'Customer exists but no portal session found. Send a magic link to create a session.',
          data: {
            customer,
            hint: 'Use send-magic-link function to create a portal session'
          }
        });
        setPortalTesting(false);
        return;
      }

      const isExpired = new Date(session.expires_at) < new Date();

      if (isExpired) {
        setPortalResult({
          status: 'warning',
          message: 'Portal session exists but is expired',
          data: {
            customer,
            session: {
              ...session,
              magic_token: session.magic_token?.substring(0, 8) + '...'
            },
            expiresAt: session.expires_at
          }
        });
        setPortalTesting(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-data?type=quotes`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'X-Customer-Token': session.magic_token,
          },
        }
      );

      const data = await response.json();
      setPortalResult({
        status: response.ok ? 'success' : 'error',
        httpStatus: response.status,
        data: {
          customer,
          sessionValid: true,
          portalResponse: data
        },
      });
    } catch (error: any) {
      setPortalResult({
        status: 'error',
        message: error.message,
        error: error.toString(),
      });
    }

    setPortalTesting(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-600" />;
      case 'success':
        return <Check className="w-5 h-5 text-green-600" />;
      case 'error':
        return <X className="w-5 h-5 text-red-600" />;
      case 'disabled':
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'checking':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800';
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800';
      case 'disabled':
        return 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Integrations Diagnostic
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Check the status of your vendor integrations
            </p>
          </div>
          <button
            onClick={runDiagnostics}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            Retest
          </button>
        </div>

        <div className="space-y-4">
          {results.map((result, index) => (
            <div
              key={index}
              className={`border-2 rounded-lg p-4 transition-all ${getStatusColor(result.status)}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getStatusIcon(result.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {result.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {result.message}
                  </p>
                  {result.details && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 dark:text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                        View details
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-900 dark:bg-black text-gray-100 p-3 rounded overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {results.length === 0 && !testing && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Click "Retest" to run diagnostics
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Portal Data Test
          </h2>
          <button
            onClick={testPortalData}
            disabled={portalTesting}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            <Zap className={`w-5 h-5 ${portalTesting ? 'animate-pulse' : ''}`} />
            {portalTesting ? 'Testing...' : 'Test Portal Data (Jamie@toddssportinggoods.com)'}
          </button>

          {portalResult && (
            <div className={`mt-4 p-4 rounded-lg border-2 ${
              portalResult.status === 'success'
                ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                : portalResult.status === 'info'
                ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800'
                : portalResult.status === 'warning'
                ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800'
                : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {portalResult.status === 'success' ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : portalResult.status === 'info' ? (
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                ) : portalResult.status === 'warning' ? (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <X className="w-5 h-5 text-red-600" />
                )}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {portalResult.status === 'success' ? 'Success' : portalResult.status === 'info' ? 'Info' : portalResult.status === 'warning' ? 'Warning' : 'Error'}
                  {portalResult.httpStatus && ` (HTTP ${portalResult.httpStatus})`}
                </span>
              </div>
              {portalResult.message && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{portalResult.message}</p>
              )}
              <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto max-h-96">
                {JSON.stringify(portalResult.data || portalResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
