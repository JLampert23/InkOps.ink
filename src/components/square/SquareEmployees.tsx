import { useState } from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { exportToCSV, exportToPDF, type SquareExportOptions } from '../../utils/square-export';
import { SquareApiService } from '../../services/square-api-service';
import SquareFilterBar from './SquareFilterBar';

export default function SquareEmployees() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await SquareApiService.listTeamMembers();

      if (data.team_members) {
        setEmployees(data.team_members.map((member: any) => ({
          id: member.id,
          name: `${member.given_name || ''} ${member.family_name || ''}`.trim() || 'N/A',
          email: member.email_address || 'N/A',
          phone: member.phone_number || 'N/A',
          status: member.status || 'N/A',
          created_at: member.created_at,
        })));
      } else {
        setEmployees([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch team members');
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
        { header: 'Phone', key: 'phone' },
        { header: 'Status', key: 'status' },
      ],
      data: employees,
      summary: [
        { label: 'Total Team Members', value: String(employees.length) },
      ],
    };
    if (format === 'csv') exportToCSV(options);
    else exportToPDF(options);
    setShowExportMenu(false);
  };

  const filteredEmployees = employees.filter(emp =>
    searchTerm === '' ||
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SquareFilterBar
        searchPlaceholder="Search employees by name, email, or phone..."
        sortOptions={[
          { label: 'Sort by Name', value: 'name' },
          { label: 'Sort by Status', value: 'status' }
        ]}
        onSearchChange={(value) => setSearchTerm(value)}
        showDateRange={false}
        showSort={true}
      />

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Team Members</h2>
        <div className="flex gap-3">
          <button
            onClick={fetchEmployees}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Fetching...' : 'Fetch Data'}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={employees.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {showExportMenu && (
              <div className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg dark:shadow-slate-900/50 py-2 z-10">
                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-600">Export as CSV</button>
                <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-600">Export as PDF</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 dark:text-red-300">Error</h3>
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {filteredEmployees.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {filteredEmployees.map((employee, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{employee.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{employee.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{employee.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{employee.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            {employees.length === 0
              ? 'No team members to display. Click "Fetch Data" to load from Square.'
              : 'No team members match your search criteria.'}
          </p>
        </div>
      )}
    </div>
  );
}
