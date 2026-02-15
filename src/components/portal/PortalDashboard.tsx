import { useState, useEffect } from 'react';
import { FileText, DollarSign, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { supabase } from '../../lib/supabase-client';

interface DashboardStats {
  outstanding_invoices: number;
  total_outstanding: number;
  pending_quotes: number;
  pending_proofs: number;
}

export function PortalDashboard() {
  const { user } = useCustomerPortal();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);

  useEffect(() => {
    if (user?.customer_id) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.customer_id) return;

    try {
      setLoading(true);

      const [invoicesResult, quotesResult, proofsResult] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_number, total_amount, balance_due, status, created_at')
          .eq('customer_id', user.customer_id)
          .neq('status_stage', 'paid')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('quotes')
          .select('id, quote_number, total_amount, status, created_at')
          .eq('customer_id', user.customer_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('proofs')
          .select('id')
          .eq('customer_id', user.customer_id)
          .eq('status', 'pending')
      ]);

      const invoices = invoicesResult.data || [];
      const quotes = quotesResult.data || [];
      const proofs = proofsResult.data || [];

      const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0);

      setStats({
        outstanding_invoices: invoices.length,
        total_outstanding: totalOutstanding,
        pending_quotes: quotes.length,
        pending_proofs: proofs.length,
      });

      setRecentInvoices(invoices);
      setRecentQuotes(quotes);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back, {user?.name}</h1>
        <p className="text-gray-600">Here's an overview of your account</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{stats?.outstanding_invoices || 0}</p>
          <p className="text-sm text-gray-600">Outstanding Invoices</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">
            ${(stats?.total_outstanding || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-600">Total Outstanding</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{stats?.pending_quotes || 0}</p>
          <p className="text-sm text-gray-600">Pending Quotes</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 mb-1">{stats?.pending_proofs || 0}</p>
          <p className="text-sm text-gray-600">Pending Proofs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Invoices</h2>
            <a
              href="/portal/invoices"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All
            </a>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No outstanding invoices</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <a
                  key={invoice.id}
                  href={`/portal/invoices`}
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                    <p className="text-sm font-medium text-gray-900">
                      ${(invoice.balance_due || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </p>
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                      {invoice.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Quotes</h2>
            <a
              href="/portal/quotes"
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All
            </a>
          </div>
          {recentQuotes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No pending quotes</p>
          ) : (
            <div className="space-y-3">
              {recentQuotes.map((quote) => (
                <a
                  key={quote.id}
                  href={`/portal/quotes`}
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900">{quote.quote_number}</p>
                    <p className="text-sm font-medium text-gray-900">
                      ${(quote.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </p>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {quote.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Quick Actions</h3>
            <p className="text-sm text-blue-800 mb-3">
              Manage your account and stay on top of your orders
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/portal/invoices"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Pay Invoices
              </a>
              <a
                href="/portal/quotes"
                className="px-4 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm"
              >
                Review Quotes
              </a>
              <a
                href="/portal/payment-methods"
                className="px-4 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm"
              >
                Manage Payment Methods
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
