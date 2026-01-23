import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const ProductionDashboard = lazy(() => import('./production/ProductionDashboard').then(m => ({ default: m.ProductionDashboard })));

interface ProductionManagementProps {
  onNavigateToCustomers: () => void;
  initialCustomerId?: string;
  onCustomerIdConsumed?: () => void;
}

export function ProductionManagement({ onNavigateToCustomers, initialCustomerId, onCustomerIdConsumed }: ProductionManagementProps) {
  const LoadingFallback = () => (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Loading Production</h3>
      <p className="text-gray-600 dark:text-gray-400">Initializing module...</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Production Management</h1>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <ProductionDashboard
          onNavigateToCustomers={onNavigateToCustomers}
          initialCustomerId={initialCustomerId}
          onCustomerIdConsumed={onCustomerIdConsumed}
        />
      </Suspense>
    </div>
  );
}
