import React, { useState, useRef } from 'react';
import { Save, Send, Eye, Code } from 'lucide-react';
import ShortCodePicker from './ShortCodePicker';
import { ShortCodeEngine } from '../../services/shortcode-service';
import { useNotification } from '../../contexts/NotificationContext';

interface EmailTemplateEditorProps {
  initialSubject?: string;
  initialBody?: string;
  onSave?: (subject: string, body: string) => void;
  onSend?: (subject: string, body: string) => void;
  showShortCodes?: boolean;
}

export default function EmailTemplateEditor({
  initialSubject = '',
  initialBody = '',
  onSave,
  onSend,
  showShortCodes = true,
}: EmailTemplateEditorProps) {
  const { showNotification } = useNotification();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [showPicker, setShowPicker] = useState(false);
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body');
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertShortCode = (shortCode: string) => {
    if (activeField === 'subject') {
      const input = subjectRef.current;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const newSubject = subject.substring(0, start) + shortCode + subject.substring(end);
        setSubject(newSubject);
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + shortCode.length, start + shortCode.length);
        }, 0);
      }
    } else {
      const textarea = bodyRef.current;
      if (textarea) {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const newBody = body.substring(0, start) + shortCode + body.substring(end);
        setBody(newBody);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + shortCode.length, start + shortCode.length);
        }, 0);
      }
    }
  };

  const handleSave = () => {
    if (!subject.trim()) {
      showNotification('error', 'Subject Required', 'Please enter an email subject');
      return;
    }
    if (!body.trim()) {
      showNotification('error', 'Body Required', 'Please enter an email body');
      return;
    }
    onSave?.(subject, body);
  };

  const handleSend = () => {
    if (!subject.trim()) {
      showNotification('error', 'Subject Required', 'Please enter an email subject');
      return;
    }
    if (!body.trim()) {
      showNotification('error', 'Body Required', 'Please enter an email body');
      return;
    }
    onSend?.(subject, body);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Editor */}
      <div className={showShortCodes ? 'lg:col-span-2' : 'lg:col-span-3'}>
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Email Template
            </h3>
            <div className="flex items-center gap-2">
              {showShortCodes && (
                <button
                  onClick={() => setShowPicker(!showPicker)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                    showPicker
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  Short Codes
                </button>
              )}
              {onSave && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              )}
              {onSend && (
                <button
                  onClick={handleSend}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subject
            </label>
            <input
              ref={subjectRef}
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setActiveField('subject')}
              placeholder="Enter email subject..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              You can use short codes like {'{{'} {'{customer_first_name}'} {'}}'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Body (HTML supported)
            </label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => setActiveField('body')}
              placeholder="Enter email body... HTML tags are supported."
              rows={15}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              HTML formatting is supported. Use short codes for dynamic content.
            </div>
          </div>

          {/* Quick Start Templates */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Start Templates
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setSubject('Quote {{quote_number}} - {{customer_company}}');
                  setBody(`<p>Hi {{customer_first_name}},</p>

<p>Thank you for your interest! Please find your quote below:</p>

<p><strong>Quote Number:</strong> {{quote_number}}<br/>
<strong>Total:</strong> {{quote_total}}<br/>
<strong>Valid Until:</strong> {{quote_expiry_date}}</p>

<p><a href="{{quote_link}}">Click here to review and approve your quote</a></p>

<p>If you have any questions, please don't hesitate to reach out.</p>

<p>Best regards,<br/>
{{user_name}}<br/>
{{company_name}}</p>`);
                }}
                className="px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors"
              >
                Quote Template
              </button>
              <button
                onClick={() => {
                  setSubject('Invoice {{invoice_number}} - {{customer_company}}');
                  setBody(`<p>Hi {{customer_first_name}},</p>

<p>Your invoice is ready for payment:</p>

<p><strong>Invoice Number:</strong> {{invoice_number}}<br/>
<strong>Total:</strong> {{invoice_total}}<br/>
<strong>Balance Due:</strong> {{invoice_balance}}<br/>
<strong>Due Date:</strong> {{invoice_due_date}}</p>

<p><a href="{{invoice_link}}">Click here to view and pay your invoice</a></p>

<p>Thank you for your business!</p>

<p>Best regards,<br/>
{{user_name}}<br/>
{{company_name}}</p>`);
                }}
                className="px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors"
              >
                Invoice Template
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Short Code Picker */}
      {showShortCodes && showPicker && (
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-4 sticky top-4">
            <ShortCodePicker
              onInsert={handleInsertShortCode}
              currentTemplate={activeField === 'subject' ? subject : body}
            />
          </div>
        </div>
      )}
    </div>
  );
}
