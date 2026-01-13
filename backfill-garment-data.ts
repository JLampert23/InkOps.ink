import { createClient } from '@supabase/supabase-js';
import { parseGarmentInfo } from './src/utils/garment-parser';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillGarmentData() {
  console.log('Starting garment data backfill...\n');

  let processedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let offset = 0;
  const batchSize = 100;

  while (true) {
    const { data: lineItems, error } = await supabase
      .from('printavo_line_items')
      .select('id, description, name, sku')
      .is('extracted_style', null)
      .range(offset, offset + batchSize - 1)
      .order('id');

    if (error) {
      console.error('Error fetching line items:', error);
      break;
    }

    if (!lineItems || lineItems.length === 0) {
      break;
    }

    console.log(`Processing batch ${Math.floor(offset / batchSize) + 1} (${lineItems.length} items)...`);

    for (const item of lineItems) {
      processedCount++;

      const textToParse = [item.name, item.description, item.sku]
        .filter(Boolean)
        .join(' ');

      if (!textToParse.trim()) {
        continue;
      }

      try {
        const garmentInfo = parseGarmentInfo(textToParse);

        if (garmentInfo.style || garmentInfo.color || Object.keys(garmentInfo.sizes).length > 0) {
          const { error: updateError } = await supabase
            .from('printavo_line_items')
            .update({
              extracted_style: garmentInfo.style,
              extracted_color: garmentInfo.color,
              extracted_sizes: garmentInfo.sizes,
            })
            .eq('id', item.id);

          if (updateError) {
            console.error(`Error updating line item ${item.id}:`, updateError);
            errorCount++;
          } else {
            updatedCount++;
            if (updatedCount % 10 === 0) {
              console.log(`  ✓ Updated ${updatedCount} line items so far...`);
            }
          }
        }
      } catch (err) {
        console.error(`Error parsing line item ${item.id}:`, err);
        errorCount++;
      }
    }

    if (lineItems.length < batchSize) {
      break;
    }

    offset += batchSize;
  }

  console.log('\n=== Backfill Complete ===');
  console.log(`Total processed: ${processedCount}`);
  console.log(`Successfully updated: ${updatedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Skipped (no data): ${processedCount - updatedCount - errorCount}`);
}

backfillGarmentData()
  .then(() => {
    console.log('\n✅ Backfill completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  });
