import React, { useState } from 'react';
import { Package, FileText } from 'lucide-react';
import { PurchaseOrdersList } from './PurchaseOrdersList';
import { CreatePurchaseOrder } from './CreatePurchaseOrder';
import { PurchaseOrderDetail } from './PurchaseOrderDetail';
import { GarmentOrderReport } from './GarmentOrderReport';

type View = 'list' | 'create' | 'detail';
type Tab = 'purchase-orders' | 'garment-report';

export function PurchaseOrdersManager() {
  const [activeTab, setActiveTab] = useState<Tab>('purchase-orders');
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setCurrentView('create');
  };

  const handleViewDetail = (poId: string) => {
    setSelectedPoId(poId);
    setCurrentView('detail');
  };

  const handleBack = () => {
    setCurrentView('list');
    setSelectedPoId(null);
  };

  const handleSave = (poId: string) => {
    setSelectedPoId(poId);
    setCurrentView('detail');
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setCurrentView('list');
    setSelectedPoId(null);
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="grid grid-cols-2 divide-x divide-gray-200 dark:divide-slate-700">
          <button
            onClick={() => handleTabChange('purchase-orders')}
            className={`p-4 text-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${
              activeTab === 'purchase-orders' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <Package className={`w-6 h-6 ${activeTab === 'purchase-orders' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <div>
                <div className={`text-sm font-semibold ${activeTab === 'purchase-orders' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                  Purchase Orders
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Create and manage POs
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleTabChange('garment-report')}
            className={`p-4 text-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${
              activeTab === 'garment-report' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <FileText className={`w-6 h-6 ${activeTab === 'garment-report' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <div>
                <div className={`text-sm font-semibold ${activeTab === 'garment-report' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                  Garment Report
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Track garment needs
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'purchase-orders' && (
          <>
            {currentView === 'list' && (
              <PurchaseOrdersList
                onCreateNew={handleCreateNew}
                onViewDetail={handleViewDetail}
              />
            )}

            {currentView === 'create' && (
              <CreatePurchaseOrder
                onBack={handleBack}
                onSave={handleSave}
              />
            )}

            {currentView === 'detail' && selectedPoId && (
              <PurchaseOrderDetail
                poId={selectedPoId}
                onBack={handleBack}
              />
            )}
          </>
        )}

        {activeTab === 'garment-report' && (
          <GarmentOrderReport
            onCreatePO={(items) => {
              alert('Create PO functionality will be implemented');
            }}
          />
        )}
      </div>
    </div>
  );
}
