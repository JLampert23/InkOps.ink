import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, Package, ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface Product {
  id: string;
  style_number: string;
  product_name: string;
  colors: ProductColor[];
  sizes: string[];
  base_price: number;
  supplier: string;
  supplier_product_id?: string;
  image_url?: string;
}

interface ProductColor {
  color_name: string;
  color_code?: string;
  sizes: SizeInfo[];
}

interface SizeInfo {
  size: string;
  price: number;
  in_stock: boolean;
}

interface ProductSearchModalProps {
  vendorId: string;
  vendorType: string;
  onSelect: (product: any) => void;
  onClose: () => void;
}

export function ProductSearchModal({ vendorId, vendorType, onSelect, onClose }: ProductSearchModalProps) {
  console.log('🚀 ProductSearchModal RENDERED!');
  console.log('Vendor ID:', vendorId);
  console.log('Vendor Type:', vendorType);

  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSizes, setSelectedSizes] = useState<{ [size: string]: number }>({});

  useEffect(() => {
    console.log('🔄 useEffect triggered, searchTerm:', searchTerm, 'length:', searchTerm.length);
    if (searchTerm.length >= 3) {
      console.log('✅ searchTerm >= 3, setting up timer...');
      const timer = setTimeout(() => {
        console.log('⏰ Timer fired, calling searchProducts()');
        searchProducts();
      }, 500);
      return () => {
        console.log('🧹 Cleaning up timer');
        clearTimeout(timer);
      };
    } else {
      console.log('⚠️ searchTerm too short, not searching');
    }
  }, [searchTerm]);

  const searchProducts = async () => {
    console.log('🔍 searchProducts() called with searchTerm:', searchTerm);
    if (!searchTerm.trim()) {
      console.log('❌ searchTerm is empty, returning');
      return;
    }

    try {
      setSearching(true);
      console.log('⏳ Set searching to true');

      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 Session check:', session ? 'Found' : 'NOT FOUND');

      if (!session) {
        console.error('❌ Not authenticated - no session found');
        throw new Error('Not authenticated');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      console.log('🌐 Supabase URL:', supabaseUrl);
      console.log('🔑 Access token (first 20 chars):', session.access_token?.substring(0, 20));

      const fullUrl = `${supabaseUrl}/functions/v1/product-search?style=${encodeURIComponent(searchTerm)}`;
      console.log('📡 Calling:', fullUrl);

      const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Search failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        alert(`Search failed: ${errorData.error || response.statusText}`);
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      console.log('📦 Product search API response:', data);

      if (!data.success) {
        console.error('❌ API returned error:', data);
        alert(`Search failed: ${data.error || 'Unknown error'}`);
        setResults([]);
        return;
      }

      if (!data.results || data.results.length === 0) {
        console.warn('⚠️ No products found for:', searchTerm);
        setResults([]);
        return;
      }

      // Transform results to match Product interface
      const transformedResults = data.results.map((result: any) => {
        console.log('🔄 Transforming result:', result);

        return {
          id: result.style,
          style_number: result.style,
          product_name: result.description,
          base_price: result.colors[0]?.pricing?.wholesale || 0,
          supplier: result.supplier,
          supplier_product_id: result.colors[0]?.partIds?.[0] || result.colors[0]?.code,
          image_url: result.colors[0]?.image_url,
          colors: result.colors.map((color: any) => ({
            color_name: color.name,
            color_code: color.partIds?.[0] || color.code,
            sizes: (color.sizes || []).map((size: string) => ({
              size,
              price: color.pricing?.wholesale || 0,
              in_stock: true,
            })),
          })),
          sizes: result.colors[0]?.sizes || [],
        };
      });

      console.log('✅ Transformed results:', transformedResults);
      setResults(transformedResults);
    } catch (error: any) {
      console.error('❌ Error searching products:', error);
      alert(`Search error: ${error.message || 'Unknown error'}`);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedColor('');
    setSelectedSizes({});
  };

  const handleToggleSize = (size: string, price: number) => {
    setSelectedSizes((prev) => {
      if (prev[size]) {
        const { [size]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [size]: 1 };
    });
  };

  const handleQuantityChange = (size: string, quantity: number) => {
    if (quantity <= 0) {
      const { [size]: _, ...rest } = selectedSizes;
      setSelectedSizes(rest);
    } else {
      setSelectedSizes((prev) => ({ ...prev, [size]: quantity }));
    }
  };

  const handleAddToOrder = () => {
    console.log('🔔 Add to Order button clicked!');
    console.log('📦 Selected Product:', selectedProduct);
    console.log('🎨 Selected Color:', selectedColor);
    console.log('📏 Selected Sizes:', selectedSizes);

    if (!selectedProduct || !selectedColor || Object.keys(selectedSizes).length === 0) {
      console.error('❌ Validation failed - missing required fields');
      alert('Please select a product, color, and at least one size');
      return;
    }

    const selectedColorData = selectedProduct.colors.find((c) => c.color_name === selectedColor);
    if (!selectedColorData) {
      console.error('❌ Color data not found');
      return;
    }

    // Create line items for each size
    const items = Object.entries(selectedSizes).map(([size, quantity]) => {
      const sizeInfo = selectedColorData.sizes.find((s) => s.size === size);
      const unitCost = sizeInfo?.price || selectedProduct.base_price;

      return {
        sku: `${selectedProduct.style_number}-${selectedColor}-${size}`,
        style_number: selectedProduct.style_number,
        product_name: selectedProduct.product_name,
        color: selectedColor,
        size,
        quantity_ordered: quantity,
        unit_cost: unitCost,
        extended_cost: unitCost * quantity,
        vendor_product_id: selectedProduct.supplier_product_id,
        supplier: selectedProduct.supplier,
      };
    });

    console.log('✅ Items prepared for PO:', items);
    console.log('🚀 Calling onSelect callback...');

    onSelect(items);
    onClose();

    console.log('✅ Modal closed, items should be added to PO');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Search Products</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Search the {vendorType} catalog
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                console.log('📝 Input changed:', e.target.value);
                setSearchTerm(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchTerm.length >= 3) {
                  console.log('⏎ Enter pressed, triggering search');
                  searchProducts();
                }
              }}
              placeholder="Search by style number, product name, or keyword..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-600" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedProduct ? (
            // Product List
            <div className="space-y-3">
              {results.length === 0 && searchTerm.length >= 3 && !searching && (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No products found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Try a different search term
                  </p>
                </div>
              )}

              {results.length === 0 && searchTerm.length < 3 && !searching && (
                <div className="text-center py-12">
                  <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Enter at least 3 characters to search</p>
                </div>
              )}

              {results.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className="w-full flex items-center gap-4 p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all text-left"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.product_name}
                      className="w-20 h-20 object-cover rounded-lg bg-gray-100 dark:bg-slate-700"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {product.style_number}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                      {product.product_name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      {product.colors.length} colors · {product.sizes.length} sizes
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      ${product.base_price.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">Base Price</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Product Detail & Size Selection
            <div className="space-y-6">
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← Back to results
              </button>

              <div className="flex gap-6">
                {selectedProduct.image_url ? (
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.product_name}
                    className="w-32 h-32 object-cover rounded-lg bg-gray-100 dark:bg-slate-700"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-400 dark:text-gray-600" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedProduct.style_number}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {selectedProduct.product_name}
                  </p>
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-2">
                    ${selectedProduct.base_price.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Color *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {selectedProduct.colors.map((color) => (
                    <button
                      key={color.color_name}
                      onClick={() => setSelectedColor(color.color_name)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        selectedColor === color.color_name
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {color.color_name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Selection */}
              {selectedColor && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Sizes & Quantities *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selectedProduct.colors
                      .find((c) => c.color_name === selectedColor)
                      ?.sizes.map((sizeInfo) => (
                        <div
                          key={sizeInfo.size}
                          className={`border-2 rounded-lg p-3 transition-all ${
                            selectedSizes[sizeInfo.size]
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-300 dark:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {sizeInfo.size}
                            </span>
                            <input
                              type="checkbox"
                              checked={!!selectedSizes[sizeInfo.size]}
                              onChange={() => handleToggleSize(sizeInfo.size, sizeInfo.price)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            ${sizeInfo.price.toFixed(2)}
                          </p>
                          {selectedSizes[sizeInfo.size] && (
                            <input
                              type="number"
                              min="1"
                              value={selectedSizes[sizeInfo.size]}
                              onChange={(e) =>
                                handleQuantityChange(sizeInfo.size, parseInt(e.target.value) || 0)
                              }
                              className="w-full mt-2 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                              placeholder="Qty"
                            />
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedProduct && (
          <div className="p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {Object.keys(selectedSizes).length} sizes selected ·{' '}
                  {Object.values(selectedSizes).reduce((sum, qty) => sum + qty, 0)} total units
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                  Total: $
                  {Object.entries(selectedSizes)
                    .reduce((sum, [size, qty]) => {
                      const colorData = selectedProduct.colors.find(
                        (c) => c.color_name === selectedColor
                      );
                      const sizeInfo = colorData?.sizes.find((s) => s.size === size);
                      return sum + (sizeInfo?.price || 0) * qty;
                    }, 0)
                    .toFixed(2)}
                </p>
              </div>
              <button
                onClick={handleAddToOrder}
                disabled={!selectedColor || Object.keys(selectedSizes).length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Order
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
