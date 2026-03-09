import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ChipplyEndpointSettings {
  auth_type: 'basic' | 'api_key';
  username: string;
  password: string;
  api_key: string;
}

async function downloadAndStoreImages(supabase: any, payload: any, companyId: string): Promise<any> {
  try {
    // Extract the work order data
    const workOrderData = Array.isArray(payload) ? payload[0]?.workOrderData : payload?.workOrderData;

    if (!workOrderData?.processes) {
      console.log('[IMAGE] No processes found in payload');
      return payload;
    }

    const processes = workOrderData.processes;

    for (let i = 0; i < processes.length; i++) {
      const process = processes[i];
      const products = process.products || [];

      for (let j = 0; j < products.length; j++) {
        const product = products[j];
        const colors = product.productColors || [];

        for (let k = 0; k < colors.length; k++) {
          const color = colors[k];

          // Download and store each image type
          if (color.image1Url) {
            const newUrl = await downloadAndStoreImage(supabase, color.image1Url, companyId, 'front', i, j, k);
            if (newUrl) color.image1Url = newUrl;
          }

          if (color.image2Url) {
            const newUrl = await downloadAndStoreImage(supabase, color.image2Url, companyId, 'rear', i, j, k);
            if (newUrl) color.image2Url = newUrl;
          }

          if (color.image3Url) {
            const newUrl = await downloadAndStoreImage(supabase, color.image3Url, companyId, 'side', i, j, k);
            if (newUrl) color.image3Url = newUrl;
          }
        }
      }

      // Download and store artwork images from components
      const components = process.components || [];
      for (let c = 0; c < components.length; c++) {
        const component = components[c];
        const artworkVariations = component.artworkVariations || [];

        for (let v = 0; v < artworkVariations.length; v++) {
          const variation = artworkVariations[v];

          if (variation.imageSrc) {
            const newUrl = await downloadAndStoreArtwork(supabase, variation.imageSrc, companyId, i, c, v);
            if (newUrl) variation.imageSrc = newUrl;
          }
        }
      }
    }

    return payload;
  } catch (error) {
    console.error('[IMAGE] Error processing images:', error);
    return payload;
  }
}

async function downloadAndStoreImage(
  supabase: any,
  imageUrl: string,
  companyId: string,
  imageType: string,
  processIdx: number,
  productIdx: number,
  colorIdx: number
): Promise<string | null> {
  try {
    console.log(`[IMAGE] Downloading ${imageType} image from: ${imageUrl}`);

    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[IMAGE] Failed to download: ${response.status} ${response.statusText}`);
      return null;
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Generate filename
    const timestamp = Date.now();
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const filename = `${timestamp}_p${processIdx}_pr${productIdx}_c${colorIdx}_${imageType}.${ext}`;
    const storagePath = `${companyId}/${filename}`;

    console.log(`[IMAGE] Uploading to storage path: ${storagePath}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('chipply-garment-images')
      .upload(storagePath, buffer, {
        contentType: blob.type || 'image/jpeg',
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error(`[IMAGE] Upload error:`, error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chipply-garment-images')
      .getPublicUrl(storagePath);

    console.log(`[IMAGE] Successfully stored at: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error(`[IMAGE] Error downloading/storing image:`, error);
    return null;
  }
}

async function downloadAndStoreArtwork(
  supabase: any,
  artworkUrl: string,
  companyId: string,
  processIdx: number,
  componentIdx: number,
  variationIdx: number
): Promise<string | null> {
  try {
    console.log(`[ARTWORK] Downloading artwork from: ${artworkUrl}`);

    // Download the artwork
    const response = await fetch(artworkUrl);
    if (!response.ok) {
      console.error(`[ARTWORK] Failed to download: ${response.status} ${response.statusText}`);
      return null;
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Generate filename
    const timestamp = Date.now();
    const ext = artworkUrl.split('.').pop()?.split('?')[0] || 'png';
    const filename = `${timestamp}_p${processIdx}_c${componentIdx}_v${variationIdx}_artwork.${ext}`;
    const storagePath = `${companyId}/artwork/${filename}`;

    console.log(`[ARTWORK] Uploading to storage path: ${storagePath}`);

    // Upload to Supabase Storage (using same bucket for now)
    const { data, error } = await supabase.storage
      .from('chipply-garment-images')
      .upload(storagePath, buffer, {
        contentType: blob.type || 'image/png',
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error(`[ARTWORK] Upload error:`, error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chipply-garment-images')
      .getPublicUrl(storagePath);

    console.log(`[ARTWORK] Successfully stored at: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error(`[ARTWORK] Error downloading/storing artwork:`, error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse incoming payload
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Extract company_id from payload (assuming Chipply sends it, or we map it)
    // For now, we'll need to identify the company from the auth credentials
    // Since we're using Basic Auth or API Key, we need to fetch all companies' settings
    // and match against the provided credentials

    const authHeader = req.headers.get('Authorization');

    console.log('[DEBUG] Received Authorization header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'null');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch all chipply endpoint settings from system_settings
    const { data: allSettings, error: settingsError } = await supabase
      .from('system_settings')
      .select('company_id, value')
      .eq('namespace', 'chipply')
      .eq('key', 'endpoint');

    if (settingsError || !allSettings || allSettings.length === 0) {
      console.error('Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'No Chipply integration configured' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[DEBUG] Found ${allSettings.length} company settings`);

    // Try to authenticate against each company's settings
    let authenticatedCompanyId: string | null = null;
    let debugInfo: string[] = [];

    for (const setting of allSettings) {
      const config = setting.value as ChipplyEndpointSettings;

      if (config.auth_type === 'basic') {
        // Basic Auth format: "Basic base64(username:password)"
        if (authHeader.startsWith('Basic ')) {
          const base64Creds = authHeader.substring(6);
          const decoded = atob(base64Creds);
          const [username, password] = decoded.split(':');

          console.log(`[DEBUG] Basic Auth - Expected username: ${config.username}, Got: ${username}`);
          debugInfo.push(`Basic Auth - Username match: ${username === config.username}, Password match: ${password === config.password}`);

          if (username === config.username && password === config.password) {
            authenticatedCompanyId = setting.company_id;
            break;
          }
        } else {
          debugInfo.push(`Auth header doesn't start with "Basic "`);
        }
      } else if (config.auth_type === 'api_key') {
        // API Key format: "Bearer <api_key>" or just the key
        const providedKey = authHeader.startsWith('Bearer ')
          ? authHeader.substring(7)
          : authHeader;

        console.log(`[DEBUG] API Key - Provided key length: ${providedKey.length}, Expected key length: ${config.api_key.length}`);
        debugInfo.push(`API Key - Match: ${providedKey === config.api_key}`);

        if (providedKey === config.api_key) {
          authenticatedCompanyId = setting.company_id;
          break;
        }
      }
    }

    if (!authenticatedCompanyId) {
      console.log('[DEBUG] Authentication failed:', debugInfo.join('; '));
      return new Response(
        JSON.stringify({
          error: 'Invalid credentials',
          debug: debugInfo.join('; ')
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Download and store images before processing
    console.log('[DEBUG] Starting image download and storage');
    const processedPayload = await downloadAndStoreImages(supabase, payload, authenticatedCompanyId);
    console.log('[DEBUG] Image processing completed');

    // Successfully authenticated - log the import
    const { data: logData, error: insertError } = await supabase
      .from('chipply_import_logs')
      .insert({
        company_id: authenticatedCompanyId,
        received_at: new Date().toISOString(),
        raw_json: processedPayload,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !logData) {
      console.error('Error inserting log:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to log import' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process the import immediately
    const { error: processError } = await supabase.rpc('process_chipply_import', {
      log_id: logData.id
    });

    if (processError) {
      console.error('Error processing import:', processError);
      return new Response(
        JSON.stringify({
          status: 'received_but_processing_failed',
          error: processError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: 'processed',
        import_log_id: logData.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
