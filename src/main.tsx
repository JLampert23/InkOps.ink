import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { hasValidConfig } from './lib/supabase-client.ts';
import './index.css';

function hideInitialLoader() {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 300);
  }
}

function ConfigError() {
  useEffect(() => {
    hideInitialLoader();
  }, []);

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

function AppWrapper() {
  useEffect(() => {
    hideInitialLoader();
  }, []);

  return <App />;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  hideInitialLoader();
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          {hasValidConfig ? <AppWrapper /> : <ConfigError />}
        </ErrorBoundary>
      </StrictMode>
    );
  } catch (err) {
    console.error('Failed to render app:', err);
    hideInitialLoader();
    rootElement.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;padding:20px"><div style="max-width:400px;background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);padding:24px;text-align:center"><h1 style="font-size:20px;font-weight:bold;color:#111;margin-bottom:8px">Failed to Load</h1><p style="color:#666;margin-bottom:16px">The application failed to initialize.</p><button onclick="window.location.reload()" style="padding:8px 20px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600">Retry</button></div></div>';
  }
}
