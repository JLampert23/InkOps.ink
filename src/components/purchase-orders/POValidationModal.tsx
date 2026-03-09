import React, { useState } from 'react';
import { X, AlertCircle, MessageSquare } from 'lucide-react';

interface POValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  requiresJustification?: boolean;
  onConfirm?: (justification?: string) => void;
}

export function POValidationModal({
  isOpen,
  onClose,
  title,
  message,
  requiresJustification = false,
  onConfirm,
}: POValidationModalProps) {
  const [justification, setJustification] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requiresJustification && !justification.trim()) {
      alert('Please provide a justification for this action.');
      return;
    }
    onConfirm?.(justification);
    setJustification('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-4">{message}</p>

          {requiresJustification && (
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <MessageSquare className="w-4 h-4" />
                Justification Required
              </label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
                placeholder="Explain why this action is necessary..."
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This justification will be logged in the PO activity history.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            {requiresJustification ? 'Cancel' : 'Close'}
          </button>
          {requiresJustification && onConfirm && (
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
