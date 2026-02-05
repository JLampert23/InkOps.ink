import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SanMarFTPClient } from '../_shared/sanmar-ftp-client.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ImageSyncResult {
  success: boolean;
  imagesProcessed: number;
  imagesUploaded: number;
  errors: string[];
}

/**
 * SanMar Image Sync Function
 *
 * Downloads product images from SanMar FTP and uploads them to Supabase Storage.
 * Creates entries in sanmar_image_map for CDN URL resolution.
 *
 * FTP Folders:
 * - /Images/EPDD/ (front/back model, front/back flat)
 * - /Images/SDL/ (color swatches, thumbnails, brand logos)
 */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get company_id from query params or use default
    const url = new URL(req.url);
    const companyId = url.searchParams.get('company_id');

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'company_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Starting SanMar image sync for company: ${companyId}`);

    // Get SanMar FTP credentials from company_settings
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('sanmar_username, sanmar_password_encrypted')
      .eq('company_id', companyId)
      .single();

    if (settingsError || !settings) {
      console.error('Failed to get SanMar credentials:', settingsError);
      return new Response(
        JSON.stringify({ error: 'SanMar credentials not configured' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Decrypt password using crypto-service
    const cryptoUrl = `${supabaseUrl}/functions/v1/crypto-service`;
    const decryptResponse = await fetch(cryptoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        data: settings.sanmar_password_encrypted,
      }),
    });

    if (!decryptResponse.ok) {
      throw new Error('Failed to decrypt SanMar password');
    }

    const { result: sanmarPassword } = await decryptResponse.json();

    // Initialize FTP client
    const ftpClient = new SanMarFTPClient(
      settings.sanmar_username,
      sanmarPassword
    );

    const result: ImageSyncResult = {
      success: true,
      imagesProcessed: 0,
      imagesUploaded: 0,
      errors: [],
    };

    try {
      await ftpClient.connect();

      // Sync EPDD images (model and flat shots)
      await syncEPDDImages(ftpClient, supabase, companyId, result);

      // Sync SDL images (color swatches, thumbnails, logos)
      await syncSDLImages(ftpClient, supabase, companyId, result);

    } finally {
      await ftpClient.disconnect();
    }

    console.log(`Image sync complete:`, result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in sanmar-image-sync:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Syncs EPDD images (model and flat shots)
 */
async function syncEPDDImages(
  ftpClient: SanMarFTPClient,
  supabase: any,
  companyId: string,
  result: ImageSyncResult
) {
  console.log('Syncing EPDD images...');

  try {
    const epddFiles = await ftpClient.listDirectory('/Images/EPDD/');

    for (const file of epddFiles) {
      if (file.type !== '-') continue; // Skip directories

      result.imagesProcessed++;

      try {
        // Parse filename to extract style, color, and image type
        const imageInfo = parseEPDDFilename(file.name);

        if (!imageInfo) {
          result.errors.push(`Could not parse EPDD filename: ${file.name}`);
          continue;
        }

        // Download image from FTP
        const imageBuffer = await ftpClient.downloadFile(`/Images/EPDD/${file.name}`);

        // Upload to Supabase Storage
        const storagePath = `${imageInfo.style}/${imageInfo.colorCode || 'default'}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('sanmar-images')
          .upload(storagePath, imageBuffer, {
            contentType: getContentType(file.name),
            upsert: true,
          });

        if (uploadError) {
          result.errors.push(`Upload failed for ${file.name}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('sanmar-images')
          .getPublicUrl(storagePath);

        // Save to sanmar_image_map
        const { error: dbError } = await supabase
          .from('sanmar_image_map')
          .upsert({
            company_id: companyId,
            style: imageInfo.style,
            color_code: imageInfo.colorCode,
            image_type: imageInfo.imageType,
            original_filename: file.name,
            cdn_url: urlData.publicUrl,
            file_size: file.size,
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'company_id,style,color_code,image_type,original_filename',
          });

        if (dbError) {
          result.errors.push(`DB insert failed for ${file.name}: ${dbError.message}`);
          continue;
        }

        result.imagesUploaded++;
      } catch (err) {
        result.errors.push(`Error processing ${file.name}: ${err.message}`);
      }
    }
  } catch (err) {
    result.errors.push(`Failed to list EPDD directory: ${err.message}`);
  }
}

/**
 * Syncs SDL images (color swatches, thumbnails, logos)
 */
async function syncSDLImages(
  ftpClient: SanMarFTPClient,
  supabase: any,
  companyId: string,
  result: ImageSyncResult
) {
  console.log('Syncing SDL images...');

  try {
    const sdlFiles = await ftpClient.listDirectory('/Images/SDL/');

    for (const file of sdlFiles) {
      if (file.type !== '-') continue; // Skip directories

      result.imagesProcessed++;

      try {
        // Parse filename to extract style, color, and image type
        const imageInfo = parseSDLFilename(file.name);

        if (!imageInfo) {
          result.errors.push(`Could not parse SDL filename: ${file.name}`);
          continue;
        }

        // Download image from FTP
        const imageBuffer = await ftpClient.downloadFile(`/Images/SDL/${file.name}`);

        // Upload to Supabase Storage
        const storagePath = `${imageInfo.style}/${imageInfo.colorCode || 'default'}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('sanmar-images')
          .upload(storagePath, imageBuffer, {
            contentType: getContentType(file.name),
            upsert: true,
          });

        if (uploadError) {
          result.errors.push(`Upload failed for ${file.name}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('sanmar-images')
          .getPublicUrl(storagePath);

        // Save to sanmar_image_map
        const { error: dbError } = await supabase
          .from('sanmar_image_map')
          .upsert({
            company_id: companyId,
            style: imageInfo.style,
            color_code: imageInfo.colorCode,
            image_type: imageInfo.imageType,
            original_filename: file.name,
            cdn_url: urlData.publicUrl,
            file_size: file.size,
            last_synced_at: new Date().toISOString(),
          }, {
            onConflict: 'company_id,style,color_code,image_type,original_filename',
          });

        if (dbError) {
          result.errors.push(`DB insert failed for ${file.name}: ${dbError.message}`);
          continue;
        }

        result.imagesUploaded++;
      } catch (err) {
        result.errors.push(`Error processing ${file.name}: ${err.message}`);
      }
    }
  } catch (err) {
    result.errors.push(`Failed to list SDL directory: ${err.message}`);
  }
}

/**
 * Parses EPDD filename to extract metadata
 * Examples:
 * - PC54_Kelly_model_front.jpg -> {style: 'PC54', colorCode: 'Kelly', imageType: 'front_model'}
 * - PC54_Kelly_flat_back.jpg -> {style: 'PC54', colorCode: 'Kelly', imageType: 'back_flat'}
 */
function parseEPDDFilename(filename: string): {
  style: string;
  colorCode: string | null;
  imageType: string;
} | null {
  const parts = filename.replace(/\.(jpg|jpeg|png|gif)$/i, '').split('_');

  if (parts.length < 3) return null;

  const style = parts[0];
  const colorCode = parts[1];

  // Determine image type from filename
  let imageType = 'front_model';

  if (filename.includes('_model_front')) {
    imageType = 'front_model';
  } else if (filename.includes('_model_back')) {
    imageType = 'back_model';
  } else if (filename.includes('_flat_front')) {
    imageType = 'front_flat';
  } else if (filename.includes('_flat_back')) {
    imageType = 'back_flat';
  }

  return { style, colorCode, imageType };
}

/**
 * Parses SDL filename to extract metadata
 * Examples:
 * - PC54_Kelly_swatch.jpg -> {style: 'PC54', colorCode: 'Kelly', imageType: 'color_swatch'}
 * - PC54_thumbnail.jpg -> {style: 'PC54', colorCode: null, imageType: 'thumbnail'}
 */
function parseSDLFilename(filename: string): {
  style: string;
  colorCode: string | null;
  imageType: string;
} | null {
  const parts = filename.replace(/\.(jpg|jpeg|png|gif)$/i, '').split('_');

  if (parts.length < 2) return null;

  const style = parts[0];
  let colorCode: string | null = null;
  let imageType = 'thumbnail';

  if (filename.includes('_swatch')) {
    imageType = 'color_swatch';
    colorCode = parts[1];
  } else if (filename.includes('_thumbnail')) {
    imageType = 'thumbnail';
  } else if (filename.includes('_logo')) {
    imageType = 'brand_logo';
  }

  return { style, colorCode, imageType };
}

/**
 * Gets content type from filename extension
 */
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
