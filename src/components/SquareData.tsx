import { useState, lazy, Suspense } from 'react';
import { CreditCard, DollarSign, Users, Package, Archive, RefreshCw, MapPin, UserCheck, ArrowLeft, Loader2 } from 'lucide-react';

const SquareTransactions = lazy(() => import('./square/SquareTransactions'));
const SquareDeposits = lazy(() => import('./square/SquareDeposits'));
const SquareCustomers = lazy(() => import('./square/SquareCustomers'));
const SquareItems = lazy(() => import('./square/SquareItems'));
const SquareInventory = lazy(() => import('./square/SquareInventory'));
const SquareRefunds = lazy(() => import('./square/SquareRefunds'));
const SquareLocations = lazy(() => import('./square/SquareLocations'));
const SquareEmployees = lazy(() => import('./square/SquareEmployees'));

type SquareModule =
  | 'transactions'
  | 'deposits'
  | 'customers'
  | 'items'
  | 'inventory'
  | 'refunds'
  | 'locations'
  | 'employees'
  | null;

interface ModuleCard {
  id: SquareModule;
  name: string;
  icon: typeof CreditCard;
  description: string;
  color: string;
}

export default function SquareData() {
  const [activeModule, setActiveModule] = useState<SquareModule>(null);

  const modules: ModuleCard[] = [
    {
      id: 'transactions',
      name: 'Transactions',
      icon: CreditCard,
      description: 'View and analyze all Square payment transactions',
      color: 'blue'
    },
    {
      id: 'deposits',
      name: 'Deposits / Payouts',
      icon: DollarSign,
      description: 'Track deposits and payout history',
      color: 'green'
    },
    {
      id: 'customers',
      name: 'Customers',
      icon: Users,
      description: 'Manage customer profiles and data',
      color: 'purple'
    },
    {
      id: 'items',
      name: 'Items / Products',
      icon: Package,
      description: 'Browse your catalog of products and services',
      color: 'orange'
    },
    {
      id: 'inventory',
      name: 'Inventory',
      icon: Archive,
      description: 'Monitor inventory levels and stock',
      color: 'teal'
    },
    {
      id: 'refunds',
      name: 'Refunds',
      icon: RefreshCw,
      description: 'View refund and return transactions',
      color: 'red'
    },
    {
      id: 'locations',
      name: 'Locations',
      icon: MapPin,
      description: 'Manage your business locations',
      color: 'indigo'
    },
    {
      id: 'employees',
      name: 'Employees',
      icon: UserCheck,
      description: 'View employee and team member data',
      color: 'pink'
    },
  ];

  const getColorClasses = (color: string, variant: 'bg' | 'text' | 'border' | 'hover') => {
    const colorMap: Record<string, Record<string, string>> = {
      blue: {
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-200',
        hover: 'hover:bg-blue-100'
      },
      green: {
        bg: 'bg-green-50',
        text: 'text-green-600',
        border: 'border-green-200',
        hover: 'hover:bg-green-100'
      },
      purple: {
        bg: 'bg-purple-50',
        text: 'text-purple-600',
        border: 'border-purple-200',
        hover: 'hover:bg-purple-100'
      },
      orange: {
        bg: 'bg-orange-50',
        text: 'text-orange-600',
        border: 'border-orange-200',
        hover: 'hover:bg-orange-100'
      },
      teal: {
        bg: 'bg-teal-50',
        text: 'text-teal-600',
        border: 'border-teal-200',
        hover: 'hover:bg-teal-100'
      },
      red: {
        bg: 'bg-red-50',
        text: 'text-red-600',
        border: 'border-red-200',
        hover: 'hover:bg-red-100'
      },
      indigo: {
        bg: 'bg-indigo-50',
        text: 'text-indigo-600',
        border: 'border-indigo-200',
        hover: 'hover:bg-indigo-100'
      },
      pink: {
        bg: 'bg-pink-50',
        text: 'text-pink-600',
        border: 'border-pink-200',
        hover: 'hover:bg-pink-100'
      },
    };
    return colorMap[color]?.[variant] || colorMap.blue[variant];
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'transactions':
        return <SquareTransactions />;
      case 'deposits':
        return <SquareDeposits />;
      case 'customers':
        return <SquareCustomers />;
      case 'items':
        return <SquareItems />;
      case 'inventory':
        return <SquareInventory />;
      case 'refunds':
        return <SquareRefunds />;
      case 'locations':
        return <SquareLocations />;
      case 'employees':
        return <SquareEmployees />;
      default:
        return null;
    }
  };

  if (activeModule) {
    return (
      <div>
        <button
          onClick={() => setActiveModule(null)}
          className="mb-6 flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <Suspense fallback={
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Module</h3>
              <p className="text-gray-600">Initializing {modules.find(m => m.id === activeModule)?.name}...</p>
            </div>
          </div>
        }>
          {renderModule()}
        </Suspense>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Square Data Dashboard</h1>
        <p className="text-gray-600">Select a category to view and analyze your Square data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              onClick={() => setActiveModule(module.id)}
              className={`text-left p-6 rounded-xl border-2 transition-all duration-200 ${getColorClasses(module.color, 'bg')} ${getColorClasses(module.color, 'border')} ${getColorClasses(module.color, 'hover')} hover:shadow-lg hover:scale-105`}
            >
              <div className={`inline-flex p-3 rounded-lg ${getColorClasses(module.color, 'bg')} mb-4`}>
                <Icon className={`w-6 h-6 ${getColorClasses(module.color, 'text')}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${getColorClasses(module.color, 'text')}`}>
                {module.name}
              </h3>
              <p className="text-sm text-gray-600">
                {module.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Getting Started</h3>
        <p className="text-sm text-gray-600 mb-3">
          To use Square Data modules, ensure your Square credentials are configured in Account Settings.
        </p>
        <p className="text-xs text-gray-500">
          Each module provides options to filter, export, and analyze your Square data. Select a category above to begin.
        </p>
      </div>
    </div>
  );
}
