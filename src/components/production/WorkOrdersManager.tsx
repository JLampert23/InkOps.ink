import React, { useState } from 'react';
import WorkOrdersList from './WorkOrdersList';
import { WorkOrderDetail } from './WorkOrderDetail';

export function WorkOrdersManager() {
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(
    null
  );

  if (selectedWorkOrderId) {
    return (
      <WorkOrderDetail
        workOrderId={selectedWorkOrderId}
        onBack={() => setSelectedWorkOrderId(null)}
      />
    );
  }

  return <WorkOrdersList onSelectWorkOrder={setSelectedWorkOrderId} />;
}
