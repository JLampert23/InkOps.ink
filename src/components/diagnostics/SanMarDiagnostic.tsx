import React, { useState } from 'react';
import { Search, AlertCircle, CheckCircle, XCircle, Database, ShoppingCart } from 'lucide-react';

export default function SanMarDiagnostic() {
  const [style, setStyle] = useState('PC61');
  const [companyId, setCompanyId] = useState('5f36fe64-8b67-4b62-a023-29590da87c41');
  const [loading, setLoading] = useState(false);
  const [productDataResult, setProductDataResult] = useState<any>(null);
  const [sellableResult, setSellableResult] = useState<any>(null);

  const testBothEndpoints = async () => {
    setLoading(true);
    setProductDataResult(null);
    setSellableResult(null);

    try {
      const baseUrl = 'https://cuaukcvccxvfpuxaciac.supabase.co/functions/v1/test-sanmar-endpoint';

      const productDataUrl = `${baseUrl}?style=${encodeURIComponent(style)}&company_id=${encodeURIComponent(companyId)}&service=product-data`;
      const sellableUrl = `${baseUrl}?style=${encodeURIComponent(style)}&company_id=${encodeURIComponent(companyId)}&service=sellable`;

      // Test ProductDataService first
      console.log('Testing ProductDataService...');
      try {
        const productDataResponse = await fetch(productDataUrl);
        if (!productDataResponse.ok) {
          const errorText = await productDataResponse.text();
          setProductDataResult({
            error: `HTTP ${productDataResponse.status}: ${productDataResponse.statusText}`,
            details: errorText
          });
        } else {
          const productData = await productDataResponse.json();
          setProductDataResult(productData);
        }
      } catch (error: any) {
        console.error('ProductDataService error:', error);
        setProductDataResult({ error: error.message });
      }

      // Wait 2 seconds before testing second endpoint to avoid worker limits
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test ProductSellableService
      console.log('Testing ProductSellableService...');
      try {
        const sellableResponse = await fetch(sellableUrl);
        if (!sellableResponse.ok) {
          const errorText = await sellableResponse.text();
          setSellableResult({
            error: `HTTP ${sellableResponse.status}: ${sellableResponse.statusText}`,
            details: errorText
          });
        } else {
          const sellableData = await sellableResponse.json();
          setSellableResult(sellableData);
        }
      } catch (error: any) {
        console.error('ProductSellableService error:', error);
        setSellableResult({ error: error.message });
      }

    } catch (error: any) {
      console.error('Error:', error);
      setProductDataResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const renderEndpointResult = (result: any, title: string, icon: React.ReactNode) => {
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
              <span className="font-bold">Found {result.partMatches} variants!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-orange-600">
              <AlertCircle className="w-5 h-5" />
              <span className="font-bold">No variants found</span>
            </div>
          )}
        </div>

        <div className="mb-4 bg-gray-50 p-4 rounded text-sm space-y-1">
          <div><strong>Variants Found:</strong> {result.partMatches || 0}</div>
          <div><strong>Has Fault:</strong> {result.hasFault ? 'Yes' : 'No'}</div>
          <div><strong>Has Error:</strong> {result.hasError ? 'Yes' : 'No'}</div>
          <div><strong>Response Size:</strong> {result.xmlLength?.toLocaleString() || 0} bytes</div>
        </div>

        {result.sampleParts && result.sampleParts.length > 0 && (
          <div className="mb-4">
            <h4 className="font-bold mb-2">Sample Variants (first 3)</h4>
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
          <h4 className="font-bold mb-2">Raw XML Response</h4>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
            <pre>{result.xmlPreview || JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">SanMar API Diagnostic Tool</h1>
        <p className="text-gray-600 mb-6">Compare ProductDataService vs ProductSellableService</p>

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
              onClick={testBothEndpoints}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Testing Both Endpoints...' : 'Test Both Endpoints'}
            </button>
          </div>
        </div>

        {(productDataResult || sellableResult) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderEndpointResult(
              productDataResult,
              'ProductDataService',
              <Database className="w-5 h-5 text-blue-600" />
            )}
            {renderEndpointResult(
              sellableResult,
              'ProductSellableService',
              <ShoppingCart className="w-5 h-5 text-green-600" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
