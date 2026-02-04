import React from 'react';
import { AlertTriangle, X, FileEdit, CheckCircle2 } from 'lucide-react';
import type { TemplateValidation } from '../../types/communication-template';

interface MissingShortCodesWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  validation: TemplateValidation;
  onFixTemplate: () => void;
  onSaveAnyway: () => void;
  canOverride: boolean;
  actionType: 'save' | 'send';
}

export function MissingShortCodesWarningModal({
  isOpen,
  onClose,
  validation,
  onFixTemplate,
  onSaveAnyway,
  canOverride,
  actionType,
}: MissingShortCodesWarningModalProps) {
  if (!isOpen) return null;

  const hasErrors = validation.errors.length > 0;
  const hasMissingRequired = validation.missingRequiredCodes.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {hasErrors ? 'Template Validation Failed' : 'Missing Required Short Codes'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {hasErrors
                  ? 'Please fix the errors before continuing'
                  : `Your template is missing required short codes for ${actionType === 'send' ? 'sending' : 'saving'}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {hasErrors && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-900 mb-2">Errors</h3>
              <ul className="space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-700 flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasMissingRequired && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-orange-900 mb-3">
                Missing Required Short Codes
              </h3>
              <div className="space-y-3">
                {validation.missingRequiredCodes.map((missing, index) => (
                  <div
                    key={index}
                    className="bg-white border border-orange-200 rounded-lg p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="px-2 py-1 bg-orange-100 rounded text-xs font-mono text-orange-800">
                          {`{{${missing.code}}}`}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{missing.reason}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Add this short code to your subject or body template
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {validation.warnings.length > 0 && !hasMissingRequired && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">Warnings</h3>
              <ul className="space-y-1">
                {validation.warnings.map((warning, index) => (
                  <li key={index} className="text-sm text-yellow-700 flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Why are these required?</h4>
            <p className="text-sm text-blue-700">
              Required short codes ensure critical information is included when emails are sent.
              For example, customers need the quote link to approve their quote, and invoice
              numbers are essential for payment tracking.
            </p>
          </div>

          {!canOverride && hasMissingRequired && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Note:</span> Templates with missing required short
                codes cannot be used to send emails until they are added. You can save the template
                as inactive for now and complete it later.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={onFixTemplate}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <FileEdit className="w-4 h-4" />
            Fix Template
          </button>

          {canOverride && (hasMissingRequired || !hasErrors) && (
            <button
              onClick={onSaveAnyway}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${
                hasErrors
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
              disabled={hasErrors}
              title={hasErrors ? 'Fix errors before saving' : 'Admin override: Save anyway'}
            >
              <CheckCircle2 className="w-4 h-4" />
              {actionType === 'send' ? 'Send Anyway' : 'Save Anyway'}
              {!hasErrors && <span className="text-xs opacity-75">(Admin)</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
