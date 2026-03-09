import { useState, useEffect } from 'react';
import { supabaseAnon } from '../../lib/supabase-anon-client';
import { Package, Loader2, XCircle, Clock, CheckCircle, Truck, PlayCircle, AlertCircle, ChevronRight, X, Shirt, Calendar, Hash } from 'lucide-react';
import { format } from 'date-fns';

interface WorkOrder {
  id: string;
  work_order_number: string;
  status: string;
  total_quantity: number;
  created_at: string;
  customer_due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  garments_ready: boolean;
  ready_for_production: boolean;
  quote?: {
    quote_number: string;
    nickname: string | null;
  } | null;
}

interface WorkOrderLineItem {
  id: string;
  line_number: number;
  item_type: string;
  description: string | null;
  style_number: string | null;
  style_name: string | null;
  color: string | null;
  sizes: Record<string, number> | null;
  quantity: number;
  supplier_name: string | null;
  garment_images: { front?: string; back?: string } | null;
  is_completed: boolean;
}

interface WorkOrderDetail extends WorkOrder {
  line_items: WorkOrderLineItem[];
  imprints: Array<{
    id: string;
    location_name: string;
    type_of_work: string;
    artwork_url: string | null;
  }>;
}

interface PortalOrdersTabProps {
  customerId: string;
  companyId: string;
}

export function PortalOrdersTab({ customerId, companyId }: PortalOrdersTabProps) {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [customerId, companyId]);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabaseAnon
        .from('work_orders')
        .select(`
          id,
          work_order_number,
          status,
          total_quantity,
          created_at,
          customer_due_date,
          started_at,
          completed_at,
          garments_ready,
          ready_for_production,
          quote_id
        `)
        .eq('customer_id', customerId)
        .eq('company_id', companyId)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const ordersWithQuotes = await Promise.all(
        (data || []).map(async (order) => {
          if (order.quote_id) {
            const { data: quoteData } = await supabaseAnon
              .from('quotes')
              .select('quote_number, nickname')
              .eq('id', order.quote_id)
              .maybeSingle();
            return { ...order, quote: quoteData };
          }
          return { ...order, quote: null };
        })
      );

      setOrders(ordersWithQuotes);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOrderDetail = async (orderId: string) => {
    setLoadingDetail(true);

    try {
      const { data: order, error: orderError } = await supabaseAnon
        .from('work_orders')
        .select(`
          id,
          work_order_number,
          status,
          total_quantity,
          created_at,
          customer_due_date,
          started_at,
          completed_at,
          garments_ready,
          ready_for_production,
          quote_id
        `)
        .eq('id', orderId)
        .eq('customer_id', customerId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) throw new Error('Order not found');

      let quote = null;
      if (order.quote_id) {
        const { data: quoteData } = await supabaseAnon
          .from('quotes')
          .select('quote_number, nickname')
          .eq('id', order.quote_id)
          .maybeSingle();
        quote = quoteData;
      }

      const { data: lineItems, error: lineError } = await supabaseAnon
        .from('work_order_line_items')
        .select(`
          id,
          line_number,
          item_type,
          description,
          style_number,
          style_name,
          color,
          sizes,
          quantity,
          supplier_name,
          garment_images,
          is_completed
        `)
        .eq('work_order_id', orderId)
        .eq('company_id', companyId)
        .order('line_number');

      if (lineError) throw lineError;

      let imprints: Array<{ id: string; location_name: string; type_of_work: string; artwork_url: string | null }> = [];
      if (order.quote_id) {
        const { data: imprintData } = await supabaseAnon
          .from('quote_imprints')
          .select(`
            id,
            type_of_work,
            artwork_url,
            decoration_location_id
          `)
          .eq('quote_id', order.quote_id)
          .eq('company_id', companyId);

        if (imprintData) {
          const locationIds = imprintData.map(i => i.decoration_location_id).filter(Boolean);
          let locationMap: Record<string, string> = {};

          if (locationIds.length > 0) {
            const { data: locations } = await supabaseAnon
              .from('decoration_locations')
              .select('id, name')
              .in('id', locationIds);

            if (locations) {
              locationMap = locations.reduce((acc, loc) => {
                acc[loc.id] = loc.name;
                return acc;
              }, {} as Record<string, string>);
            }
          }

          imprints = imprintData.map(i => ({
            id: i.id,
            location_name: i.decoration_location_id ? locationMap[i.decoration_location_id] || 'Unknown' : 'Not specified',
            type_of_work: i.type_of_work || 'Unknown',
            artwork_url: i.artwork_url,
          }));
        }
      }

      setSelectedOrder({
        ...order,
        quote,
        line_items: lineItems || [],
        imprints,
      });
    } catch (err) {
      console.error('Error loading order detail:', err);
      setError('Failed to load order details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const getStatusBadge = (order: WorkOrder) => {
    const status = order.status?.toLowerCase();

    if (status === 'completed' || order.completed_at) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" />
          Completed
        </span>
      );
    }

    if (status === 'shipped' || status === 'delivered') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
          <Truck className="w-3 h-3" />
          {status === 'shipped' ? 'Shipped' : 'Delivered'}
        </span>
      );
    }

    if (status === 'in_production' || status === 'in production' || order.started_at) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
          <PlayCircle className="w-3 h-3" />
          In Production
        </span>
      );
    }

    if (order.ready_for_production) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
          <AlertCircle className="w-3 h-3" />
          Ready for Production
        </span>
      );
    }

    if (order.garments_ready) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-cyan-100 text-cyan-800">
          <Shirt className="w-3 h-3" />
          Garments Ready
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  };

  const getStatusTimeline = (order: WorkOrderDetail) => {
    const steps = [
      { label: 'Order Created', date: order.created_at, completed: true },
      { label: 'Garments Ready', date: order.garments_ready ? order.created_at : null, completed: order.garments_ready },
      { label: 'Ready for Production', date: order.ready_for_production ? order.created_at : null, completed: order.ready_for_production },
      { label: 'In Production', date: order.started_at, completed: !!order.started_at },
      { label: 'Completed', date: order.completed_at, completed: !!order.completed_at },
    ];

    return steps;
  };

  const formatSizes = (sizes: Record<string, number> | null) => {
    if (!sizes) return 'N/A';
    const sizeEntries = Object.entries(sizes).filter(([_, qty]) => qty > 0);
    if (sizeEntries.length === 0) return 'N/A';
    return sizeEntries.map(([size, qty]) => `${size}: ${qty}`).join(', ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error && !selectedOrder) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Order History</h2>
          <p className="text-sm text-gray-600 mt-1">View the status of your orders</p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
            <p className="text-gray-600">Your orders will appear here once they are created.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {orders.map((order) => (
              <div
                key={order.id}
                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => loadOrderDetail(order.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {order.work_order_number}
                      </h3>
                      {getStatusBadge(order)}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                      {order.quote && (
                        <span className="flex items-center gap-1">
                          <Hash className="w-4 h-4" />
                          Quote: {order.quote.quote_number}
                          {order.quote.nickname && ` - ${order.quote.nickname}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Created: {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </span>
                      {order.customer_due_date && (
                        <span className="flex items-center gap-1">
                          <Truck className="w-4 h-4" />
                          Due: {format(new Date(order.customer_due_date), 'MMM d, yyyy')}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        {order.total_quantity} items
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(selectedOrder || loadingDetail) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {loadingDetail ? 'Loading...' : `Order ${selectedOrder?.work_order_number}`}
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : selectedOrder && (
              <div className="overflow-y-auto flex-1 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">{selectedOrder.work_order_number}</h3>
                  {getStatusBadge(selectedOrder)}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                  {selectedOrder.quote && (
                    <div>
                      <p className="text-sm text-gray-500">Quote</p>
                      <p className="font-medium text-gray-900">
                        {selectedOrder.quote.quote_number}
                        {selectedOrder.quote.nickname && ` - ${selectedOrder.quote.nickname}`}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date(selectedOrder.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  {selectedOrder.customer_due_date && (
                    <div>
                      <p className="text-sm text-gray-500">Due Date</p>
                      <p className="font-medium text-gray-900">
                        {format(new Date(selectedOrder.customer_due_date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Total Items</p>
                    <p className="font-medium text-gray-900">{selectedOrder.total_quantity}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Order Progress</h4>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                    <div className="space-y-4">
                      {getStatusTimeline(selectedOrder).map((step, index) => (
                        <div key={index} className="relative flex items-start gap-3 pl-10">
                          <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                            step.completed
                              ? 'bg-green-500 border-green-500'
                              : 'bg-white border-gray-300'
                          }`} />
                          <div>
                            <p className={`text-sm font-medium ${step.completed ? 'text-gray-900' : 'text-gray-400'}`}>
                              {step.label}
                            </p>
                            {step.date && step.completed && (
                              <p className="text-xs text-gray-500">
                                {format(new Date(step.date), 'MMM d, yyyy h:mm a')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedOrder.line_items.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Line Items</h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-600">Item</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600">Color</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-600">Sizes</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-600">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {selectedOrder.line_items.filter(li => li.item_type === 'garment').map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {item.garment_images?.front && (
                                    <img
                                      src={item.garment_images.front}
                                      alt={item.style_name || 'Garment'}
                                      className="w-10 h-10 object-contain rounded border border-gray-200"
                                    />
                                  )}
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {item.style_number || 'N/A'}
                                    </p>
                                    <p className="text-gray-500 text-xs">
                                      {item.style_name || item.description || 'No description'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-600">{item.color || 'N/A'}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{formatSizes(item.sizes)}</td>
                              <td className="px-4 py-3 text-right font-medium text-gray-900">{item.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedOrder.imprints.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Imprint Summary</h4>
                    <div className="grid gap-3">
                      {selectedOrder.imprints.map((imprint) => (
                        <div key={imprint.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                          {imprint.artwork_url && (
                            <img
                              src={imprint.artwork_url}
                              alt="Artwork"
                              className="w-12 h-12 object-contain rounded border border-gray-200 bg-white"
                            />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{imprint.location_name}</p>
                            <p className="text-sm text-gray-600">{imprint.type_of_work}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
