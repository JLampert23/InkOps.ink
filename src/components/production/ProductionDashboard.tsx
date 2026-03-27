import { useState, useEffect } from 'react';
import { FileText, ClipboardList, CalendarDays, Package, Users, Calendar } from 'lucide-react';
import { QuotesManager } from './QuotesManager';
import { WorkOrdersManager } from './WorkOrdersManager';
import ProductionScheduler from './ProductionScheduler';
import KanbanCalendar from './KanbanCalendar';
import { PurchaseOrdersManager } from '../purchase-orders/PurchaseOrdersManager';
import { supabase } from '../../lib/supabase-client';

type ProductionTab = 'quotes' | 'work-orders' | 'scheduling' | 'kanban' | 'manage-goods';

interface ProductionDashboardProps {
  onNavigateToCustomers: () => void;
  initialCustomerId?: string;
  initialContactId?: string;
  initialQuoteId?: string;
  onCustomerIdConsumed?: () => void;
}

export function ProductionDashboard({ onNavigateToCustomers, initialCustomerId, initialContactId, initialQuoteId, onCustomerIdConsumed }: ProductionDashboardProps) {
  const [activeTab, setActiveTab] = useState<ProductionTab>('quotes');
  const [customerIdForQuote, setCustomerIdForQuote] = useState<string | undefined>(initialCustomerId);
  const [contactIdForQuote, setContactIdForQuote] = useState<string | undefined>(initialContactId);
  const [quoteIdToView, setQuoteIdToView] = useState<string | undefined>(initialQuoteId);
  const [typesOfWork, setTypesOfWork] = useState<Array<{ id: string; work_type_name: string }>>([]);
  const [selectedScheduleType, setSelectedScheduleType] = useState<string>('');
  const [navigateToWorkOrderId, setNavigateToWorkOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuoteId) {
      setActiveTab('quotes');
      setQuoteIdToView(initialQuoteId);
    } else if (initialCustomerId) {
      setActiveTab('quotes');
      setCustomerIdForQuote(initialCustomerId);
      setContactIdForQuote(initialContactId);
    }
  }, [initialCustomerId, initialContactId, initialQuoteId]);

  useEffect(() => {
    loadTypesOfWork();
  }, []);

  const loadTypesOfWork = async () => {
    try {
      // Get current user's company_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile?.company_id) return;

      // Load all active work types
      const { data: workTypes } = await supabase
        .from('type_of_work_settings')
        .select('id, work_type_name')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (workTypes && workTypes.length > 0) {
        setTypesOfWork(workTypes);
        setSelectedScheduleType('all');
      }
    } catch (error) {
      console.error('Error loading types of work:', error);
    }
  };

  const tabs = [
    { id: 'quotes' as ProductionTab, label: 'Quotes', icon: FileText, description: 'Quote management & approvals' },
    { id: 'work-orders' as ProductionTab, label: 'Work Orders', icon: ClipboardList, description: 'Production work orders' },
    { id: 'scheduling' as ProductionTab, label: 'Scheduling', icon: CalendarDays, description: 'Production scheduling' },
    { id: 'kanban' as ProductionTab, label: 'Kanban Calendar', icon: Calendar, description: 'Visual calendar view' },
    { id: 'manage-goods' as ProductionTab, label: 'Manage Goods', icon: Package, description: 'Purchase orders & inventory' },
  ];

  const handleNavigateToWorkOrder = (workOrderId: string) => {
    setNavigateToWorkOrderId(workOrderId);
    setActiveTab('work-orders');
  };

  const handleQuoteCustomerConsumed = () => {
    setCustomerIdForQuote(undefined);
    setContactIdForQuote(undefined);
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
            initialContactId={contactIdForQuote}
            initialQuoteId={quoteIdToView}
            onCustomerIdConsumed={handleQuoteCustomerConsumed}
          />
        );
      case 'work-orders':
        return <WorkOrdersManager initialWorkOrderId={navigateToWorkOrderId} />;
      case 'scheduling':
        const schedulerType = selectedScheduleType === 'all' && typesOfWork.length > 0
          ? typesOfWork[0].work_type_name
          : selectedScheduleType;
        return (
          <div className="space-y-4">
            {typesOfWork.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
                <CalendarDays className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Types of Work Configured</h3>
                <p className="text-gray-600 dark:text-gray-400">Configure types of work in Settings to use the production scheduler</p>
              </div>
            ) : (
              <>
                {/* Type of Work Dropdown */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type of Work
                  </label>
                  <select
                    value={schedulerType}
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
                {schedulerType && (
                  <ProductionScheduler typeOfWork={schedulerType} onNavigateToWorkOrder={handleNavigateToWorkOrder} />
                )}
              </>
            )}
          </div>
        );
      case 'kanban':
        return (
          <div className="space-y-4">
            {typesOfWork.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Types of Work Configured</h3>
                <p className="text-gray-600 dark:text-gray-400">Configure types of work in Settings to use the kanban calendar</p>
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
                    <option value="all">View All</option>
                    {typesOfWork.map((type) => (
                      <option key={type.id} value={type.work_type_name}>
                        {type.work_type_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Kanban Calendar Full Screen */}
                {selectedScheduleType && (
                  <KanbanCalendar typeOfWork={selectedScheduleType} onNavigateToWorkOrder={handleNavigateToWorkOrder} inline />
                )}
              </>
            )}
          </div>
        );
      case 'manage-goods':
        return <PurchaseOrdersManager onNavigateToWorkOrder={handleNavigateToWorkOrder} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="grid grid-cols-6 divide-x divide-gray-200 dark:divide-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-3 text-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${
                  isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                  <div>
                    <div className={`text-xs font-semibold ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                      {tab.label}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
                      {tab.description}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          <button
            onClick={onNavigateToCustomers}
            className="p-3 text-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            <div className="flex flex-col items-center gap-1.5">
              <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <div>
                <div className="text-xs font-semibold text-gray-900 dark:text-white">
                  Customers
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">
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
