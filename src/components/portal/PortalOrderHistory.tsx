import { useState, useEffect } from 'react';
import { PortalLayout } from './PortalLayout';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { supabase } from '../../lib/supabase-client';
import { Package, Download, Eye, Loader2, FileText } from 'lucide-react';

interface Order {
  id: string;
  type: 'invoice' | 'quote';
  number: string;
  date: string;
  amount: number;
  status: string;
  items_count?: number;
}

export function PortalOrderHistory() {
  const { user } = useCustomerPortal();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'invoice' | 'quote'>('all');

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    try {
      setLoading(true);

      const invoicesPromise = supabase
        .from('printavo_invoices')
        .select('id, invoice_number, invoice_date, total, status_stage')
        .eq('company_id', user!.company_id)
        .eq('customer_email', user!.email);

      const quotesPromise = supabase
        .from('quotes')
        .select('id, quote_number, created_date, total_amount, status')
        .eq('company_id', user!.company_id)
        .eq('customer_email', user!.email);

      const [invoicesResult, quotesResult] = await Promise.all([invoicesPromise, quotesPromise]);

      const invoiceOrders: Order[] = (invoicesResult.data || []).map(inv => ({
        id: inv.id,
        type: 'invoice' as const,
        number: inv.invoice_number,
        date: inv.invoice_date,
        amount: inv.total,
        status: inv.status_stage,
      }));

      const quoteOrders: Order[] = (quotesResult.data || []).map(quote => ({
        id: quote.id,
        type: 'quote' as const,
        number: quote.quote_number,
        date: quote.created_date,
        amount: quote.total_amount,
        status: quote.status,
      }));

      const allOrders = [...invoiceOrders, ...quoteOrders].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setOrders(allOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('paid') || statusLower.includes('approved') || statusLower.includes('completed')) {
      return 'bg-green-100 text-green-800';
    }
    if (statusLower.includes('overdue') || statusLower.includes('declined') || statusLower.includes('cancelled')) {
      return 'bg-red-100 text-red-800';
    }
    if (statusLower.includes('pending') || statusLower.includes('sent')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getTypeIcon = (type: string) => {
    return type === 'invoice' ? (
      <FileText className="w-5 h-5 text-blue-600" />
    ) : (
      <FileText className="w-5 h-5 text-green-600" />
    );
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.type === filter;
  });

  const handleView = (order: Order) => {
    if (order.type === 'invoice') {
      window.location.href = `/portal/invoices`;
    } else {
      window.location.href = `/portal/quotes`;
    }
  };

  if (loading) {
    return (
      <PortalLayout activeTab="orders">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout activeTab="orders">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Order History</h1>

          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('invoice')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === 'invoice'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => setFilter('quote')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === 'quote'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Quotes
            </button>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-600">
              {filter === 'all'
                ? "You don't have any orders yet."
                : `You don't have any ${filter}s yet.`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <div key={`${order.type}-${order.id}`} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1">{getTypeIcon(order.type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-base font-semibold text-gray-900">
                            {order.type === 'invoice' ? 'Invoice' : 'Quote'} {order.number}
                          </h3>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-600">
                          <span>{new Date(order.date).toLocaleDateString()}</span>
                          <span className="font-medium text-gray-900">
                            ${order.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleView(order)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
