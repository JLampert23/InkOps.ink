import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file
const envFile = readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const quoteId = 'd77adbda-cd90-4ac6-be44-e3ac3f6f8416';

async function checkQuoteData() {
  console.log('Checking quote data for:', quoteId);
  console.log('\n=== LINE ITEMS ===');

  const { data: lineItems, error: liError } = await supabase
    .from('quote_line_items')
    .select('id, item_number, description, garment_color, group_label, garment_front_image_url, garment_images_data')
    .eq('quote_id', quoteId)
    .order('sort_order');

  if (liError) {
    console.error('Error loading line items:', liError);
  } else {
    lineItems.forEach((item, idx) => {
      console.log(`\nLine Item ${idx + 1}:`);
      console.log('  ID:', item.id);
      console.log('  Item Number:', item.item_number);
      console.log('  Color:', item.garment_color);
      console.log('  Group Label:', item.group_label || '(empty)');
      console.log('  Has Front Image:', !!item.garment_front_image_url);
      console.log('  Has Images Data:', !!item.garment_images_data);
      if (item.garment_images_data) {
        console.log('  Color Variants:', item.garment_images_data.colorVariants?.length || 0);
      }
    });
  }

  console.log('\n=== IMPRINTS ===');
  const { data: imprints, error: impError } = await supabase
    .from('quote_imprints')
    .select('id, location, type_of_work, group_label')
    .eq('quote_id', quoteId)
    .order('sort_order');

  if (impError) {
    console.error('Error loading imprints:', impError);
  } else {
    imprints.forEach((imp, idx) => {
      console.log(`\nImprint ${idx + 1}:`);
      console.log('  ID:', imp.id);
      console.log('  Location:', imp.location);
      console.log('  Type of Work:', imp.type_of_work);
      console.log('  Group Label:', imp.group_label || '(empty)');
    });
  }
}

checkQuoteData();
