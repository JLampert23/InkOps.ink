import { useState, useEffect, useRef } from 'react';
import { X, File, Trash2, Upload, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface CustomerArtworkLibraryProps {
  customerId: string;
  onClose: () => void;
}

interface CustomerArtwork {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  width_inches: number | null;
  height_inches: number | null;
  tags: string[];
  uploaded_at: string;
}

export function CustomerArtworkLibrary({ customerId, onClose }: CustomerArtworkLibraryProps) {
  const [artwork, setArtwork] = useState<CustomerArtwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadArtwork();
  }, [customerId]);

  const loadArtwork = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_artwork')
        .select('*')
        .eq('customer_id', customerId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error loading artwork:', error);
        throw error;
      }
      setArtwork(data || []);
    } catch (error) {
      console.error('Failed to load artwork library:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArtwork = async (artworkId: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this artwork? This action cannot be undone.')) {
      return;
    }

    setDeleting(artworkId);
    try {
      const urlParts = fileUrl.split('/customer-artwork/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split('?')[0];

        const { error: storageError } = await supabase.storage
          .from('customer-artwork')
          .remove([filePath]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        }
      }

      const { error: dbError } = await supabase
        .from('customer_artwork')
        .delete()
        .eq('id', artworkId);

      if (dbError) {
        throw dbError;
      }

      setArtwork(artwork.filter(a => a.id !== artworkId));
    } catch (error) {
      console.error('Error deleting artwork:', error);
      alert('Failed to delete artwork');
    } finally {
      setDeleting(null);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to upload artwork');
        return;
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.company_id) {
        alert('Company ID not found');
        return;
      }

      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${userProfile.company_id}/${customerId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('customer-artwork')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('customer-artwork')
          .getPublicUrl(filePath);

        const { data: artworkRecord, error: dbError } = await supabase
          .from('customer_artwork')
          .insert({
            customer_id: customerId,
            company_id: userProfile.company_id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            tags: []
          })
          .select()
          .single();

        if (dbError) {
          console.error('Error creating artwork record:', dbError);
          throw dbError;
        }

        return artworkRecord;
      });

      const uploadedArtwork = await Promise.all(uploadPromises);
      setArtwork([...uploadedArtwork, ...artwork]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      alert(`Successfully uploaded ${uploadedArtwork.length} file(s)`);
    } catch (error) {
      console.error('Error uploading artwork:', error);
      alert('Failed to upload artwork. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-600">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Customer Artwork Library</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleFileSelect}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload Artwork
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.ai,.eps,.svg"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading artwork...</p>
              </div>
            </div>
          ) : artwork.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <File className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
              <p className="text-lg font-medium mb-1">No artwork uploaded yet</p>
              <p className="text-sm">Artwork will appear here once uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {artwork.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-slate-700 border-2 border-gray-200 dark:border-slate-600 rounded-lg p-3 hover:border-blue-500 hover:shadow-lg transition-all relative group"
                >
                  <button
                    onClick={() => handleDeleteArtwork(item.id, item.file_url)}
                    disabled={deleting === item.id}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-all shadow-lg disabled:opacity-50 z-10"
                    title="Delete artwork"
                  >
                    {deleting === item.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                  <div className="aspect-square bg-gray-100 dark:bg-slate-800 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {item.file_type.startsWith('image/') ? (
                      <img
                        src={item.file_url}
                        alt={item.file_name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <File className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={item.file_name}>
                    {item.file_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.width_inches && item.height_inches
                      ? `${item.width_inches}" × ${item.height_inches}"`
                      : 'No dimensions'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {new Date(item.uploaded_at).toLocaleDateString()}
                  </p>
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t dark:border-slate-600 bg-gray-50 dark:bg-slate-900 rounded-b-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {artwork.length} {artwork.length === 1 ? 'artwork' : 'artworks'} in library
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
