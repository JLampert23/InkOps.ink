import { useState } from 'react';
import { PaidInvoices } from './PaidInvoices';
import { InvoiceDetail } from './InvoiceDetail';

export function PaidInvoicesPage() {
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
      />
    );
  }

  return <PaidInvoices onViewInvoice={handleViewInvoice} />;
}
