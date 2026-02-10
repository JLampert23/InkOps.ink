import React, { useState } from 'react';
import { Search, AlertCircle, CheckCircle, XCircle, Database, ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

export default function SanMarDiagnostic() {
  const [style, setStyle] = useState('PC54');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [productResult, setProductResult] = useState<any>(null);

  const testConnection = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setTestResult({
          error: 'No active session',
          message: 'Please log in to test SanMar connection'
        });
        setLoading(false);
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sanmar-api?action=test`;

      console.log('Testing SanMar connection...');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        setTestResult({
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: errorData
        });
      } else {
        const data = await response.json();
        setTestResult(data);
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      setTestResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testProductLookup = async () => {
    setLoading(true);
    setProductResult(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setProductResult({
          error: 'No active session',
          message: 'Please log in to test product lookup'
        });
        setLoading(false);
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sanmar-api?action=unified&style=${encodeURIComponent(style)}`;

      console.log('Testing SanMar product lookup...');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        setProductResult({
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: errorData
        });
      } else {
        const data = await response.json();
        setProductResult(data);
      }
    } catch (error: any) {
      console.error('Product lookup error:', error);
      setProductResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const renderResult = (result: any, title: string, icon: React.ReactNode) => {
    if (!result) return null;

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <h3 className="text-xl font-bold">{title}</h3>
        </div>

        <div className="mb-4">
          {result.error ? (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <span className="font-bold">ERROR: {result.error}</span>
            </div>
          ) : result.success || result.authenticated ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-bold">SUCCESS</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="w-5 h-5" />
              <span className="font-bold">UNKNOWN STATUS</span>
            </div>
          )}
        </div>

        {result.message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            {result.message}
          </div>
        )}

        {result.details && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
            <strong>Details:</strong>
            <pre className="mt-2 text-xs overflow-x-auto">{JSON.stringify(result.details, null, 2)}</pre>
          </div>
        )}

        <div>
          <h4 className="font-bold mb-2">Full Response</h4>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">SanMar PromoStandards Diagnostic</h1>
        <p className="text-gray-600 mb-6">Test SanMar PromoStandards API connection and product lookup</p>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Style Number</label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="e.g., PC54, PC61"
              />
              <p className="text-xs text-gray-500 mt-1">Default: PC54 (Port & Company Core Cotton Tee)</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={testConnection}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                {loading ? 'Testing...' : 'Test Connection'}
              </button>

              <button
                onClick={testProductLookup}
                disabled={loading}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Searching...' : 'Lookup Product'}
              </button>
            </div>
          </div>
        </div>

        {(testResult || productResult) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderResult(
              testResult,
              'Connection Test',
              <Database className="w-5 h-5 text-blue-600" />
            )}
            {renderResult(
              productResult,
              'Product Lookup',
              <Search className="w-5 h-5 text-green-600" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
