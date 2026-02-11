import { useState } from 'react';
import { Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase-client';

interface ImageFixResult {
  success: boolean;
  message: string;
  details?: any;
}

export default function FixChipplyImages() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ImageFixResult[]>([]);

  const checkBucketExists = async (): Promise<boolean> => {
    try {
      // Try to list files in the bucket to see if it exists
      const { error } = await supabase.storage
        .from('chipply-garment-images')
        .list('', { limit: 1 });

      if (error) {
        console.error('Bucket check error:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Bucket check exception:', error);
      return false;
    }
  };

  const downloadAndStoreImage = async (
    imageUrl: string,
    lineItemId: string,
    imageType: 'front' | 'rear' | 'side'
  ): Promise<{ success: boolean; url?: string; error?: string }> => {
    try {
      // Download the image from the original URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return { success: false, error: `Failed to download: ${response.statusText}` };
      }

      const blob = await response.blob();

      // Generate filename
      const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const timestamp = Date.now();
      const filename = `${lineItemId}_${imageType}_${timestamp}.${ext}`;

      // Get company ID from current user
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();

      if (!profile) {
        return { success: false, error: 'Profile not found' };
      }

      const storagePath = `${profile.company_id}/${filename}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('chipply-garment-images')
        .upload(storagePath, blob, {
          contentType: blob.type || 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        return { success: false, error: uploadError.message };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chipply-garment-images')
        .getPublicUrl(storagePath);

      return { success: true, url: urlData.publicUrl };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const processAllImages = async () => {
    setIsProcessing(true);
    setResults([]);
    const newResults: ImageFixResult[] = [];

    // Step 1: Check if bucket exists
    const bucketExists = await checkBucketExists();
    if (!bucketExists) {
      newResults.push({
        success: false,
        message: 'Storage bucket "chipply-garment-images" does not exist. Please create it first.',
      });
      setResults(newResults);
      setIsProcessing(false);
      return;
    }

    newResults.push({
      success: true,
      message: '✓ Storage bucket exists',
    });

    // Step 2: Get all line items with external image URLs
    const { data: lineItems, error: fetchError } = await supabase
      .from('quote_line_items')
      .select('id, description, garment_image_url, garment_image_rear_url, garment_image_side_url')
      .or('garment_image_url.like.%chipply%,garment_image_rear_url.like.%chipply%,garment_image_side_url.like.%chipply%');

    if (fetchError) {
      newResults.push({
        success: false,
        message: `Failed to fetch line items: ${fetchError.message}`,
      });
      setResults(newResults);
      setIsProcessing(false);
      return;
    }

    if (!lineItems || lineItems.length === 0) {
      newResults.push({
        success: true,
        message: 'No Chipply images found that need to be downloaded',
      });
      setResults(newResults);
      setIsProcessing(false);
      return;
    }

    newResults.push({
      success: true,
      message: `Found ${lineItems.length} line items with Chipply images`,
    });
    setResults([...newResults]);

    // Step 3: Process each line item
    let successCount = 0;
    let errorCount = 0;

    for (const item of lineItems) {
      const updates: any = {};
      let hasChanges = false;

      // Process front image
      if (item.garment_image_url && item.garment_image_url.includes('chipply')) {
        const result = await downloadAndStoreImage(item.garment_image_url, item.id, 'front');
        if (result.success && result.url) {
          updates.garment_image_url = result.url;
          hasChanges = true;
          successCount++;
        } else {
          errorCount++;
          newResults.push({
            success: false,
            message: `Failed to process front image for ${item.description}: ${result.error}`,
          });
        }
      }

      // Process rear image
      if (item.garment_image_rear_url && item.garment_image_rear_url.includes('chipply')) {
        const result = await downloadAndStoreImage(item.garment_image_rear_url, item.id, 'rear');
        if (result.success && result.url) {
          updates.garment_image_rear_url = result.url;
          hasChanges = true;
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Process side image
      if (item.garment_image_side_url && item.garment_image_side_url.includes('chipply')) {
        const result = await downloadAndStoreImage(item.garment_image_side_url, item.id, 'side');
        if (result.success && result.url) {
          updates.garment_image_side_url = result.url;
          hasChanges = true;
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Update the database if we have changes
      if (hasChanges) {
        const { error: updateError } = await supabase
          .from('quote_line_items')
          .update(updates)
          .eq('id', item.id);

        if (updateError) {
          newResults.push({
            success: false,
            message: `Failed to update ${item.description}: ${updateError.message}`,
          });
        } else {
          newResults.push({
            success: true,
            message: `✓ Updated ${item.description}`,
          });
        }
        setResults([...newResults]);
      }
    }

    newResults.push({
      success: true,
      message: `✓ Processing complete: ${successCount} images downloaded, ${errorCount} errors`,
    });
    setResults([...newResults]);
    setIsProcessing(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Download className="w-6 h-6" />
          Fix Chipply Images
        </h2>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">What this does:</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>Finds all Chipply images that are linked externally</li>
            <li>Downloads each image from Chipply</li>
            <li>Uploads them to your Supabase Storage</li>
            <li>Updates the database with new Supabase URLs</li>
          </ul>
        </div>

        <button
          onClick={processAllImages}
          disabled={isProcessing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              Download and Fix All Images
            </>
          )}
        </button>

        {results.length > 0 && (
          <div className="mt-6 space-y-2 max-h-96 overflow-y-auto">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Results:</h3>
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  result.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm ${
                      result.success
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}>
                      {result.message}
                    </p>
                    {result.details && (
                      <pre className="text-xs mt-1 bg-black/5 p-2 rounded overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
