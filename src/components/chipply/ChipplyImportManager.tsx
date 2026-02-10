import { useState } from 'react';
import { Settings, FileText, Package, ArrowRight } from 'lucide-react';

type ChipplyView = 'home' | 'settings' | 'imports';

export function ChipplyImportManager() {
  const [activeView, setActiveView] = useState<ChipplyView>('home');

  if (activeView === 'settings') {
    return (
      <ChipplySettings onBack={() => setActiveView('home')} />
    );
  }

  if (activeView === 'imports') {
    return (
      <ChipplyImports onBack={() => setActiveView('home')} />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Chipply Import Manager
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage inbound Chipply Work Order &rarr; Quote imports.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setActiveView('settings')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm"
        >
          <Settings className="w-4 h-4" />
          Integration Settings
        </button>
        <button
          onClick={() => setActiveView('imports')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors shadow-sm font-medium text-sm"
        >
          <FileText className="w-4 h-4" />
          View Imported Quotes
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm">
        <div className="p-10 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mb-4">
            <Package className="w-7 h-7 text-teal-600 dark:text-teal-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Chipply integration is ready
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
            Configure your endpoint to begin receiving imports.
          </p>
        </div>
      </div>
    </div>
  );
}

function ChipplySettings({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Integration Settings
        </h1>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm p-10 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-4">
          <Settings className="w-7 h-7 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Settings coming soon
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
          Chipply integration settings will be configured here.
        </p>
      </div>
    </div>
  );
}

function ChipplyImports({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Imported Quotes
        </h1>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm p-10 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-4">
          <FileText className="w-7 h-7 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No imports yet
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
          Imported Chipply quotes will appear here once the integration is active.
        </p>
      </div>
    </div>
  );
}
