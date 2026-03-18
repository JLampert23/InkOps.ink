import { useEffect, useRef, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

export interface PromptOptions {
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: 'text' | 'email' | 'tel' | 'number' | 'password';
  required?: boolean;
  validator?: (value: string) => string | null;
}

interface PromptModalProps extends PromptOptions {
  isOpen: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptModal({
  isOpen,
  title,
  message,
  placeholder = '',
  defaultValue = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  inputType = 'text',
  required = false,
  validator,
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError(null);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    inputRef.current?.focus();
    inputRef.current?.select();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onCancel]);

  const handleSubmit = () => {
    const trimmedValue = value.trim();

    if (required && !trimmedValue) {
      setError('This field is required');
      return;
    }

    if (validator) {
      const validationError = validator(trimmedValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    onConfirm(trimmedValue);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-40 transition-opacity" />

        <div
          ref={modalRef}
          className="relative bg-white rounded-xl shadow-2xl max-w-md w-full transform transition-all"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-title"
        >
          <div className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h3 id="prompt-title" className="text-lg font-semibold text-gray-900 mb-2">
                  {title}
                </h3>
                <div className="text-sm text-gray-600 whitespace-pre-line mb-4">
                  {message}
                </div>
              </div>

              <button
                onClick={onCancel}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <input
                ref={inputRef}
                type={inputType}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                placeholder={placeholder}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {cancelLabel}
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
