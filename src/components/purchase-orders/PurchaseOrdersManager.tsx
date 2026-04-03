import React, { useState, useEffect } from 'react';
import { Package, FileText, Truck, LayoutDashboard } from 'lucide-react';
import { PurchaseOrdersList } from './PurchaseOrdersList';
import { CreatePurchaseOrder } from './CreatePurchaseOrder';
import { PurchaseOrderDetail } from './PurchaseOrderDetail';
import { GarmentOrderReport } from './GarmentOrderReport';
import { ReceivingDashboard } from './ReceivingDashboard';
import { ReceiveGoods } from './ReceiveGoods';
import { ManageGoodsDashboard } from './ManageGoodsDashboard';

type View = 'list' | 'create' | 'detail';
type Tab = 'dashboard' | 'purchase-orders' | 'garment-report' | 'receiving';

interface PurchaseOrdersManagerProps {
  onNavigateToWorkOrder?: (workOrderId: string) => void;
}

export function PurchaseOrdersManager({ onNavigateToWorkOrder }: PurchaseOrdersManagerProps = {}) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [currentView, setCurrentView] = useState<View>('list');
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingPoId, setReceivingPoId] = useState<string | null>(null);

  const handleCreateNew = () => {
    setCurrentView('create');
  };

  const handleViewDetail = (poId: string) => {
    setSelectedPoId(poId);
    setCurrentView('detail');
    window.history.pushState(
      { poView: 'detail', poId },
      '',
      `#manage-goods/purchase-orders/${poId}`
    );
  };

  const handleBack = () => {
    setCurrentView('list');
    setSelectedPoId(null);
    window.history.back();
  };

  const handleSave = (poId: string) => {
    setSelectedPoId(poId);
    setCurrentView('detail');
  };

  const handleReceiveFromDetail = (poId: string) => {
    setReceivingPoId(poId);
    setShowReceiveModal(true);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setCurrentView('list');
    setSelectedPoId(null);
    setShowReceiveModal(false);
    setReceivingPoId(null);
  };

  const handleReceivePO = (poId: string) => {
    setReceivingPoId(poId);
    setShowReceiveModal(true);
  };

  const handleReceiveSuccess = () => {
    setShowReceiveModal(false);
    setReceivingPoId(null);
    if (currentView === 'detail' && selectedPoId) {
      setSelectedPoId(selectedPoId);
    }
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.poView === 'list') {
        setCurrentView('list');
        setSelectedPoId(null);
      } else if (event.state?.poView === 'detail' && event.state?.poId) {
        setCurrentView('detail');
        setSelectedPoId(event.state.poId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleDashboardNavigate = (tab: string, view?: string, id?: string) => {
    if (tab === 'work-orders' && id && onNavigateToWorkOrder) {
      onNavigateToWorkOrder(id);
      return;
    }

    setActiveTab(tab as Tab);
    if (view) setCurrentView(view as View);
    if (id) {
      setSelectedPoId(id);
      setCurrentView('detail');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="grid grid-cols-4 divide-x divide-gray-200 dark:divide-slate-700">
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`p-4 text-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${
              activeTab === 'dashboard' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <LayoutDashboard className={`w-6 h-6 ${activeTab === 'dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <div>
                <div className={`text-sm font-semibold ${activeTab === 'dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                  Dashboard
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Overview & KPIs
                </div>
              </div>
            </div>
          </button>

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

          <button
            onClick={() => handleTabChange('receiving')}
            className={`p-4 text-center transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${
              activeTab === 'receiving' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <Truck className={`w-6 h-6 ${activeTab === 'receiving' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
              <div>
                <div className={`text-sm font-semibold ${activeTab === 'receiving' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                  Receiving
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Receive goods
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'dashboard' && (
          <ManageGoodsDashboard onNavigate={handleDashboardNavigate} />
        )}

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
                onReceiveGoods={handleReceiveFromDetail}
                onNavigateToWorkOrder={onNavigateToWorkOrder}
              />
            )}
          </>
        )}

        {activeTab === 'garment-report' && (
          <GarmentOrderReport
            onCreatePO={(items) => {
              alert('Create PO functionality will be implemented');
            }}
            onNavigate={handleDashboardNavigate}
          />
        )}

        {activeTab === 'receiving' && (
          <ReceivingDashboard
            onReceivePO={handleReceivePO}
            onViewPO={handleViewDetail}
          />
        )}
      </div>

      {/* Receive Goods Modal */}
      {showReceiveModal && receivingPoId && (
        <ReceiveGoods
          poId={receivingPoId}
          onClose={() => setShowReceiveModal(false)}
          onSuccess={handleReceiveSuccess}
        />
      )}
    </div>
  );
}
