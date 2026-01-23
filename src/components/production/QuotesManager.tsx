import { useState } from 'react';
import QuotesList from './QuotesList';
import QuoteDetail from './QuoteDetail';

export function QuotesManager() {
  const [view, setView] = useState<'list' | 'detail' | 'edit' | 'create'>('list');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

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
    setView('create');
  };

  const handleBack = () => {
    setSelectedQuoteId(null);
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
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {view === 'create' ? 'Create Quote' : 'Edit Quote'}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Quote Editor component - Coming soon
        </p>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Quotes
        </button>
      </div>
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
