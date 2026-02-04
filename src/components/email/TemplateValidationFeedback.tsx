import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import type { TemplateValidation } from '../../types/communication-template';

interface TemplateValidationFeedbackProps {
  validation: TemplateValidation | null;
  show: boolean;
}

export function TemplateValidationFeedback({
  validation,
  show,
}: TemplateValidationFeedbackProps) {
  if (!show || !validation) return null;

  const hasErrors = validation.errors.length > 0;
  const hasMissingRequired = validation.missingRequiredCodes.length > 0;
  const hasWarnings = validation.warnings.length > 0 && !hasMissingRequired;
  const isValid = validation.isValid && !hasMissingRequired;

  if (isValid && !hasWarnings) {
    return (
      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-green-800">Template is valid</p>
          <p className="text-xs text-green-600 mt-1">
            All required short codes are present and syntax is correct.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {hasErrors && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 mb-1">Errors found</p>
              <ul className="space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index} className="text-xs text-red-700 flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {hasMissingRequired && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-800 mb-2">
                Missing required short codes
              </p>
              <div className="space-y-2">
                {validation.missingRequiredCodes.map((missing, index) => (
                  <div
                    key={index}
                    className="bg-white border border-orange-200 rounded p-2"
                  >
                    <div className="flex items-start gap-2">
                      <code className="text-xs font-mono text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        {`{{${missing.code}}}`}
                      </code>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700">{missing.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-orange-600 mt-2">
                These short codes must be added before the template can be used to send emails.
              </p>
            </div>
          </div>
        </div>
      )}

      {hasWarnings && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800 mb-1">Warnings</p>
              <ul className="space-y-1">
                {validation.warnings.map((warning, index) => (
                  <li key={index} className="text-xs text-yellow-700 flex items-start gap-1.5">
                    <span className="text-yellow-400 mt-0.5">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RequiredShortCodeTooltipProps {
  code: string;
  reason: string;
  children: React.ReactNode;
}

export function RequiredShortCodeTooltip({
  code,
  reason,
  children,
}: RequiredShortCodeTooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Required: {`{{${code}}}`}</p>
                <p className="text-gray-300">{reason}</p>
              </div>
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
