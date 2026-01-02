import { useState, useEffect } from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { exportToCSV, exportToPDF, type SquareExportOptions } from '../../utils/square-export';
import { SquareApiService } from '../../services/square-api-service';

export default function SquareLocations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await SquareApiService.listLocations();

      if (data.locations) {
        setLocations(data.locations.map((loc: any) => ({
          id: loc.id,
          name: loc.name,
          address: [
            loc.address?.address_line_1,
            loc.address?.locality,
            loc.address?.administrative_district_level_1,
            loc.address?.postal_code
          ].filter(Boolean).join(', '),
          phone: loc.phone_number || 'N/A',
          status: loc.status,
        })));
      } else {
        setLocations([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleExport = (format: 'csv' | 'pdf') => {
    const options: SquareExportOptions = {
      filename: `square-locations-${new Date().toISOString().split('T')[0]}`,
      title: 'Square Locations',
      columns: [
        { header: 'Name', key: 'name' },
        { header: 'Address', key: 'address' },
        { header: 'Phone', key: 'phone' },
        { header: 'Status', key: 'status' },
      ],
      data: locations,
    };
    if (format === 'csv') exportToCSV(options);
    else exportToPDF(options);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Locations</h2>
        <div className="flex gap-3">
          <button onClick={fetchLocations} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch Data'}
          </button>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={locations.length === 0} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
              <Download className="w-4 h-4" />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-10">
                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-left hover:bg-gray-50">Export as CSV</button>
                <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2 text-left hover:bg-gray-50">Export as PDF</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {locations.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {locations.map((location, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{location.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{location.address}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{location.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{location.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No locations to display. Click "Fetch Data" to load from Square.</p>
        </div>
      )}
    </div>
  );
}
