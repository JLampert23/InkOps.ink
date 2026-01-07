import { useState, lazy, Suspense } from 'react';
import { FileText, Image, DollarSign, LayoutDashboard, Loader2 } from 'lucide-react';

const QuotesManager = lazy(() => import('./production/QuotesManager').then(m => ({ default: m.QuotesManager })));
const ProofsManager = lazy(() => import('./production/ProofsManager').then(m => ({ default: m.ProofsManager })));
const InvoicingManager = lazy(() => import('./production/InvoicingManager').then(m => ({ default: m.InvoicingManager })));
const ProductionDashboard = lazy(() => import('./production/ProductionDashboard').then(m => ({ default: m.ProductionDashboard })));

type ProductionTab = 'dashboard' | 'quotes' | 'proofs' | 'invoicing';

export function ProductionManagement() {
  const [activeTab, setActiveTab] = useState<ProductionTab>('dashboard');

  const tabs = [
    { id: 'dashboard' as ProductionTab, name: 'Production Board', icon: LayoutDashboard, description: 'Kanban-style workflow' },
    { id: 'quotes' as ProductionTab, name: 'Quotes', icon: FileText, description: 'Quote management & approvals' },
    { id: 'proofs' as ProductionTab, name: 'Proofs', icon: Image, description: 'Artwork proof approvals' },
    { id: 'invoicing' as ProductionTab, name: 'Invoicing', icon: DollarSign, description: 'Invoice creation & tracking' },
  ];

  const LoadingFallback = ({ message }: { message: string }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading {message}</h3>
      <p className="text-gray-600">Initializing module...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Production Management</h1>
        <p className="text-gray-600 mt-2">Manage your entire production workflow from quote to delivery</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-6 py-4 border-b-2 transition-all ${
                  isActive
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <div className="text-left">
                    <div className={`font-medium text-sm ${isActive ? 'text-blue-900' : 'text-gray-700'}`}>
                      {tab.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{tab.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> Workflow Setup, Automations, and Stripe Payments have been moved to <strong>Settings</strong> for centralized configuration.
        </p>
      </div>

      <Suspense fallback={<LoadingFallback message={tabs.find(t => t.id === activeTab)?.name || 'Module'} />}>
        {activeTab === 'dashboard' && <ProductionDashboard />}
        {activeTab === 'quotes' && <QuotesManager />}
        {activeTab === 'proofs' && <ProofsManager />}
        {activeTab === 'invoicing' && <InvoicingManager />}
      </Suspense>
    </div>
  );
}
