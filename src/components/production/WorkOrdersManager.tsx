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

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.workOrderView === 'list') {
        setSelectedWorkOrderId(null);
      } else if (event.state?.workOrderView === 'detail' && event.state?.workOrderId) {
        setSelectedWorkOrderId(event.state.workOrderId);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectWorkOrder = (workOrderId: string) => {
    setSelectedWorkOrderId(workOrderId);
    window.history.pushState(
      { workOrderView: 'detail', workOrderId },
      '',
      `#production/work-orders/${workOrderId}`
    );
  };

  const handleBack = () => {
    setSelectedWorkOrderId(null);
    window.history.back();
  };

  if (selectedWorkOrderId) {
    return (
      <WorkOrderDetail
        workOrderId={selectedWorkOrderId}
        onBack={handleBack}
      />
    );
  }

  return <WorkOrdersList onSelectWorkOrder={handleSelectWorkOrder} />;
}
