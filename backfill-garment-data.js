import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function parseGarmentInfo(text) {
  if (!text || typeof text !== 'string') {
    return { style: null, color: null, sizes: {} };
  }

  const upperText = text.toUpperCase();

  let style = null;
  const stylePatterns = [
    /\b(GILDAN\s+\d+[A-Z]*)\b/i,
    /\b(BELLA[\s+]CANVAS\s+\d+[A-Z]*)\b/i,
    /\b(NEXT\s+LEVEL\s+\d+[A-Z]*)\b/i,
    /\b(COMFORT\s+COLORS?\s+\d+[A-Z]*)\b/i,
    /\b(HANES\s+\d+[A-Z]*)\b/i,
    /\b(JERZEES\s+\d+[A-Z]*)\b/i,
    /\b(PORT\s+(?:&\s+)?COMPANY\s+[A-Z]+\d+[A-Z]*)\b/i,
    /\b(ALTERNATIVE\s+\d+[A-Z]*)\b/i,
    /\b([A-Z]{2,}\s*\d{3,5}[A-Z]*)\b/i,
  ];

  for (const pattern of stylePatterns) {
    const match = text.match(pattern);
    if (match) {
      style = match[1].trim();
      break;
    }
  }

  let color = null;
  const colorPatterns = [
    /(?:COLOR|COLOUR):\s*([A-Z][A-Z\s]+?)(?:\s*[-,]|\s*\d|\s*$)/i,
    /\b(BLACK|WHITE|NAVY|GRAY|GREY|RED|BLUE|GREEN|YELLOW|ORANGE|PURPLE|PINK|BROWN|MAROON|CARDINAL|ROYAL|FOREST|KELLY|LIGHT BLUE|DARK|HEATHER|CHARCOAL|OLIVE|TAN|BEIGE|KHAKI|CREAM|GOLD|SILVER|NATURAL|SAND)\b/i,
    /\b(HEATHER\s+[A-Z]+)\b/i,
    /\b(LIGHT\s+[A-Z]+)\b/i,
    /\b(DARK\s+[A-Z]+)\b/i,
  ];

  for (const pattern of colorPatterns) {
    const match = text.match(pattern);
    if (match) {
      color = match[1].trim();
      break;
    }
  }

  const sizes = {};
  const sizePattern = /\b(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|6XL)\s*[-:x×]?\s*(\d+)/gi;
  let sizeMatch;
  while ((sizeMatch = sizePattern.exec(text)) !== null) {
    const size = sizeMatch[1].toUpperCase();
    const quantity = parseInt(sizeMatch[2], 10);
    sizes[size] = (sizes[size] || 0) + quantity;
  }

  const standalonePattern = /\b(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|6XL)(?![A-Z])\b/gi;
  const foundSizes = text.match(standalonePattern);
  if (foundSizes && Object.keys(sizes).length === 0) {
    foundSizes.forEach(size => {
      const normalizedSize = size.toUpperCase();
      sizes[normalizedSize] = (sizes[normalizedSize] || 0) + 1;
    });
  }

  return {
    style,
    color,
    sizes: Object.keys(sizes).length > 0 ? sizes : {},
  };
}

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
      .select('id, description')
      .range(offset, offset + batchSize - 1);

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

      const textToParse = item.description || '';

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
              extracted_sizes: Object.keys(garmentInfo.sizes).length > 0 ? garmentInfo.sizes : null,
              parsed_at: new Date().toISOString(),
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
