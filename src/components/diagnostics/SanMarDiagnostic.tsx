import React, { useState } from 'react';
import { Search, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export default function SanMarDiagnostic() {
  const [style, setStyle] = useState('PC61');
  const [companyId, setCompanyId] = useState('5f36fe64-8b67-4b62-a023-29590da87c41');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testSanMar = async () => {
    setLoading(true);
    setResult(null);

    try {
      const url = `https://cuaukcvccxvfpuxaciac.supabase.co/functions/v1/test-sanmar-endpoint?style=${encodeURIComponent(style)}&company_id=${encodeURIComponent(companyId)}`;

      console.log('Calling:', url);

      const response = await fetch(url);
      const data = await response.json();

      console.log('Response:', data);
      setResult(data);
    } catch (error) {
      console.error('Error:', error);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">SanMar API Diagnostic Tool</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Style Number</label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="e.g., PC61, ST350"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Company ID</label>
              <input
                type="text"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            <button
              onClick={testSanMar}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Testing...' : 'Test SanMar API'}
            </button>
          </div>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              {result.error ? (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="w-5 h-5" />
                  <span className="font-bold">ERROR</span>
                </div>
              ) : result.hasFault ? (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="w-5 h-5" />
                  <span className="font-bold">SOAP FAULT DETECTED</span>
                </div>
              ) : result.hasError ? (
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-bold">ERROR DETECTED</span>
                </div>
              ) : result.partMatches > 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-bold">Found {result.partMatches} parts!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-bold">No parts found</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <h3 className="font-bold mb-2">Summary</h3>
              <div className="text-sm space-y-1">
                <div>Parts Found: {result.partMatches || 0}</div>
                <div>Has Fault: {result.hasFault ? 'Yes' : 'No'}</div>
                <div>Has Error: {result.hasError ? 'Yes' : 'No'}</div>
                <div>Response Length: {result.responseLength || 0} characters</div>
              </div>
            </div>

            {result.sampleParts && result.sampleParts.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold mb-2">Sample Parts (first 3)</h3>
                <div className="text-sm space-y-2">
                  {result.sampleParts.map((part: string, idx: number) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded font-mono text-xs overflow-x-auto">
                      {part}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-bold mb-2">Raw XML Response</h3>
              <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
                <pre>{result.rawXml || JSON.stringify(result, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
