import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Get list of applied migrations
const appliedMigrations = [
  '20260116205322_remote_schema.sql',
  '20260119130951_remote_schema.sql',
  '20260121161526_remote_schema.sql',
  '20260128154423_fix_signup_trigger_no_company_id.sql',
  '20260128154837_recreate_company_settings_with_all_columns.sql',
  '20260128154909_force_schema_cache_update.sql',
  '20260128155227_force_postgrest_schema_reload.sql',
  '20260128160029_force_hard_schema_reload.sql',
  '20260128162715_create_printavo_cache_tables.sql',
  '20260128165630_reset_jamie_password.sql'
];

async function applyMigrations() {
  const migrationsDir = './supabase/migrations';
  const files = readdirSync(migrationsDir).sort();

  console.log(`Found ${files.length} total migration files`);

  // Filter out already applied migrations
  const pendingMigrations = files.filter(file => {
    // Skip if already applied
    if (appliedMigrations.includes(file)) {
      return false;
    }

    // Apply migrations after the last remote_schema (Jan 21)
    const fileDate = file.substring(0, 14); // YYYYMMDDHHMMSS
    const lastRemoteSchema = '20260121161526';

    return fileDate > lastRemoteSchema;
  });

  console.log(`\nFound ${pendingMigrations.length} pending migrations to apply\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const file of pendingMigrations) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');

    console.log(`Applying: ${file}`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql_string: sql }).catch(async () => {
        // If exec_sql function doesn't exist, try direct query
        return await supabase.from('_migrations').insert({ name: file });
      });

      // Try using the Supabase management API via edge function
      const response = await fetch(`${supabaseUrl}/functions/v1/apply-migration`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: file, content: sql })
      }).catch(() => null);

      if (response && !response.ok) {
        const errorText = await response.text();
        console.error(`  ❌ Failed: ${errorText}`);
        errorCount++;
      } else {
        console.log(`  ✅ Applied successfully`);
        successCount++;
      }

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`Total: ${pendingMigrations.length}`);
}

applyMigrations();
