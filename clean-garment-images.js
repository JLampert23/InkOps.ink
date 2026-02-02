import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file manually
const envContent = readFileSync(resolve(__dirname, '.env'), 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length) {
    envVars[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function filterValidImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter(img => {
    if (!img) return false;
    if (typeof img !== 'string') return false;
    const trimmed = img.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return false;
    return true;
  });
}

function cleanImagesData(data) {
  if (!data || typeof data !== 'object') return null;

  return {
    frontImages: filterValidImages(data.frontImages),
    rearImages: filterValidImages(data.rearImages),
    sideImages: filterValidImages(data.sideImages),
    lifestyleImages: filterValidImages(data.lifestyleImages),
    otherImages: filterValidImages(data.otherImages),
    allImages: filterValidImages(data.allImages),
  };
}

async function cleanGarmentImages() {
  console.log('Fetching all quote line items with garment images data...');

  const { data: lineItems, error } = await supabase
    .from('quote_line_items')
    .select('id, garment_images_data')
    .not('garment_images_data', 'is', null);

  if (error) {
    console.error('Error fetching line items:', error);
    return;
  }

  console.log(`Found ${lineItems.length} line items with garment images data`);

  let updatedCount = 0;
  let unchangedCount = 0;

  for (const item of lineItems) {
    const cleanedData = cleanImagesData(item.garment_images_data);

    // Check if anything changed
    const original = JSON.stringify(item.garment_images_data);
    const cleaned = JSON.stringify(cleanedData);

    if (original !== cleaned) {
      console.log(`Updating line item ${item.id}`);
      console.log('  Before:', item.garment_images_data);
      console.log('  After:', cleanedData);

      const { error: updateError } = await supabase
        .from('quote_line_items')
        .update({ garment_images_data: cleanedData })
        .eq('id', item.id);

      if (updateError) {
        console.error(`Error updating line item ${item.id}:`, updateError);
      } else {
        updatedCount++;
      }
    } else {
      unchangedCount++;
    }
  }

  console.log('\nCleanup complete!');
  console.log(`Updated: ${updatedCount}`);
  console.log(`Unchanged: ${unchangedCount}`);
  console.log(`Total: ${lineItems.length}`);
}

cleanGarmentImages()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
