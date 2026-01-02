import { useState, useEffect, lazy, Suspense } from 'react';
import { FileText, Users, RefreshCw, AlertCircle, DollarSign, TrendingUp, Download, Building2, Menu, X, LogOut, Loader2, BarChart3, Settings, LineChart, CreditCard } from 'lucide-react';
import { useSupabaseData } from './hooks/useSupabaseData';
import { InvoiceExplorer } from './components/InvoiceExplorer';
import { CustomerProfiles } from './components/CustomerProfiles';
import { OpenInvoices } from './components/OpenInvoices';
import { AccountsReceivable } from './components/AccountsReceivable';
import { ARByCustomer } from './components/ARByCustomer';
import { ReportsTab } from './components/ReportsTab';
import { AccountSettings } from './components/AccountSettings';
import { Analytics } from './components/Analytics';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EnhancedAuthScreen } from './components/EnhancedAuthScreen';
import { supabase } from './lib/supabase-client';

const SquareData = lazy(() => import('./components/SquareData'));

type Tab = 'ar' | 'ar-by-customer' | 'open-invoices' | 'reports' | 'analytics' | 'invoices' | 'customers' | 'square' | 'settings';

interface CompanySettings {
  company_name: string;
  logo_url: string | null;
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('ar');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const { invoices, payments, lineItems, loading, error, syncing, lastSyncTime, triggerSync } = useSupabaseData();
  const { signOut, user } = useAuth();

  useEffect(() => {
    const loadCompanySettings = async () => {
      try {
        const { data, error } = await supabase
          .from('company_settings')
          .select('company_name, logo_url')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading company settings:', error);
          return;
        }

        if (data) {
          setCompanySettings(data);
        }
      } catch (err) {
        console.error('Error loading company settings:', err);
      }
    };

    loadCompanySettings();
  }, []);

  useEffect(() => {
    if (activeTab !== 'settings') {
      const loadCompanySettings = async () => {
        try {
          const { data, error } = await supabase
            .from('company_settings')
            .select('company_name, logo_url')
            .maybeSingle();

          if (error && error.code !== 'PGRST116') return;
          if (data) setCompanySettings(data);
        } catch (err) {
          console.error('Error reloading company settings:', err);
        }
      };
      loadCompanySettings();
    }
  }, [activeTab]);

  const printavoNavItems = [
    {
      id: 'ar' as Tab,
      name: 'Accounts Receivable',
      icon: DollarSign,
      description: 'Overview of receivables'
    },
    {
      id: 'ar-by-customer' as Tab,
      name: 'A/R by Customer',
      icon: Building2,
      description: 'Customer breakdown'
    },
    {
      id: 'open-invoices' as Tab,
      name: 'Open Invoices',
      icon: FileText,
      description: 'Unpaid invoices'
    },
    {
      id: 'reports' as Tab,
      name: 'Reports',
      icon: BarChart3,
      description: 'Financial reports hub'
    },
    {
      id: 'analytics' as Tab,
      name: 'Analytics',
      icon: LineChart,
      description: 'Advanced insights'
    },
    {
      id: 'invoices' as Tab,
      name: 'All Invoices',
      icon: FileText,
      description: 'Complete invoice list'
    },
    {
      id: 'customers' as Tab,
      name: 'Customers',
      icon: Users,
      description: 'Customer profiles'
    },
  ];

  const squareNavItems = [
    {
      id: 'square' as Tab,
      name: 'Square Data',
      icon: CreditCard,
      description: 'Square transactions & reports'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-xl transition-all duration-300 z-30 ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}>
        {/* Logo/Brand */}
        <div className="h-20 border-b border-gray-200 flex items-center justify-center px-4 bg-gradient-to-r from-blue-600 to-blue-700">
          {sidebarOpen ? (
            companySettings?.logo_url ? (
              <div className="flex items-center justify-center w-full h-full py-1.5">
                <img
                  src={companySettings.logo_url}
                  alt={companySettings.company_name || 'Company Logo'}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg">
                    {companySettings?.company_name || 'Printavo'}
                  </h1>
                  <p className="text-blue-100 text-xs">Financial Dashboard</p>
                </div>
              </div>
            )
          ) : (
            companySettings?.logo_url ? (
              <div className="flex items-center justify-center w-full h-full py-1.5">
                <img
                  src={companySettings.logo_url}
                  alt={companySettings.company_name || 'Company Logo'}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            )
          )}
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-4 overflow-y-auto" style={{ height: 'calc(100vh - 220px)' }}>
          {/* Printavo Section */}
          <div>
            {sidebarOpen && (
              <div className="px-2 mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Printavo Data</h3>
              </div>
            )}
            <div className="space-y-1">
              {printavoNavItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title={!sidebarOpen ? item.name : ''}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    {sidebarOpen && (
                      <div className="flex-1 text-left">
                        <div className={`font-medium text-sm ${isActive ? 'text-blue-700' : ''}`}>
                          {item.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    )}
                    {isActive && <div className="w-1 h-8 bg-blue-600 rounded-full absolute right-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Square Section */}
          <div>
            {sidebarOpen && (
              <div className="px-2 mb-2 pt-4 border-t border-gray-200">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Square Data</h3>
              </div>
            )}
            {!sidebarOpen && <div className="border-t border-gray-200 my-2" />}
            <div className="space-y-1">
              {squareNavItems.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                      isActive
                        ? 'bg-green-50 text-green-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title={!sidebarOpen ? item.name : ''}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    {sidebarOpen && (
                      <div className="flex-1 text-left">
                        <div className={`font-medium text-sm ${isActive ? 'text-green-700' : ''}`}>
                          {item.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {item.description}
                        </div>
                      </div>
                    )}
                    {isActive && <div className="w-1 h-8 bg-green-600 rounded-full absolute right-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* User & Controls */}
        <div className="absolute bottom-4 left-0 right-0 px-4 space-y-2">
          {sidebarOpen && user && (
            <div className="px-4 py-3 bg-gray-50 rounded-lg mb-2">
              <p className="text-xs text-gray-500">Signed in as</p>
              <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
              <button
                onClick={() => setActiveTab('settings')}
                className="mt-2 w-full flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Settings className="w-3 h-3" />
                Account Settings
              </button>
            </div>
          )}
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title={!sidebarOpen ? 'Sign Out' : ''}
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="text-sm font-medium">Sign Out</span>}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            {sidebarOpen ? (
              <>
                <X className="w-4 h-4" />
                <span className="text-sm font-medium">Collapse</span>
              </>
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Top Bar */}
        <header className="h-20 bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <div className="h-full px-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {[...printavoNavItems, ...squareNavItems].find(item => item.id === activeTab)?.name || 'Settings'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {activeTab === 'square' ? (
                  'Square payment data and reports'
                ) : activeTab === 'settings' ? (
                  'Configure your integrations and preferences'
                ) : (
                  `${invoices.length} invoices · ${payments.length} payments`
                )}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {activeTab !== 'square' && activeTab !== 'settings' && (
                <>
                  {lastSyncTime && (
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Last synced: {lastSyncTime.toLocaleTimeString()}
                    </div>
                  )}
                  <button
                    onClick={triggerSync}
                    disabled={syncing || loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Syncing...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Sync Data</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="py-6 px-4">
        {error ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900">Sync Issue Detected</h3>
                <p className="text-yellow-800 mt-1">{error.message}</p>
                {invoices.length === 0 ? (
                  <div className="mt-3 p-4 bg-yellow-100 rounded border border-yellow-300">
                    <p className="text-sm font-medium text-yellow-900 mb-2">Printavo API credentials need to be configured:</p>
                    <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
                      <li>Go to your Supabase Dashboard</li>
                      <li>Navigate to Edge Functions and click on "printavo-sync"</li>
                      <li>Add two secrets:
                        <ul className="ml-6 mt-1 space-y-1 list-disc list-inside">
                          <li><code className="bg-yellow-200 px-1 rounded">PRINTAVO_EMAIL</code>: your Printavo email</li>
                          <li><code className="bg-yellow-200 px-1 rounded">PRINTAVO_TOKEN</code>: your Printavo API token</li>
                        </ul>
                      </li>
                      <li>Click "Sync Data" above to import invoices and payments</li>
                    </ol>
                  </div>
                ) : (
                  <p className="text-sm text-yellow-700 mt-2 p-3 bg-yellow-100 rounded">
                    Showing cached data ({invoices.length} invoices, {payments.length} payments). The sync is failing - please check the Printavo API credentials in Supabase Edge Function secrets.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : loading || syncing ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {syncing ? 'Syncing Data from Printavo' : 'Loading Financial Data'}
              </h3>
              <p className="text-gray-600">
                {syncing ? 'Fetching latest data from Printavo API...' : 'Loading data from database...'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'ar' && (
              <AccountsReceivable invoices={invoices} />
            )}
            {activeTab === 'ar-by-customer' && (
              <ARByCustomer invoices={invoices} />
            )}
            {activeTab === 'open-invoices' && (
              <OpenInvoices invoices={invoices} />
            )}
            {activeTab === 'reports' && (
              <ReportsTab invoices={invoices} payments={payments} />
            )}
            {activeTab === 'analytics' && (
              <Analytics invoices={invoices} payments={payments} lineItems={lineItems} />
            )}
            {activeTab === 'invoices' && (
              <InvoiceExplorer invoices={invoices} />
            )}
            {activeTab === 'customers' && (
              <CustomerProfiles invoices={invoices} />
            )}
            {activeTab === 'square' && (
              <Suspense fallback={
                <div className="bg-white rounded-lg shadow p-8">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Square Data</h3>
                    <p className="text-gray-600">Initializing Square data module...</p>
                  </div>
                </div>
              }>
                <SquareData />
              </Suspense>
            )}
            {activeTab === 'settings' && (
              <AccountSettings />
            )}
          </>
        )}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <EnhancedAuthScreen />;
  }

  return <AppContent />;
}

export default App;
