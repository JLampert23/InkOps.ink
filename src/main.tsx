import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { hasValidConfig } from './lib/supabase-client.ts';
import './index.css';

function ConfigError() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <h1 className="text-xl font-bold text-red-600 mb-2">Configuration Error</h1>
        <p className="text-gray-600">
          Missing Supabase configuration. Please ensure environment variables are set correctly.
        </p>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        {hasValidConfig ? <App /> : <ConfigError />}
      </ErrorBoundary>
    </StrictMode>
  );
}
