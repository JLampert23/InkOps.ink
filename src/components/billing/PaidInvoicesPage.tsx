import { useState } from 'react';
import { PaidInvoices } from './PaidInvoices';
import { InvoiceDetail } from './InvoiceDetail';

interface PaidInvoicesPageProps {
  onNavigateToCustomer?: (customerEmail: string, customerName: string) => void;
}

export function PaidInvoicesPage({ onNavigateToCustomer }: PaidInvoicesPageProps = {}) {
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);

  const handleViewInvoice = (printavoInvoiceId: string) => {
    setViewingInvoiceId(printavoInvoiceId);
  };

  const handleBackToList = () => {
    setViewingInvoiceId(null);
  };

  if (viewingInvoiceId) {
    return (
      <InvoiceDetail
        invoiceId={viewingInvoiceId}
        onBack={handleBackToList}
        onNavigateToCustomer={onNavigateToCustomer}
      />
    );
  }

  return <PaidInvoices onViewInvoice={handleViewInvoice} />;
}
