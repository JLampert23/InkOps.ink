/**
 * Manual Catalog Sync Test Script
 *
 * This script manually triggers the S&S catalog sync and displays results.
 *
 * Usage:
 *   node test-manual-catalog-sync.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('  - VITE_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🚀 Triggering S&S Catalog Sync...\n');
console.log(`📍 Supabase URL: ${supabaseUrl}`);

async function testCatalogSync() {
  try {
    // Call the sync edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/sync-ss-catalog`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);

    const data = await response.json();

    if (response.ok) {
      console.log('\n✅ Sync completed successfully!\n');
      console.log('Results:');
      console.log(`  - Total Companies: ${data.result?.totalCompanies || 0}`);
      console.log(`  - Total Styles: ${data.result?.totalStyles || 0}`);
      console.log(`  - Successful: ${data.result?.successCount || 0}`);
      console.log(`  - Failed: ${data.result?.failureCount || 0}`);

      if (data.result?.errors && data.result.errors.length > 0) {
        console.log('\n⚠️ Errors:');
        data.result.errors.forEach(err => {
          console.log(`  - ${err.styleNumber}: ${err.error}`);
        });
      }
    } else {
      console.error('\n❌ Sync failed!');
      console.error('Error:', data.error || data.message);
      if (data.details) {
        console.error('Details:', data.details);
      }
    }

    // Check catalog tables
    console.log('\n\n📋 Checking catalog tables...');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: counts, error: countsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          (SELECT COUNT(*) FROM styles) as styles_count,
          (SELECT COUNT(*) FROM parts) as parts_count,
          (SELECT COUNT(*) FROM inventory) as inventory_count,
          (SELECT COUNT(*) FROM images) as images_count
      `
    });

    if (!countsError && counts) {
      console.log('\nCatalog table counts:');
      console.log(`  - Styles: ${counts[0]?.styles_count || 0}`);
      console.log(`  - Parts: ${counts[0]?.parts_count || 0}`);
      console.log(`  - Inventory: ${counts[0]?.inventory_count || 0}`);
      console.log(`  - Images: ${counts[0]?.images_count || 0}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

testCatalogSync();
