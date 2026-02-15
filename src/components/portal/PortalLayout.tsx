import { ReactNode } from 'react';
import { useCustomerPortal } from '../../contexts/CustomerPortalContext';
import { FileText, Package, CheckCircle, Clock, LogOut, CreditCard, LayoutDashboard } from 'lucide-react';

interface PortalLayoutProps {
  children: ReactNode;
  activeTab?: 'dashboard' | 'invoices' | 'quotes' | 'proofs' | 'orders' | 'payment-methods';
}

export function PortalLayout({ children, activeTab }: PortalLayoutProps) {
  const { user, branding, logout } = useCustomerPortal();

  if (!user || !branding) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              {(branding.company_logo_primary_url || branding.logo_url) && (
                <img
                  src={branding.company_logo_primary_url || branding.logo_url || ''}
                  alt={branding.company_name}
                  className="h-10 w-auto object-contain"
                />
              )}
              {!branding.company_logo_primary_url && !branding.logo_url && (
                <h1 className="text-xl font-bold text-gray-900">{branding.company_name}</h1>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            <a
              href="/portal/dashboard"
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </a>
            <a
              href="/portal/invoices"
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'invoices'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              Invoices
            </a>
            <a
              href="/portal/quotes"
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'quotes'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              Quotes
            </a>
            <a
              href="/portal/proofs"
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'proofs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Proofs
            </a>
            <a
              href="/portal/orders"
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Package className="w-4 h-4" />
              Order History
            </a>
            <a
              href="/portal/payment-methods"
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                activeTab === 'payment-methods'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Payment Methods
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              {branding.company_address && <p>{branding.company_address}</p>}
              <div className="flex gap-4 mt-1">
                {branding.company_phone && <span>{branding.company_phone}</span>}
                {branding.company_email && <span>{branding.company_email}</span>}
              </div>
            </div>
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} {branding.company_name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
