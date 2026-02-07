import { useState, useEffect } from 'react';
import WorkOrdersList from './WorkOrdersList';
import { WorkOrderDetail } from './WorkOrderDetail';

interface WorkOrdersManagerProps {
  initialWorkOrderId?: string | null;
}

export function WorkOrdersManager({ initialWorkOrderId }: WorkOrdersManagerProps = {}) {
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(
    initialWorkOrderId || null
  );

  useEffect(() => {
    if (initialWorkOrderId) {
      setSelectedWorkOrderId(initialWorkOrderId);
    }
  }, [initialWorkOrderId]);

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
