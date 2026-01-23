import { useState } from 'react';
import { FileText, ClipboardList, CalendarDays, Package, Users } from 'lucide-react';
import { QuotesManager } from './QuotesManager';

type ProductionTab = 'quotes' | 'work-orders' | 'scheduling' | 'manage-goods';

interface ProductionDashboardProps {
  onNavigateToCustomers: () => void;
}

export function ProductionDashboard({ onNavigateToCustomers }: ProductionDashboardProps) {
  const [activeTab, setActiveTab] = useState<ProductionTab>('quotes');

  const tabs = [
    { id: 'quotes' as ProductionTab, label: 'Quotes', icon: FileText, description: 'Quote management & approvals' },
    { id: 'work-orders' as ProductionTab, label: 'Work Orders', icon: ClipboardList, description: 'Production work orders' },
    { id: 'scheduling' as ProductionTab, label: 'Scheduling', icon: CalendarDays, description: 'Production scheduling' },
    { id: 'manage-goods' as ProductionTab, label: 'Manage Goods', icon: Package, description: 'Inventory & products' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'quotes':
        return <QuotesManager />;
      case 'work-orders':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
            <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Work Orders</h3>
            <p className="text-gray-600 dark:text-gray-400">Work order management coming soon</p>
          </div>
        );
      case 'scheduling':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
            <CalendarDays className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Scheduling</h3>
            <p className="text-gray-600 dark:text-gray-400">Production scheduling coming soon</p>
          </div>
        );
      case 'manage-goods':
        return (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Manage Goods</h3>
            <p className="text-gray-600 dark:text-gray-400">Inventory management coming soon</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-gray-200 dark:divide-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-4 text-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${
                  isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <Icon className={`w-6 h-6 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                  <div>
                    <div className={`text-sm font-semibold ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                      {tab.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {tab.description}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          <button
            onClick={onNavigateToCustomers}
            className="p-4 text-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <div className="flex flex-col items-center gap-2">
              <Users className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Customers
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Customer database
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div>
        {renderTabContent()}
      </div>
    </div>
  );
}
