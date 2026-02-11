import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cuaukcvccxvfpuxaciac.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjA4NTQsImV4cCI6MjA4MjEzNjg1NH0.I-FDsR0oezVPxKcWgFmV-MMolV6E-lYcoA7Ew8ZgKYU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  console.log('🔍 Checking Supabase Storage...\n');

  // 1. List all buckets
  console.log('1. Listing all buckets:');
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    console.error('❌ Error listing buckets:', bucketsError);
    return;
  }

  console.log(`✅ Found ${buckets.length} buckets:`);
  buckets.forEach(bucket => {
    console.log(`  - ${bucket.id} (public: ${bucket.public})`);
  });

  // 2. Check if chipply-garment-images exists
  const chipplyBucket = buckets.find(b => b.id === 'chipply-garment-images');
  if (!chipplyBucket) {
    console.log('\n❌ Bucket "chipply-garment-images" does NOT exist!');
    console.log('   This bucket needs to be created.');
    return;
  }

  console.log('\n✅ Bucket "chipply-garment-images" exists!');
  console.log('   Details:', JSON.stringify(chipplyBucket, null, 2));

  // 3. List files in the bucket
  console.log('\n2. Listing files in chipply-garment-images:');
  const { data: files, error: filesError } = await supabase.storage
    .from('chipply-garment-images')
    .list('', { limit: 100, offset: 0 });

  if (filesError) {
    console.error('❌ Error listing files:', filesError);
    return;
  }

  console.log(`✅ Found ${files.length} items in root:`);
  files.forEach(file => {
    console.log(`  - ${file.name} (${file.id || 'folder'})`);
  });

  // 4. Check recent imports
  console.log('\n3. Checking recent Chipply imports:');
  const { data: imports, error: importsError } = await supabase
    .from('chipply_import_logs')
    .select('id, status, created_at, error_message')
    .order('created_at', { ascending: false })
    .limit(5);

  if (importsError) {
    console.error('❌ Error fetching imports:', importsError);
    return;
  }

  if (imports.length === 0) {
    console.log('   No imports found yet.');
  } else {
    console.log(`✅ Found ${imports.length} recent imports:`);
    imports.forEach(imp => {
      console.log(`  - ${imp.id}: ${imp.status} (${imp.created_at})`);
      if (imp.error_message) {
        console.log(`    Error: ${imp.error_message}`);
      }
    });
  }

  // 5. Check quote line items for images
  console.log('\n4. Checking quote line items with images:');
  const { data: lineItems, error: lineItemsError } = await supabase
    .from('quote_line_items')
    .select('id, description, garment_image_url, garment_image_rear_url, garment_image_side_url')
    .or('garment_image_url.not.is.null,garment_image_rear_url.not.is.null,garment_image_side_url.not.is.null')
    .limit(10);

  if (lineItemsError) {
    console.error('❌ Error fetching line items:', lineItemsError);
    return;
  }

  if (lineItems.length === 0) {
    console.log('   No line items with images found.');
  } else {
    console.log(`✅ Found ${lineItems.length} line items with images:`);
    lineItems.forEach(item => {
      console.log(`  - ${item.description}:`);
      if (item.garment_image_url) console.log(`    Front: ${item.garment_image_url}`);
      if (item.garment_image_rear_url) console.log(`    Rear: ${item.garment_image_rear_url}`);
      if (item.garment_image_side_url) console.log(`    Side: ${item.garment_image_side_url}`);
    });
  }
}

checkStorage().catch(console.error);
