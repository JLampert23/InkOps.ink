import { useState } from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { exportToCSV, exportToPDF, formatCurrency, type SquareExportOptions } from '../../utils/square-export';
import { SquareApiService } from '../../services/square-api-service';
import SquareFilterBar from './SquareFilterBar';

export default function SquareItems() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await SquareApiService.listCatalogItems();

      if (data.objects) {
        setItems(data.objects.map((item: any) => {
          const itemData = item.item_data;
          const variation = itemData?.variations?.[0];
          const price = variation?.item_variation_data?.price_money?.amount;

          return {
            id: item.id,
            name: itemData?.name || 'N/A',
            sku: variation?.item_variation_data?.sku || 'N/A',
            price: price ? price / 100 : 0,
            category: itemData?.category_id || 'N/A',
          };
        }));
      } else {
        setItems([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    const options: SquareExportOptions = {
      filename: `square-items-${new Date().toISOString().split('T')[0]}`,
      title: 'Square Items / Products',
      columns: [
        { header: 'Name', key: 'name' },
        { header: 'SKU', key: 'sku' },
        { header: 'Price', key: 'price', format: formatCurrency },
        { header: 'Category', key: 'category' },
      ],
      data: items,
      summary: [
        { label: 'Total Items', value: String(items.length) },
      ],
    };
    if (format === 'csv') exportToCSV(options);
    else exportToPDF(options);
    setShowExportMenu(false);
  };

  const filteredItems = items.filter(item =>
    searchTerm === '' ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <SquareFilterBar
        searchPlaceholder="Search items by name, SKU, or category..."
        sortOptions={[
          { label: 'Sort by Name', value: 'name' },
          { label: 'Sort by Price', value: 'price' },
          { label: 'Sort by Category', value: 'category' }
        ]}
        onSearchChange={(value) => setSearchTerm(value)}
        showDateRange={false}
        showSort={true}
      />

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Items / Products</h2>
        <div className="flex gap-3">
          <button
            onClick={fetchItems}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Fetching...' : 'Fetch Data'}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={items.length === 0}
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

      {filteredItems.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SKU</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item ID</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {filteredItems.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{item.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.sku}</td>
                  <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white">{formatCurrency(item.price)}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400 text-xs">{item.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && (
        <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            {items.length === 0
              ? 'No items to display. Click "Fetch Data" to load from Square.'
              : 'No items match your search criteria.'}
          </p>
        </div>
      )}
    </div>
  );
}
