import { useState, useEffect, lazy, Suspense } from 'react';
import { RefreshCw, AlertCircle, TrendingUp, Menu, X, LogOut, Loader2, Settings, CreditCard, Package, ChevronDown, ChevronUp, Send, Mail, Wallet, Users } from 'lucide-react';
import { AccountSettings } from './components/AccountSettings';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EnhancedAuthScreen } from './components/EnhancedAuthScreen';
import { supabase } from './lib/supabase-client';
import { billingService } from './services/billing-service';
import { useRBAC } from './hooks/useRBAC';

const SquareData = lazy(() => import('./components/SquareData'));
const ProductionManagement = lazy(() => import('./components/ProductionManagement').then(m => ({ default: m.ProductionManagement })));
const BillingDashboard = lazy(() => import('./components/billing/BillingDashboard').then(m => ({ default: m.BillingDashboard })));
const AccountsReceivableReport = lazy(() => import('./components/accounting/AccountsReceivableReport'));
const CustomersReport = lazy(() => import('./components/accounting/CustomersReport'));
const PaymentsReport = lazy(() => import('./components/accounting/PaymentsReport'));

type Tab =
  | 'square' | 'production' | 'settings'
  | 'accounting-dashboard'
  | 'accounts-receivable'
  | 'customers'
  | 'payments';

interface CompanySettings {
  company_name: string;
  logo_url: string | null;
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('accounting-dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountingExpanded, setAccountingExpanded] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const { signOut, user } = useAuth();
  const { userProfile, canAccessIntegrations } = useRBAC();

  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

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
          setCompanySettings({
            company_name: data.company_name,
            logo_url: data.logo_url,
          });
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
          if (data) {
            setCompanySettings({
              company_name: data.company_name,
              logo_url: data.logo_url,
            });
          }
        } catch (err) {
          console.error('Error reloading company settings:', err);
        }
      };
      loadCompanySettings();
    }
  }, [activeTab]);

  const accountingNavItems = [
    {
      id: 'accounting-dashboard' as Tab,
      name: 'Dashboard',
      icon: Wallet,
      description: 'Manage invoices and payments'
    },
    {
      id: 'accounts-receivable' as Tab,
      name: 'Accounts Receivable',
      icon: TrendingUp,
      description: 'Aging and outstanding invoices'
    },
    {
      id: 'customers' as Tab,
      name: 'Customers',
      icon: Users,
      description: 'Customer billing summary'
    },
    {
      id: 'payments' as Tab,
      name: 'Payments',
      icon: CreditCard,
      description: 'Payment history and tracking'
    },
  ];

  const squareNavItems = [
    {
      id: 'square' as Tab,
      name: 'Square Dashboard',
      icon: CreditCard,
      description: 'Square transactions & reports'
    },
  ];

  const productionNavItems = [
    {
      id: 'production' as Tab,
      name: 'Production Management',
      icon: Package,
      description: 'Workflow & production tracking'
    },
  ];

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await billingService.syncBillingQueue([]);
      alert('Sync completed successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to sync from Printavo');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-xl transition-all duration-300 z-30 w-56
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        lg:w-auto ${sidebarOpen ? 'lg:w-56' : 'lg:w-20'}
      `}>
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
        <nav className="p-4 space-y-2 overflow-y-auto pb-32" style={{ height: 'calc(100vh - 220px)' }}>

          {/* 1. ACCOUNTING - Collapsible section (NEW - AT TOP) */}
          <div>
            {/* Accounting Header - Collapsible trigger */}
            <button
              onClick={() => setAccountingExpanded(!accountingExpanded)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group text-gray-900 hover:bg-gray-50"
              title={!sidebarOpen ? 'ACCOUNTING' : ''}
              aria-label="Accounting"
              aria-expanded={accountingExpanded}
              aria-controls="accounting-submenu"
            >
              <Wallet className="w-5 h-5 flex-shrink-0 text-gray-600 group-hover:text-gray-900" />
              {sidebarOpen && (
                <>
                  <div className="flex-1 text-left">
                    <div className="font-bold text-sm uppercase tracking-wide text-gray-900">
                      Accounting
                    </div>
                  </div>
                  {accountingExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 transition-transform duration-200" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-gray-500 transition-transform duration-200 rotate-180" />
                  )}
                </>
              )}
              {!sidebarOpen && (
                accountingExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-gray-500 absolute right-2 rotate-180" />
                )
              )}
            </button>

            {/* Accounting Sub-items - Collapsible content with animation */}
            {accountingExpanded && (
              <div
                id="accounting-submenu"
                className="mt-1 space-y-1 ml-2 collapsible-section collapsible-section-enter"
                role="group"
                aria-label="Accounting submenu"
              >
                {accountingNavItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        closeSidebarOnMobile();
                      }}
                      className={`collapsible-item w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                        isActive
                          ? 'bg-green-50 text-green-700 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      title={!sidebarOpen ? item.name : ''}
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                      {sidebarOpen && (
                        <div className="flex-1 text-left">
                          <div className={`font-medium text-sm ${isActive ? 'text-green-700' : 'text-gray-700'}`}>
                            {item.name}
                          </div>
                        </div>
                      )}
                      {isActive && <div className="w-1 h-6 bg-green-600 rounded-full absolute right-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200 my-3" />

          {/* 2. PRODUCTION DASHBOARD - Top-level link */}
          <div className="space-y-1">
            {productionNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    closeSidebarOnMobile();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-orange-50 text-orange-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={!sidebarOpen ? 'PRODUCTION DASHBOARD' : ''}
                  aria-label="Production Dashboard"
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-orange-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  {sidebarOpen && (
                    <div className="flex-1 text-left">
                      <div className={`font-bold text-xs uppercase tracking-wide leading-tight ${isActive ? 'text-orange-700' : 'text-gray-900'}`}>
                        Production<br />Dashboard
                      </div>
                    </div>
                  )}
                  {isActive && <div className="w-1 h-8 bg-orange-600 rounded-full absolute right-0" />}
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200 my-3" />

          {/* 3. SQUARE DASHBOARD - Top-level link */}
          <div className="space-y-1">
            {squareNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    closeSidebarOnMobile();
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-green-50 text-green-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={!sidebarOpen ? 'SQUARE DASHBOARD' : ''}
                  aria-label="Square Dashboard"
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  {sidebarOpen && (
                    <div className="flex-1 text-left">
                      <div className={`font-bold text-xs uppercase tracking-wide leading-tight ${isActive ? 'text-green-700' : 'text-gray-900'}`}>
                        Square<br />Dashboard
                      </div>
                    </div>
                  )}
                  {isActive && <div className="w-1 h-8 bg-green-600 rounded-full absolute right-0" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User & Controls */}
        <div className="absolute bottom-4 left-0 right-0 px-4 space-y-2">
          {sidebarOpen && user && (
            <div className="px-4 py-3 bg-gray-50 rounded-lg mb-2">
              <p className="text-xs text-gray-500">Signed in as</p>
              <p className="text-sm font-medium text-gray-900 truncate">{user.email}</p>
              <button
                onClick={() => {
                  setActiveTab('settings');
                  closeSidebarOnMobile();
                }}
                className="mt-2 w-full flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Settings className="w-3 h-3" />
                Account Settings
              </button>
            </div>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            title={!sidebarOpen ? 'Sync from Printavo' : ''}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {sidebarOpen && <span className="text-sm font-medium">{syncing ? 'Syncing...' : 'Sync from Printavo'}</span>}
          </button>
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
      <div className={`transition-all duration-300 lg:ml-20 ${sidebarOpen ? 'lg:ml-56' : 'lg:ml-20'}`}>
        {/* Top Bar */}
        <header className="h-20 bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <div className="h-full px-4 flex items-center justify-between gap-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
                {activeTab === 'accounting-dashboard' ? 'ACCOUNTING' :
                 activeTab === 'accounts-receivable' ? 'Accounts Receivable' :
                 activeTab === 'customers' ? 'Customers' :
                 activeTab === 'payments' ? 'Payments' :
                 [...accountingNavItems, ...squareNavItems, ...productionNavItems].find(item => item.id === activeTab)?.name ||
                 (activeTab === 'settings' ? 'Account Settings' : 'Dashboard')}
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5 truncate">
                {activeTab === 'accounting-dashboard' ? (
                  'Manage invoices, send payments, and track billing'
                ) : activeTab === 'accounts-receivable' ? (
                  'Aging reports and outstanding invoices'
                ) : activeTab === 'customers' ? (
                  'Customer billing summary and payment history'
                ) : activeTab === 'payments' ? (
                  'Payment history and Stripe transaction records'
                ) : activeTab === 'square' ? (
                  'Square payment data and reports'
                ) : activeTab === 'production' ? (
                  'Manage quotes, proofs, invoicing, and production workflow'
                ) : activeTab === 'settings' ? (
                  'Configure your integrations and preferences'
                ) : (
                  'Financial management dashboard'
                )}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-4">
              {activeTab === 'square' && (
                <div className="text-xs lg:text-sm text-gray-600 flex items-center gap-2 bg-green-50 px-3 lg:px-4 py-2 rounded-lg border border-green-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                  <span className="hidden xl:inline">Square data is fetched in real-time. Use "Fetch Data" buttons in each module.</span>
                  <span className="xl:hidden">Real-time Square data</span>
                </div>
              )}
              {activeTab === 'production' && (
                <div className="text-xs lg:text-sm text-gray-600 flex items-center gap-2 bg-orange-50 px-3 lg:px-4 py-2 rounded-lg border border-orange-200">
                  <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
                  <span className="hidden xl:inline">Production workflows use placeholder data. Connect your systems in Settings.</span>
                  <span className="xl:hidden">Placeholder data</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="py-4 px-3 sm:py-6 sm:px-4">
          {activeTab === 'accounting-dashboard' && (
            <Suspense fallback={
              <div className="bg-white rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Accounting Dashboard</h3>
                  <p className="text-gray-600">Initializing accounting module...</p>
                </div>
              </div>
            }>
              <BillingDashboard />
            </Suspense>
          )}

          {activeTab === 'accounts-receivable' && (
            <Suspense fallback={
              <div className="bg-white rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Accounts Receivable</h3>
                  <p className="text-gray-600">Loading aging reports...</p>
                </div>
              </div>
            }>
              <AccountsReceivableReport onNavigateToSettings={(tab) => {
                setSettingsInitialTab(tab);
                setActiveTab('settings');
              }} />
            </Suspense>
          )}

          {activeTab === 'customers' && (
            <Suspense fallback={
              <div className="bg-white rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Customers Report</h3>
                  <p className="text-gray-600">Loading customer data...</p>
                </div>
              </div>
            }>
              <CustomersReport />
            </Suspense>
          )}

          {activeTab === 'payments' && (
            <Suspense fallback={
              <div className="bg-white rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Payments Report</h3>
                  <p className="text-gray-600">Loading payment history...</p>
                </div>
              </div>
            }>
              <PaymentsReport />
            </Suspense>
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

          {activeTab === 'production' && (
            <Suspense fallback={
              <div className="bg-white rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-orange-600 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Production Management</h3>
                  <p className="text-gray-600">Initializing production module...</p>
                </div>
              </div>
            }>
              <ProductionManagement />
            </Suspense>
          )}

          {activeTab === 'settings' && (
            <AccountSettings
              initialTab={settingsInitialTab as any}
              canAccessIntegrations={canAccessIntegrations}
            />
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
