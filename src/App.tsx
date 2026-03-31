import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { RefreshCw, AlertCircle, TrendingUp, Menu, X, LogOut, Loader2, Settings, CreditCard, Package, ChevronDown, ChevronUp, Send, Mail, Wallet, Users, CheckCircle, Sun, Moon, UserPlus, ShoppingBag } from 'lucide-react';
import { AccountSettings } from './components/AccountSettings';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ConfirmationProvider } from './contexts/ConfirmationContext';
import { EnhancedAuthScreen } from './components/EnhancedAuthScreen';
import { LandingPage } from './components/LandingPage';
import { FeaturesPage } from './components/FeaturesPage';
import { supabase } from './lib/supabase-client';
import { billingService } from './services/billing-service';
import { useRBAC } from './hooks/useRBAC';
import PublicQuoteApprovalPage from './components/production/PublicQuoteApprovalPage';
import { CustomerPortalProvider } from './contexts/CustomerPortalContext';
import { PortalLogin } from './components/portal/PortalLogin';
import { PortalInvoices } from './components/portal/PortalInvoices';
import { PortalQuotes } from './components/portal/PortalQuotes';
import { PortalProofs } from './components/portal/PortalProofs';
import { PortalOrderHistory } from './components/portal/PortalOrderHistory';
import { PortalDashboard } from './components/portal/PortalDashboard';
import { PortalPaymentMethods } from './components/portal/PortalPaymentMethods';
import { CustomerPortalPage } from './components/portal/CustomerPortalPage';
import { NotificationBell } from './components/NotificationBell';
import { hideInitialLoader } from './utils/loader';

function getSubdomainFromHost(): string | null {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[parts.length - 2] === 'inkops' && parts[parts.length - 1] === 'ink') {
    return parts.slice(0, -2).join('.');
  }
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    return parts.length > 1 ? parts[0] : null;
  }
  return null;
}

function DomainAwareCustomerPortal({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validatedCustomerId, setValidatedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const validateAccess = async () => {
      const subdomain = getSubdomainFromHost();

      if (!subdomain) {
        setValidatedCustomerId(customerId);
        setLoading(false);
        return;
      }

      try {
        const { supabaseAnon } = await import('./lib/supabase-anon-client');

        const { data: companyData, error: companyError } = await supabaseAnon
          .from('company_settings')
          .select('id, inkops_subdomain, customer_url')
          .eq('inkops_subdomain', subdomain)
          .maybeSingle();

        if (companyError) {
          console.error('Error looking up company by subdomain:', companyError);
          setError('Failed to verify domain');
          setLoading(false);
          return;
        }

        if (!companyData) {
          setError('Invalid domain');
          setLoading(false);
          return;
        }

        const { data: customerData, error: customerError } = await supabaseAnon
          .from('customers')
          .select('id, company_id')
          .eq('id', customerId)
          .maybeSingle();

        if (customerError) {
          console.error('Error looking up customer:', customerError);
          setError('Failed to verify customer');
          setLoading(false);
          return;
        }

        if (!customerData) {
          setError('Customer not found');
          setLoading(false);
          return;
        }

        if (customerData.company_id !== companyData.id) {
          setError('Access denied - customer does not belong to this company');
          setLoading(false);
          return;
        }

        setValidatedCustomerId(customerId);
        setLoading(false);
      } catch (err) {
        console.error('Error validating domain access:', err);
        setError('Failed to validate access');
        setLoading(false);
      }
    };

    validateAccess();
  }, [customerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error === 'Customer not found' ? 'Customer Not Found' : 'Access Denied'}
          </h1>
          <p className="text-gray-600">
            {error === 'Customer not found'
              ? 'The customer you are looking for does not exist or has been removed.'
              : error === 'Invalid domain'
              ? 'This domain is not configured for customer portal access.'
              : 'You do not have permission to access this customer portal.'}
          </p>
        </div>
      </div>
    );
  }

  if (validatedCustomerId) {
    return <CustomerPortalPage customerId={validatedCustomerId} />;
  }

  return null;
}

const SquareData = lazy(() => import('./components/SquareData'));
const ProductionManagement = lazy(() => import('./components/ProductionManagement').then(m => ({ default: m.ProductionManagement })));
const BillingDashboard = lazy(() => import('./components/billing/BillingDashboard').then(m => ({ default: m.BillingDashboard })));
const PaidInvoicesPage = lazy(() => import('./components/billing/PaidInvoicesPage').then(m => ({ default: m.PaidInvoicesPage })));
const AccountsReceivableReport = lazy(() => import('./components/accounting/AccountsReceivableReport'));
const CustomersReport = lazy(() => import('./components/accounting/CustomersReport'));
const PaymentsReport = lazy(() => import('./components/accounting/UnifiedPaymentsReport'));
import CreateCustomerModal from './components/accounting/CreateCustomerModal';

type Tab =
  | 'square' | 'production' | 'settings'
  | 'accounting-dashboard'
  | 'accounts-receivable'
  | 'paid-invoices'
  | 'customers'
  | 'payments';

interface CompanySettings {
  company_name: string;
  logo_url: string | null;
}

const TAB_HASH_MAP: Record<Tab, string> = {
  'production': 'production',
  'square': 'square',
  'settings': 'settings',
  'accounting-dashboard': 'billing',
  'accounts-receivable': 'accounts-receivable',
  'paid-invoices': 'paid-invoices',
  'customers': 'customers',
  'payments': 'payments',
};

const HASH_TAB_MAP: Record<string, Tab> = Object.entries(TAB_HASH_MAP).reduce(
  (acc, [tab, hash]) => ({ ...acc, [hash]: tab as Tab }),
  {} as Record<string, Tab>
);

const ACCOUNTING_TABS: Tab[] = ['accounting-dashboard', 'accounts-receivable', 'paid-invoices', 'customers', 'payments'];

function getTabFromHash(): Tab | null {
  const hash = window.location.hash.slice(1);
  return HASH_TAB_MAP[hash] || null;
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const hashTab = getTabFromHash();
    return hashTab || 'production';
  });
  const [accountingExpanded, setAccountingExpanded] = useState(() => {
    const hashTab = getTabFromHash();
    return hashTab ? ACCOUNTING_TABS.includes(hashTab) : false;
  });
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);
  const [customerSearchTerm, setCustomerSearchTerm] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [customersKey, setCustomersKey] = useState(0);
  const [quoteCustomerId, setQuoteCustomerId] = useState<string | undefined>(undefined);
  const [quoteContactId, setQuoteContactId] = useState<string | undefined>(undefined);
  const [navigateToQuoteId, setNavigateToQuoteId] = useState<string | undefined>(undefined);
  const previousTabRef = useRef<Tab | null>(null);
  const isNavigatingRef = useRef(false);
  const { signOut, user } = useAuth();
  const { userProfile, canAccessIntegrations, isAdmin, isSuperAdmin } = useRBAC();
  const { showNotification } = useNotification();
  const { darkMode, toggleDarkMode } = useTheme();

  useEffect(() => {
    const hash = TAB_HASH_MAP[activeTab];
    if (hash && window.location.hash !== `#${hash}`) {
      if (!isNavigatingRef.current) {
        window.history.pushState(null, '', `#${hash}`);
      }
      isNavigatingRef.current = false;
    }

    if (ACCOUNTING_TABS.includes(activeTab)) {
      setAccountingExpanded(true);
    }

    if (activeTab !== 'customers') {
      setSelectedCustomerId(undefined);
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      const hashTab = getTabFromHash();
      if (hashTab && hashTab !== activeTab) {
        isNavigatingRef.current = true;
        setActiveTab(hashTab);
        if (ACCOUNTING_TABS.includes(hashTab)) {
          setAccountingExpanded(true);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab]);

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
    if (previousTabRef.current === 'settings' && activeTab !== 'settings') {
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
    previousTabRef.current = activeTab;
  }, [activeTab]);

  const accountingNavItems = [
    {
      id: 'accounting-dashboard' as Tab,
      name: 'Billing Queue',
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
      id: 'paid-invoices' as Tab,
      name: 'Paid Invoices',
      icon: CheckCircle,
      description: 'View completed and paid invoices'
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

  const handleNavigateToCustomer = (searchTerm: string, customerEmail: string) => {
    setCustomerSearchTerm(searchTerm);
    setActiveTab('customers');
    setAccountingExpanded(true);
  };

  const handleCreateQuoteForCustomer = (customerId: string, contactId?: string) => {
    setQuoteCustomerId(customerId);
    setQuoteContactId(contactId);
    setActiveTab('production');
  };

  const handleViewCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerSearchTerm('');
    setActiveTab('customers');
    setAccountingExpanded(true);
  };

  const handleViewQuote = (quoteId: string) => {
    setNavigateToQuoteId(quoteId);
    setActiveTab('production');
  };

  const handleDuplicateQuote = (quoteId: string) => {
    setNavigateToQuoteId(quoteId);
    setActiveTab('production');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-900 dark:to-slate-800 transition-colors">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 h-full bg-white dark:bg-[#1a2744] border-r border-gray-200 dark:border-slate-700 shadow-xl z-30 w-56">
        {/* Logo/Brand */}
        <div className="h-20 border-b border-gray-200 dark:border-slate-700 flex items-center justify-center px-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-700">
          <div className="flex items-center justify-center w-full h-full py-1.5">
            <img
              key={darkMode ? 'dark' : 'light'}
              src={darkMode ? "/InkOps-02.png" : "/InkOps-01.png"}
              alt="InkOps"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 overflow-y-auto pb-32" style={{ height: 'calc(100vh - 220px)' }}>

          {/* 1. PRODUCTION DASHBOARD - Top-level link */}
          <div className="space-y-1">
            {productionNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-orange-50 dark:bg-blue-600/20 text-orange-700 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  aria-label="Production Dashboard"
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-orange-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-bold text-xs uppercase tracking-wide leading-tight ${isActive ? 'text-orange-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      Production
                    </div>
                  </div>
                  {isActive && <div className="w-1 h-8 bg-orange-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200 dark:border-slate-700 my-3" />

          {/* 2. ACCOUNTING - Collapsible section */}
          <div>
            {/* Accounting Header - Collapsible trigger */}
            <button
              onClick={() => setAccountingExpanded(!accountingExpanded)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-slate-700/50"
              aria-label="Accounting"
              aria-expanded={accountingExpanded}
              aria-controls="accounting-submenu"
            >
              <Wallet className="w-5 h-5 flex-shrink-0 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white" />
              <div className="flex-1 text-left">
                <div className="font-bold text-sm uppercase tracking-wide text-gray-900 dark:text-gray-100">
                  Accounting
                </div>
              </div>
              {accountingExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 rotate-180" />
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
                      onClick={() => setActiveTab(item.id)}
                      className={`collapsible-item w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                        isActive
                          ? 'bg-green-50 dark:bg-blue-600/20 text-green-700 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                      }`}
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-green-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                      <div className="flex-1 text-left">
                        <div className={`font-medium text-sm ${isActive ? 'text-green-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {item.name}
                        </div>
                      </div>
                      {isActive && <div className="w-1 h-6 bg-green-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200 dark:border-slate-700 my-3" />

          {/* 3. SQUARE DASHBOARD - Top-level link */}
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
                      ? 'bg-green-50 dark:bg-blue-600/20 text-green-700 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  aria-label="Square Dashboard"
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-green-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                  <div className="flex-1 text-left">
                    <div className={`font-bold text-xs uppercase tracking-wide leading-tight ${isActive ? 'text-green-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      Square<br />Dashboard
                    </div>
                  </div>
                  {isActive && <div className="w-1 h-8 bg-green-600 dark:bg-blue-500 rounded-full absolute right-0" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User & Controls */}
        <div className="absolute bottom-4 left-0 right-0 px-4 space-y-2">
          {user && (
            <div className="px-4 py-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg mb-2 min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400">Signed in as</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={user.email}>{user.email}</p>
            </div>
          )}
          <button
            onClick={() => setActiveTab('settings')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Account Settings</span>
          </button>
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="text-sm font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`ml-56 ${activeTab === 'settings' ? 'flex flex-col h-screen' : ''}`}>
        {/* Top Bar */}
        <header className={`h-20 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-20 shadow-sm ${activeTab === 'settings' ? 'flex-shrink-0' : ''}`}>
          <div className="h-full px-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
                {activeTab === 'accounting-dashboard' ? 'Billing Queue' :
                 activeTab === 'accounts-receivable' ? 'Accounts Receivable' :
                 activeTab === 'paid-invoices' ? 'Paid Invoices' :
                 activeTab === 'customers' ? 'Customers' :
                 activeTab === 'payments' ? 'Payments' :
                 activeTab === 'production' ? 'Production Dashboard' :
                 [...accountingNavItems, ...squareNavItems, ...productionNavItems].find(item => item.id === activeTab)?.name ||
                 (activeTab === 'settings' ? 'Account Settings' : 'Dashboard')}
              </h2>
              {activeTab !== 'production' && (
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {activeTab === 'accounting-dashboard' ? (
                    'Manage invoices, send payments, and track billing'
                  ) : activeTab === 'accounts-receivable' ? (
                    'Aging reports and outstanding invoices'
                  ) : activeTab === 'paid-invoices' ? (
                    'View completed and paid invoices'
                  ) : activeTab === 'customers' ? (
                    'Customer billing summary and payment history'
                  ) : activeTab === 'payments' ? (
                    'Payment history and Stripe transaction records'
                  ) : activeTab === 'square' ? (
                    'Square payment data and reports'
                  ) : activeTab === 'settings' ? (
                    'Configure your integrations and preferences'
                  ) : (
                    'Financial management dashboard'
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              {activeTab === 'customers' && (
                <button
                  onClick={() => setShowCreateCustomerModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
                  title="Create new customer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="font-medium">New Customer</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={activeTab === 'settings' ? 'flex-1 overflow-hidden' : 'py-6 px-6 sm:py-8 sm:px-8'}>
          {activeTab === 'accounting-dashboard' && (
            <Suspense fallback={
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-600 dark:text-blue-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Accounting Dashboard</h3>
                  <p className="text-gray-600 dark:text-gray-400">Initializing accounting module...</p>
                </div>
              </div>
            }>
              <BillingDashboard onNavigateToCustomer={handleNavigateToCustomer} />
            </Suspense>
          )}

          {activeTab === 'accounts-receivable' && (
            <Suspense fallback={
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-600 dark:text-blue-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Accounts Receivable</h3>
                  <p className="text-gray-600 dark:text-gray-400">Loading aging reports...</p>
                </div>
              </div>
            }>
              <AccountsReceivableReport
                onNavigateToSettings={(tab) => {
                  setSettingsInitialTab(tab);
                  setActiveTab('settings');
                }}
                onNavigateToCustomer={handleNavigateToCustomer}
              />
            </Suspense>
          )}

          {activeTab === 'paid-invoices' && (
            <Suspense fallback={
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-600 dark:text-blue-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Paid Invoices</h3>
                  <p className="text-gray-600 dark:text-gray-400">Loading paid invoice data...</p>
                </div>
              </div>
            }>
              <PaidInvoicesPage onNavigateToCustomer={handleNavigateToCustomer} />
            </Suspense>
          )}

          {activeTab === 'customers' && (
            <Suspense fallback={
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-600 dark:text-blue-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Customers Report</h3>
                  <p className="text-gray-600 dark:text-gray-400">Loading customer data...</p>
                </div>
              </div>
            }>
              <CustomersReport
                key={`${customersKey}-${selectedCustomerId || ''}`}
                initialSearchTerm={customerSearchTerm}
                initialCustomerId={selectedCustomerId}
                onCreateQuote={handleCreateQuoteForCustomer}
                onViewQuote={handleViewQuote}
                onDuplicateQuote={handleDuplicateQuote}
              />
            </Suspense>
          )}

          {activeTab === 'payments' && (
            <Suspense fallback={
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-600 dark:text-blue-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Payments Report</h3>
                  <p className="text-gray-600 dark:text-gray-400">Loading payment history...</p>
                </div>
              </div>
            }>
              <PaymentsReport onNavigateToCustomer={handleNavigateToCustomer} />
            </Suspense>
          )}

          {activeTab === 'square' && (
            <Suspense fallback={
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-green-600 dark:text-blue-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Square Data</h3>
                  <p className="text-gray-600 dark:text-gray-400">Initializing Square data module...</p>
                </div>
              </div>
            }>
              <SquareData />
            </Suspense>
          )}

          {activeTab === 'production' && (
            <Suspense fallback={
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-orange-600 dark:text-blue-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Production Management</h3>
                  <p className="text-gray-600 dark:text-gray-400">Initializing production module...</p>
                </div>
              </div>
            }>
              <ProductionManagement
                onNavigateToCustomers={() => {
                  setActiveTab('customers');
                  setAccountingExpanded(true);
                }}
                onViewCustomer={handleViewCustomer}
                initialCustomerId={quoteCustomerId}
                initialContactId={quoteContactId}
                initialQuoteId={navigateToQuoteId}
                onCustomerIdConsumed={() => {
                  setQuoteCustomerId(undefined);
                  setQuoteContactId(undefined);
                  setNavigateToQuoteId(undefined);
                }}
              />
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

      {/* Create Customer Modal */}
      <CreateCustomerModal
        isOpen={showCreateCustomerModal}
        onClose={() => setShowCreateCustomerModal(false)}
        onSuccess={() => {
          setCustomersKey(prev => prev + 1);
          setShowCreateCustomerModal(false);
        }}
      />
    </div>
  );
}

function App() {
  const path = window.location.pathname;

  const isQuoteApprovalPage = path.startsWith('/quote-approval/');
  const isPortalPage = path.startsWith('/portal');
  const isDirectCustomerPage = path.match(/^\/customer\/([^/]+)/);
  const isFeaturesPage = path === '/features' || path === '/features/';

  if (isFeaturesPage) {
    hideInitialLoader();
    return (
      <ThemeProvider>
        <FeaturesPage
          onLoginClick={() => window.location.href = '/login'}
          onBackToHome={() => window.location.href = '/'}
        />
      </ThemeProvider>
    );
  }

  if (isQuoteApprovalPage) {
    hideInitialLoader();
    return (
      <ConfirmationProvider>
        <PublicQuoteApprovalPage />
      </ConfirmationProvider>
    );
  }

  if (isDirectCustomerPage) {
    hideInitialLoader();
    const customerId = isDirectCustomerPage[1];
    return (
      <CustomerPortalProvider>
        <ThemeProvider>
          <NotificationProvider>
            <ConfirmationProvider>
              <DomainAwareCustomerPortal customerId={customerId} />
            </ConfirmationProvider>
          </NotificationProvider>
        </ThemeProvider>
      </CustomerPortalProvider>
    );
  }

  if (isPortalPage) {
    hideInitialLoader();
    const customerMatch = path.match(/^\/portal\/customer\/([^/]+)/);

    return (
      <CustomerPortalProvider>
        <ThemeProvider>
          <NotificationProvider>
            <ConfirmationProvider>
              {customerMatch ? (
                <DomainAwareCustomerPortal customerId={customerMatch[1]} />
              ) : path === '/portal' || path === '/portal/' || path === '/portal/login' ? (
                <PortalLogin />
              ) : path.startsWith('/portal/dashboard') ? (
                <PortalDashboard />
              ) : path.startsWith('/portal/invoices') ? (
                <PortalInvoices />
              ) : path.startsWith('/portal/quotes') ? (
                <PortalQuotes />
              ) : path.startsWith('/portal/proofs') ? (
                <PortalProofs />
              ) : path.startsWith('/portal/orders') ? (
                <PortalOrderHistory />
              ) : path.startsWith('/portal/payment-methods') ? (
                <PortalPaymentMethods />
              ) : (
                <PortalLogin />
              )}
            </ConfirmationProvider>
          </NotificationProvider>
        </ThemeProvider>
      </CustomerPortalProvider>
    );
  }

  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <ConfirmationProvider>
            <AuthenticatedApp />
          </ConfirmationProvider>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/login' || path === '/signup') {
      setShowLogin(true);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          hideInitialLoader();
        });
      });
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
    );
  }

  if (!user) {
    if (showLogin) {
      return <EnhancedAuthScreen onBackClick={() => setShowLogin(false)} />;
    }
    return <LandingPage onLoginClick={() => setShowLogin(true)} />;
  }

  return <AppContent />;
}

export default App;
