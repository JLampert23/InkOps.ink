import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { Save, Eye, Code, ChevronDown, Check, Loader2, Blocks } from 'lucide-react';
import { AVAILABLE_SHORT_CODES, type ShortCodeKey } from '../../types/shortcode';
import { ShortCodeEngine } from '../../services/shortcode-service';
import { useNotification } from '../../contexts/NotificationContext';
import SmartBlocksSidebar from './SmartBlocksSidebar';
import { type SmartBlock } from '../../types/smart-blocks';

interface RichTextEmailEditorProps {
  initialSubject?: string;
  initialBody?: string;
  onSave?: (subject: string, body: string) => void;
  onAutoSave?: (subject: string, body: string) => void;
  showSmartBlocks?: boolean;
  autoSaveDelay?: number;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function RichTextEmailEditor({
  initialSubject = '',
  initialBody = '',
  onSave,
  onAutoSave,
  showSmartBlocks = true,
  autoSaveDelay = 2000,
}: RichTextEmailEditorProps) {
  const { showNotification } = useNotification();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);
  const [variableSearch, setVariableSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showBlocksSidebar, setShowBlocksSidebar] = useState(showSmartBlocks);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lastFocusedField, setLastFocusedField] = useState<'subject' | 'body'>('body');

  const quillRef = useRef<ReactQuill>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Sanitize HTML to prevent XSS
  const sanitizeHTML = (html: string): string => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'div', 'span', 'br', 'strong', 'em', 'u', 's',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'blockquote', 'pre', 'code',
        'hr'
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
        'style', 'class', 'align'
      ],
      ALLOWED_STYLES: {
        '*': {
          'color': [/^#[0-9a-fA-F]{3,6}$/],
          'background-color': [/^#[0-9a-fA-F]{3,6}$/],
          'font-size': [/^\d+(?:px|em|rem|%)$/],
          'font-weight': [/^(?:normal|bold|\d{3})$/],
          'text-align': [/^(?:left|center|right|justify)$/],
          'margin': [/.*/],
          'padding': [/.*/],
        }
      }
    });
  };

  // Filter variables by search term
  const filteredVariables = useMemo(() => {
    if (!variableSearch) {
      return Object.entries(AVAILABLE_SHORT_CODES);
    }
    return Object.entries(AVAILABLE_SHORT_CODES).filter(([key, label]) =>
      key.toLowerCase().includes(variableSearch.toLowerCase()) ||
      label.toLowerCase().includes(variableSearch.toLowerCase())
    );
  }, [variableSearch]);

  // Group variables by category
  const groupedVariables = useMemo(() => {
    const groups: Record<string, Array<[string, string]>> = {
      customer: [],
      quote: [],
      invoice: [],
      company: [],
      user: [],
      payment: [],
      general: [],
    };

    filteredVariables.forEach(([key, label]) => {
      if (key.startsWith('customer_')) groups.customer.push([key, label]);
      else if (key.startsWith('quote_')) groups.quote.push([key, label]);
      else if (key.startsWith('invoice_')) groups.invoice.push([key, label]);
      else if (key.startsWith('company_')) groups.company.push([key, label]);
      else if (key.startsWith('user_')) groups.user.push([key, label]);
      else if (key.startsWith('payment_')) groups.payment.push([key, label]);
      else groups.general.push([key, label]);
    });

    return groups;
  }, [filteredVariables]);

  // Auto-save functionality
  useEffect(() => {
    if (!onAutoSave) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (subject.trim() && body.trim()) {
      setSaveStatus('idle');
      autoSaveTimerRef.current = setTimeout(() => {
        setSaveStatus('saving');
        try {
          const sanitizedBody = sanitizeHTML(body);
          onAutoSave(subject, sanitizedBody);
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }
      }, autoSaveDelay);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [subject, body, onAutoSave, autoSaveDelay]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowVariableDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Insert variable into editor
  const insertVariable = (key: string) => {
    const shortCode = `{{${key}}}`;

    // Check which field was last focused to determine where to insert
    if (lastFocusedField === 'subject') {
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
        showNotification('success', 'Variable Inserted', `${shortCode} added to subject`);
      }
    } else {
      // Insert into body
      const quill = quillRef.current?.getEditor();
      if (quill) {
        const range = quill.getSelection();
        const position = range ? range.index : quill.getLength();
        quill.insertText(position, shortCode);
        quill.setSelection(position + shortCode.length, 0);
        quill.focus();
        showNotification('success', 'Variable Inserted', `${shortCode} added to template`);
      }
    }

    setShowVariableDropdown(false);
    setVariableSearch('');
  };

  // Insert variable into subject
  const insertVariableIntoSubject = (key: string) => {
    const shortCode = `{{${key}}}`;
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

    setShowVariableDropdown(false);
    setVariableSearch('');
    showNotification('success', 'Variable Inserted', `${shortCode} added to subject`);
  };

  // Insert smart block into editor
  const insertBlock = (block: SmartBlock) => {
    const quill = quillRef.current?.getEditor();

    if (quill) {
      const range = quill.getSelection();
      const position = range ? range.index : quill.getLength();

      // Insert the HTML content
      const delta = quill.clipboard.convert(block.htmlTemplate);
      quill.updateContents(delta, 'user');

      // Move cursor to end of inserted content
      quill.setSelection(position + delta.length(), 0);
      quill.focus();

      showNotification('success', 'Block Inserted', `${block.name} added to template`);
    }
  };

  // Handle drag over editor
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  // Handle drag leave editor
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  // Handle drop into editor
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const blockData = e.dataTransfer.getData('application/json');
      if (blockData) {
        const block: SmartBlock = JSON.parse(blockData);
        insertBlock(block);
      }
    } catch (error) {
      console.error('Failed to parse dropped block:', error);
    }
  };

  // Manual save
  const handleSave = () => {
    if (!subject.trim()) {
      showNotification('error', 'Subject Required', 'Please enter an email subject');
      return;
    }
    if (!body.trim()) {
      showNotification('error', 'Body Required', 'Please enter an email body');
      return;
    }

    const sanitizedBody = sanitizeHTML(body);
    onSave?.(subject, sanitizedBody);
  };

  // Generate preview with sample data
  const generatePreview = () => {
    const previewSubject = ShortCodeEngine.generatePreview(subject);
    const previewBody = sanitizeHTML(ShortCodeEngine.generatePreview(body));

    return { subject: previewSubject, body: previewBody };
  };

  // Quill modules configuration
  const modules = useMemo(() => ({
    toolbar: {
      container: '#toolbar',
    },
  }), []);

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet', 'indent',
    'link', 'image',
    'align',
    'clean'
  ];

  const preview = viewMode === 'preview' ? generatePreview() : null;

  return (
    <div className="flex gap-4">
      {/* Main Editor Content */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Header with Controls */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Email Template
            </h3>

            <div className="flex items-center gap-3">
            {/* Save Status Indicator */}
            {onAutoSave && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {saveStatus === 'saving' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                )}
                {saveStatus === 'saved' && (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-green-600 dark:text-green-400">Saved</span>
                  </>
                )}
                {saveStatus === 'error' && (
                  <span className="text-red-600 dark:text-red-400">Save failed</span>
                )}
              </div>
            )}

            {/* Smart Blocks Toggle - Show on Right */}
            {showSmartBlocks && viewMode === 'editor' && (
              <button
                onClick={() => setShowBlocksSidebar(!showBlocksSidebar)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  showBlocksSidebar
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600'
                }`}
              >
                <Blocks className="w-4 h-4" />
                Smart Blocks
              </button>
            )}

            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('editor')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                  viewMode === 'editor'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Code className="w-4 h-4" />
                Editor
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
            </div>

            {/* Manual Save Button */}
            {onSave && (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            )}
          </div>
        </div>
        </div>

        {/* Subject Field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Subject
          </label>
          <input
            ref={subjectRef}
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => setLastFocusedField('subject')}
            placeholder="Enter email subject..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            disabled={viewMode === 'preview'}
          />
          {viewMode === 'preview' && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-gray-700 dark:text-gray-300">
              <strong className="text-blue-900 dark:text-blue-100">Preview:</strong>{' '}
              {preview?.subject || <span className="italic text-gray-500 dark:text-gray-400">No subject entered</span>}
            </div>
          )}
        </div>

        {/* Preview Banner */}
        {viewMode === 'preview' && (
          <div className="bg-blue-600 text-white px-4 py-3 rounded-lg flex items-center gap-3">
            <Eye className="w-5 h-5" />
            <div>
              <div className="font-semibold">Preview Mode</div>
              <div className="text-xs text-blue-100">Showing how your email will look with sample data</div>
            </div>
          </div>
        )}

        {/* Body Editor / Preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Email Body
          </label>

          {viewMode === 'editor' ? (
            <div
              ref={editorContainerRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border rounded-lg overflow-hidden transition-all ${
                isDragOver
                  ? 'border-blue-500 dark:border-blue-400 border-2 bg-blue-50 dark:bg-blue-900/10'
                  : 'border-gray-300 dark:border-slate-600'
              }`}
            >
              {/* Drag Overlay */}
              {isDragOver && (
                <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center pointer-events-none z-10">
                  <div className="bg-white dark:bg-slate-800 px-6 py-4 rounded-lg shadow-lg border-2 border-blue-500 dark:border-blue-400">
                    <p className="text-blue-600 dark:text-blue-400 font-semibold">
                      Drop block here to insert
                    </p>
                  </div>
                </div>
              )}

              {/* Custom Toolbar */}
              <div id="toolbar" className="bg-gray-50 dark:bg-slate-800 border-b border-gray-300 dark:border-slate-600 p-2 flex items-center gap-2 flex-wrap">
                <select className="ql-header" defaultValue="">
                  <option value="1">Heading 1</option>
                  <option value="2">Heading 2</option>
                  <option value="3">Heading 3</option>
                  <option value="4">Heading 4</option>
                  <option value="">Normal</option>
                </select>

                <button className="ql-bold" />
                <button className="ql-italic" />
                <button className="ql-underline" />
                <button className="ql-strike" />

                <span className="w-px h-6 bg-gray-300 dark:bg-slate-600" />

                <select className="ql-color" />
                <select className="ql-background" />

                <span className="w-px h-6 bg-gray-300 dark:bg-slate-600" />

                <button className="ql-list" value="ordered" />
                <button className="ql-list" value="bullet" />

                <span className="w-px h-6 bg-gray-300 dark:bg-slate-600" />

                <button className="ql-link" />

                <span className="w-px h-6 bg-gray-300 dark:bg-slate-600" />

                <button className="ql-clean" />
              </div>

              {/* Quill Editor */}
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={body}
                onChange={setBody}
                onFocus={() => setLastFocusedField('body')}
                modules={modules}
                formats={formats}
                placeholder="Start typing your email content..."
                className="rich-text-editor"
              />
            </div>
          ) : (
            <div className="border border-gray-300 dark:border-slate-600 rounded-lg p-6 bg-white dark:bg-slate-800 min-h-[400px]">
              {preview?.body ? (
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: preview.body }}
                />
              ) : (
                <div className="text-gray-500 dark:text-gray-400 italic">
                  No content to preview. Add some text to the email body to see a preview.
                </div>
              )}
            </div>
          )}

          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {viewMode === 'editor'
              ? 'Use the toolbar to format your email. Drag and drop Smart Blocks for prebuilt content sections.'
              : 'Preview shows how your email will look with sample data.'}
          </div>
        </div>

        {/* Help Text */}
        {showSmartBlocks && viewMode === 'editor' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Using Smart Blocks
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Toggle Smart Blocks to access prebuilt content sections. Drag and drop blocks into your email template to quickly build professional emails.
            </p>
          </div>
        )}
      </div>

      {/* Smart Blocks Sidebar - Show on Right when toggled */}
      {showSmartBlocks && showBlocksSidebar && viewMode === 'editor' && (
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-4 h-[calc(100vh-8rem)] overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
            <SmartBlocksSidebar onBlockSelect={insertBlock} onShortCodeClick={insertVariable} />
          </div>
        </div>
      )}
    </div>
  );
}
