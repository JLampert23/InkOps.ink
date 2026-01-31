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

async function updateGarmentImages() {
  console.log('Fetching line items for quote:', quoteId);

  const { data: lineItems, error } = await supabase
    .from('quote_line_items')
    .select('id, item_number, color, supplier_partid')
    .eq('quote_id', quoteId)
    .not('item_number', 'is', null);

  if (error) {
    console.error('Error fetching line items:', error);
    return;
  }

  console.log(`Found ${lineItems.length} line items to update\n`);

  for (const item of lineItems) {
    console.log(`\nUpdating ${item.item_number} - ${item.color}`);
    console.log(`Part ID: ${item.supplier_partid}`);

    if (!item.supplier_partid) {
      console.log('  ⚠️  No supplier part ID, skipping');
      continue;
    }

    try {
      // Call the edge function to get unified product data
      const style = item.item_number.trim();
      const url = `${env.VITE_SUPABASE_URL}/functions/v1/promostandards-unified?style=${encodeURIComponent(style)}&partId=${encodeURIComponent(item.supplier_partid)}`;

      console.log(`  Fetching from: ${url}`);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      if (!response.ok) {
        console.log(`  ❌ Failed: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      if (data.success && data.media?.views) {
        const updates = {
          garment_front_image_url: data.media.views.front || null,
          garment_back_image_url: data.media.views.back || null,
          garment_sleeve_image_url: data.media.views.left || data.media.views.right || null,
          garment_images_data: data.media.images || null,
        };

        console.log('  Images found:');
        console.log(`    Front:  ${updates.garment_front_image_url ? '✓' : '✗'}`);
        console.log(`    Back:   ${updates.garment_back_image_url ? '✓' : '✗'}`);
        console.log(`    Sleeve: ${updates.garment_sleeve_image_url ? '✓' : '✗'}`);
        console.log(`    Total images: ${data.media.images?.length || 0}`);

        // Update the database
        const { error: updateError } = await supabase
          .from('quote_line_items')
          .update(updates)
          .eq('id', item.id);

        if (updateError) {
          console.log(`  ❌ Update failed:`, updateError);
        } else {
          console.log('  ✅ Updated successfully');
        }
      } else {
        console.log('  ⚠️  No media data available');
      }
    } catch (err) {
      console.error(`  ❌ Error:`, err.message);
    }
  }

  console.log('\n✅ Update complete!');
}

updateGarmentImages();
