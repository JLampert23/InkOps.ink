import { useState } from 'react';
import { ChevronDown, ChevronRight, Package, Palette, Ruler } from 'lucide-react';
import { formatSizes, getTotalQuantityFromSizes } from '../utils/garment-parser';

interface LineItem {
  id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  extracted_style: string | null;
  extracted_color: string | null;
  extracted_sizes: Record<string, number> | null;
  extracted_sku: string | null;
  extraction_notes: string | null;
  parsed_at: string | null;
}

interface LineItemsViewerProps {
  invoiceId: string;
}

export function LineItemsViewer({ invoiceId }: LineItemsViewerProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadLineItems = async () => {
    if (lineItems.length > 0) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    try {
      const { createClient } = await import('../lib/supabase-client');
      const supabase = createClient();

      const { data, error } = await supabase
        .from('printavo_line_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('id');

      if (error) throw error;

      setLineItems(data || []);
      setExpanded(true);
    } catch (error) {
      console.error('Error loading line items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = () => {
    if (lineItems.length > 0) {
      setExpanded(!expanded);
    } else {
      loadLineItems();
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={toggleExpanded}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          )}
          <span className="font-medium text-gray-900">Line Items & Garment Details</span>
          {lineItems.length > 0 && (
            <span className="text-sm text-gray-500">({lineItems.length} items)</span>
          )}
        </div>
        {loading && (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        )}
      </button>

      {expanded && lineItems.length > 0 && (
        <div className="divide-y divide-gray-200">
          {lineItems.map((item) => {
            const hasParsedData = item.extracted_style || item.extracted_color ||
                                  (item.extracted_sizes && Object.keys(item.extracted_sizes).length > 0);

            return (
              <div key={item.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.description || 'No description'}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-semibold text-gray-900">
                      ${item.total_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.quantity} × ${item.unit_price.toFixed(2)}
                    </p>
                  </div>
                </div>

                {hasParsedData && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {item.extracted_style && (
                      <div className="flex items-start gap-2 bg-blue-50 rounded-lg p-2">
                        <Package className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-blue-900">Style</p>
                          <p className="text-sm text-blue-700 font-mono">{item.extracted_style}</p>
                        </div>
                      </div>
                    )}

                    {item.extracted_color && (
                      <div className="flex items-start gap-2 bg-purple-50 rounded-lg p-2">
                        <Palette className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-purple-900">Color</p>
                          <p className="text-sm text-purple-700">{item.extracted_color}</p>
                        </div>
                      </div>
                    )}

                    {item.extracted_sizes && Object.keys(item.extracted_sizes).length > 0 && (
                      <div className="flex items-start gap-2 bg-green-50 rounded-lg p-2">
                        <Ruler className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-green-900">
                            Sizes ({getTotalQuantityFromSizes(item.extracted_sizes)} total)
                          </p>
                          <p className="text-sm text-green-700">{formatSizes(item.extracted_sizes)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {item.extracted_sku && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      SKU: {item.extracted_sku}
                    </span>
                  </div>
                )}

                {!hasParsedData && item.description && (
                  <p className="mt-2 text-xs text-gray-500 italic">
                    No structured garment data could be extracted from this line item
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {expanded && lineItems.length === 0 && !loading && (
        <div className="p-8 text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No line items found for this invoice</p>
        </div>
      )}
    </div>
  );
}
