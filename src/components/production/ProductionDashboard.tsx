import { useState, useEffect } from 'react';
import { FileText, ClipboardList, CalendarDays, Package, Users } from 'lucide-react';
import { QuotesManager } from './QuotesManager';
import ProductionScheduler from './ProductionScheduler';
import { supabase } from '../../lib/supabase-client';

type ProductionTab = 'quotes' | 'work-orders' | 'scheduling' | 'manage-goods';

interface ProductionDashboardProps {
  onNavigateToCustomers: () => void;
  initialCustomerId?: string;
  onCustomerIdConsumed?: () => void;
}

export function ProductionDashboard({ onNavigateToCustomers, initialCustomerId, onCustomerIdConsumed }: ProductionDashboardProps) {
  const [activeTab, setActiveTab] = useState<ProductionTab>('quotes');
  const [customerIdForQuote, setCustomerIdForQuote] = useState<string | undefined>(initialCustomerId);
  const [typesOfWork, setTypesOfWork] = useState<Array<{ id: string; work_type_name: string }>>([]);
  const [selectedScheduleType, setSelectedScheduleType] = useState<string>('');

  useEffect(() => {
    if (initialCustomerId) {
      setActiveTab('quotes');
      setCustomerIdForQuote(initialCustomerId);
    }
  }, [initialCustomerId]);

  useEffect(() => {
    loadTypesOfWork();
  }, []);

  const loadTypesOfWork = async () => {
    try {
      const { data } = await supabase
        .from('type_of_work_settings')
        .select('id, work_type_name')
        .order('work_type_name', { ascending: true });

      if (data && data.length > 0) {
        setTypesOfWork(data);
        setSelectedScheduleType(data[0].work_type_name);
      }
    } catch (error) {
      console.error('Error loading types of work:', error);
    }
  };

  const tabs = [
    { id: 'quotes' as ProductionTab, label: 'Quotes', icon: FileText, description: 'Quote management & approvals' },
    { id: 'work-orders' as ProductionTab, label: 'Work Orders', icon: ClipboardList, description: 'Production work orders' },
    { id: 'scheduling' as ProductionTab, label: 'Scheduling', icon: CalendarDays, description: 'Production scheduling' },
    { id: 'manage-goods' as ProductionTab, label: 'Manage Goods', icon: Package, description: 'Inventory & products' },
  ];

  const handleQuoteCustomerConsumed = () => {
    setCustomerIdForQuote(undefined);
    if (onCustomerIdConsumed) {
      onCustomerIdConsumed();
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'quotes':
        return (
          <QuotesManager
            initialCustomerId={customerIdForQuote}
            onCustomerIdConsumed={handleQuoteCustomerConsumed}
          />
        );
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
          <div className="space-y-4">
            {typesOfWork.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
                <CalendarDays className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Types of Work Configured</h3>
                <p className="text-gray-600 dark:text-gray-400">Please configure types of work in Settings before using the scheduler</p>
              </div>
            ) : (
              <>
                {/* Type of Work Dropdown */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type of Work
                  </label>
                  <select
                    value={selectedScheduleType}
                    onChange={(e) => setSelectedScheduleType(e.target.value)}
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  >
                    {typesOfWork.map((type) => (
                      <option key={type.id} value={type.work_type_name}>
                        {type.work_type_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Schedule */}
                {selectedScheduleType && (
                  <ProductionScheduler typeOfWork={selectedScheduleType} />
                )}
              </>
            )}
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
