import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { hasValidConfig } from './lib/supabase-client.ts';
import { hideInitialLoader } from './utils/loader.ts';
import './index.css';

function ConfigError() {
  useEffect(() => {
    hideInitialLoader();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-6 text-center">
        <h1 className="text-xl font-bold text-red-400 mb-2">Configuration Error</h1>
        <p className="text-slate-400">
          Missing Supabase configuration. Please ensure environment variables are set correctly.
        </p>
      </div>
    </div>
  );
}

function AppWrapper() {
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
    rootElement.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;padding:20px"><div style="max-width:400px;background:#1e293b;border:1px solid #334155;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);padding:24px;text-align:center"><h1 style="font-size:20px;font-weight:bold;color:#f1f5f9;margin-bottom:8px">Failed to Load</h1><p style="color:#94a3b8;margin-bottom:16px">The application failed to initialize.</p><button onclick="window.location.reload()" style="padding:8px 20px;background:#f97316;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600">Retry</button></div></div>';
  }
}
