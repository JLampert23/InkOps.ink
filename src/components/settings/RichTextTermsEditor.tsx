import { useState, useEffect, useRef, useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { Save, Eye, Code, Loader2, Check } from 'lucide-react';

interface RichTextTermsEditorProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  onSave?: () => Promise<void>;
  placeholder?: string;
  saving?: boolean;
}

export default function RichTextTermsEditor({
  label,
  description,
  value,
  onChange,
  onSave,
  placeholder = 'Enter terms...',
  saving = false,
}: RichTextTermsEditorProps) {
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const quillRef = useRef<ReactQuill>(null);

  const sanitizeHTML = (html: string): string => {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u',
        'ul', 'ol', 'li',
        'a', 'span'
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
      ALLOWED_STYLES: {
        '*': {
          'font-weight': [/^(?:normal|bold|\d{3})$/],
          'font-style': [/^(?:normal|italic)$/],
          'text-decoration': [/^(?:none|underline)$/],
        }
      }
    });
  };

  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const handleChange = (content: string) => {
    const sanitized = sanitizeHTML(content);
    onChange(sanitized);
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave();
      setSaveStatus('saved');
    }
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        ['bold', 'italic', 'underline'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link'],
        ['clean']
      ],
    },
  }), []);

  const formats = [
    'bold', 'italic', 'underline',
    'list', 'bullet',
    'link'
  ];

  const getPreviewHTML = () => {
    if (!value || value === '<p><br></p>') return '';
    return sanitizeHTML(value);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
              <Check className="w-4 h-4" />
              <span>Saved</span>
            </div>
          )}

          <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'editor'
                  ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'editor' ? (
        <div className="border border-gray-300 dark:border-slate-600 rounded-lg overflow-hidden rich-terms-editor">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={value}
            onChange={handleChange}
            modules={modules}
            formats={formats}
            placeholder={placeholder}
            className="bg-white dark:bg-slate-800"
          />
        </div>
      ) : (
        <div className="border border-gray-300 dark:border-slate-600 rounded-lg p-4 bg-gray-50 dark:bg-slate-700 min-h-[120px]">
          {getPreviewHTML() ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
              dangerouslySetInnerHTML={{ __html: getPreviewHTML() }}
            />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No content to preview
            </p>
          )}
        </div>
      )}

      {onSave && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save {label}
            </>
          )}
        </button>
      )}

      <style>{`
        .rich-terms-editor .ql-toolbar {
          background: rgb(249, 250, 251);
          border-bottom: 1px solid rgb(209, 213, 219);
          padding: 8px;
        }
        .dark .rich-terms-editor .ql-toolbar {
          background: rgb(30, 41, 59);
          border-bottom-color: rgb(71, 85, 105);
        }
        .rich-terms-editor .ql-container {
          font-size: 14px;
          min-height: 120px;
        }
        .dark .rich-terms-editor .ql-container {
          background: rgb(30, 41, 59);
          color: white;
        }
        .dark .rich-terms-editor .ql-editor.ql-blank::before {
          color: rgb(148, 163, 184);
        }
        .rich-terms-editor .ql-editor {
          padding: 12px;
        }
        .dark .rich-terms-editor .ql-stroke {
          stroke: rgb(148, 163, 184);
        }
        .dark .rich-terms-editor .ql-fill {
          fill: rgb(148, 163, 184);
        }
        .dark .rich-terms-editor .ql-picker-label {
          color: rgb(148, 163, 184);
        }
        .dark .rich-terms-editor .ql-picker-options {
          background: rgb(30, 41, 59);
          border-color: rgb(71, 85, 105);
        }
        .dark .rich-terms-editor .ql-picker-item {
          color: rgb(203, 213, 225);
        }
        .dark .rich-terms-editor .ql-picker-item:hover {
          color: white;
        }
      `}</style>
    </div>
  );
}
