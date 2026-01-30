import { useState, useEffect } from 'react';
import QuotesList from './QuotesList';
import QuoteDetail from './QuoteDetail';
import { QuoteBuilder } from './QuoteBuilder';

interface QuotesManagerProps {
  initialCustomerId?: string;
  onCustomerIdConsumed?: () => void;
}

export function QuotesManager({ initialCustomerId, onCustomerIdConsumed }: QuotesManagerProps = {}) {
  const [view, setView] = useState<'list' | 'detail' | 'edit' | 'create'>('list');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [preselectedCustomerId, setPreselectedCustomerId] = useState<string | undefined>(initialCustomerId);

  useEffect(() => {
    if (initialCustomerId) {
      setView('create');
      setPreselectedCustomerId(initialCustomerId);
      if (onCustomerIdConsumed) {
        onCustomerIdConsumed();
      }
    }
  }, [initialCustomerId, onCustomerIdConsumed]);

  const handleSelectQuote = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setView('detail');
  };

  const handleEditQuote = (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    setView('edit');
  };

  const handleCreateQuote = () => {
    setSelectedQuoteId(null);
    setPreselectedCustomerId(undefined);
    setView('create');
  };

  const handleBack = () => {
    setSelectedQuoteId(null);
    setPreselectedCustomerId(undefined);
    setView('list');
  };

  if (view === 'detail' && selectedQuoteId) {
    return (
      <QuoteDetail
        quoteId={selectedQuoteId}
        onBack={handleBack}
        onEdit={() => handleEditQuote(selectedQuoteId)}
      />
    );
  }

  if (view === 'edit' || view === 'create') {
    return (
      <QuoteBuilder
        quoteId={selectedQuoteId || undefined}
        initialCustomerId={preselectedCustomerId}
        onSave={() => {
          if (view === 'edit' && selectedQuoteId) {
            setView('detail');
          } else {
            handleBack();
          }
        }}
        onCancel={() => {
          if (view === 'edit' && selectedQuoteId) {
            setView('detail');
          } else {
            handleBack();
          }
        }}
      />
    );
  }

  return (
    <QuotesList
      onSelectQuote={handleSelectQuote}
      onCreateQuote={handleCreateQuote}
      onEditQuote={handleEditQuote}
    />
  );
}
