import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase-client';
import {
  Paperclip,
  Upload,
  Trash2,
  Download,
  FileText,
  Image,
  File,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface AttachmentsSectionProps {
  referenceType: 'quote' | 'work_order';
  referenceId: string;
  companyId: string;
}

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="w-5 h-5 text-gray-400" />;
  if (mimeType.startsWith('image/')) return <Image className="w-5 h-5 text-blue-400" />;
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
  return <File className="w-5 h-5 text-gray-400" />;
}

export function AttachmentsSection({ referenceType, referenceId, companyId }: AttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAttachments();
  }, [referenceId]);

  const loadAttachments = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('attachments')
        .select('id, file_name, file_path, file_size, mime_type, uploaded_by, created_at')
        .eq('reference_type', referenceType)
        .eq('reference_id', referenceId)
        .order('created_at', { ascending: false });

      if (err) throw err;
      setAttachments(data || []);
    } catch (err: any) {
      console.error('Error loading attachments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`);
        continue;
      }
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${companyId}/${referenceType}/${referenceId}/${Date.now()}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('attachments')
        .insert({
          company_id: companyId,
          reference_type: referenceType,
          reference_id: referenceId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user?.email || 'Unknown',
        });

      if (dbError) {
        // Cleanup orphaned storage file if DB insert fails
        await supabase.storage.from('attachments').remove([filePath]);
        throw dbError;
      }

      await loadAttachments();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error: err } = await supabase.storage
        .from('attachments')
        .createSignedUrl(attachment.file_path, 3600);

      if (err) throw err;
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      console.error('Download error:', err);
      setError('Could not generate download link. Please try again.');
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm(`Delete "${attachment.file_name}"?`)) return;

    setDeletingId(attachment.id);
    try {
      await supabase.storage.from('attachments').remove([attachment.file_path]);

      const { error: err } = await supabase
        .from('attachments')
        .delete()
        .eq('id', attachment.id);

      if (err) throw err;
      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
    } catch (err: any) {
      console.error('Delete error:', err);
      setError('Delete failed. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Attachments
            {attachments.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                ({attachments.length})
              </span>
            )}
          </h3>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {uploading ? 'Uploading...' : 'Upload File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ai,.eps,.psd"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : attachments.length === 0 ? (
        <div
          className="border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-7 h-7 text-gray-300 dark:text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Click to upload files
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Images, PDFs, Word, Excel — max {MAX_FILE_SIZE_MB}MB each
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map(att => (
            <div
              key={att.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg group"
            >
              <div className="flex-shrink-0">
                {fileIcon(att.mime_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {att.file_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatBytes(att.file_size)}
                  {att.uploaded_by && ` · ${att.uploaded_by}`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleDownload(att)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(att)}
                  disabled={deletingId === att.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === att.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
