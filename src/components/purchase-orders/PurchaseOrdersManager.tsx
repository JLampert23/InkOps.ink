import React, { useState } from 'react';
import { PurchaseOrdersList } from './PurchaseOrdersList';
import { CreatePurchaseOrder } from './CreatePurchaseOrder';
import { PurchaseOrderDetail } from './PurchaseOrderDetail';

type View = 'list' | 'create' | 'detail';

export function PurchaseOrdersManager() {
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

  return (
    <div className="p-6">
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
    </div>
  );
}
