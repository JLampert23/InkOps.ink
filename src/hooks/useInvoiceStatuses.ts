import { useState, useEffect } from 'react';
import { CustomInvoiceStatusService, CustomInvoiceStatus } from '../services/custom-invoice-status-service';

export interface InvoiceStatus {
  id: string;
  name: string;
  color: string;
  isCustom: boolean;
  category?: string | null;
}

// System statuses that come from Printavo
const SYSTEM_STATUSES: InvoiceStatus[] = [
  { id: 'system_pending', name: 'Pending', color: '#F59E0B', isCustom: false },
  { id: 'system_approved', name: 'Approved', color: '#10B981', isCustom: false },
  { id: 'system_paid', name: 'Paid', color: '#10B981', isCustom: false },
  { id: 'system_partial', name: 'Partially Paid', color: '#3B82F6', isCustom: false },
  { id: 'system_overdue', name: 'Overdue', color: '#EF4444', isCustom: false },
  { id: 'system_cancelled', name: 'Cancelled', color: '#6B7280', isCustom: false },
];

export function useInvoiceStatuses(companyId: string | undefined) {
  const [statuses, setStatuses] = useState<InvoiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!companyId) {
      setStatuses(SYSTEM_STATUSES);
      setLoading(false);
      return;
    }

    loadStatuses();
  }, [companyId]);

  const loadStatuses = async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);
    try {
      const customStatuses = await CustomInvoiceStatusService.getCustomStatuses(companyId);

      const customStatusObjects: InvoiceStatus[] = customStatuses.map((cs: CustomInvoiceStatus) => ({
        id: cs.id,
        name: cs.name,
        color: cs.color,
        isCustom: true,
        category: cs.category,
      }));

      // Combine system statuses with custom statuses
      setStatuses([...SYSTEM_STATUSES, ...customStatusObjects]);
    } catch (err) {
      console.error('Error loading statuses:', err);
      setError(err as Error);
      // Fall back to system statuses only
      setStatuses(SYSTEM_STATUSES);
    } finally {
      setLoading(false);
    }
  };

  const findStatusByName = (name: string): InvoiceStatus | undefined => {
    return statuses.find((s) => s.name.toLowerCase() === name.toLowerCase());
  };

  const getStatusColor = (statusName: string): string => {
    const status = findStatusByName(statusName);
    return status?.color || '#6B7280';
  };

  return {
    statuses,
    loading,
    error,
    reload: loadStatuses,
    findStatusByName,
    getStatusColor,
  };
}
