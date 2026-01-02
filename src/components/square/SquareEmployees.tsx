import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { exportToCSV, exportToPDF, type SquareExportOptions } from '../../utils/square-export';
import SquareFilterBar from './SquareFilterBar';

export default function SquareEmployees() {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      // PLACEHOLDER: Square API call
      alert('Fetch Employees - Connect to Square API here');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    const options: SquareExportOptions = {
      filename: `square-employees-${new Date().toISOString().split('T')[0]}`,
      title: 'Square Employees',
      columns: [
        { header: 'Name', key: 'name' },
        { header: 'Email', key: 'email' },
        { header: 'Role', key: 'role' },
        { header: 'Status', key: 'status' },
      ],
      data: employees,
    };
    if (format === 'csv') exportToCSV(options);
    else exportToPDF(options);
    setShowExportMenu(false);
  };

  return (
    <div className="space-y-6">
      <SquareFilterBar
        searchPlaceholder="Search employees by name, email, or role..."
        sortOptions={[
          { label: 'Sort by Name', value: 'name' },
          { label: 'Sort by Role', value: 'role' },
          { label: 'Sort by Status', value: 'status' }
        ]}
        showDateRange={false}
        showSort={true}
      />

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Employees</h2>
        <div className="flex gap-3">
          <button onClick={fetchEmployees} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch Data'}
          </button>
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={employees.length === 0} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">
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
      {employees.length === 0 && !loading && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600">No employees to display. Click "Fetch Data" to load from Square.</p>
        </div>
      )}
    </div>
  );
}
