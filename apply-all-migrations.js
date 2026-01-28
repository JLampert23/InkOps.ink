import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigrations() {
  const migrationsDir = './supabase/migrations';
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    try {
      console.log(`\nApplying: ${file}`);
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf8');

      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        console.error(`  ❌ Error: ${error.message}`);
        // Continue with next migration
      } else {
        console.log(`  ✓ Applied successfully`);
      }
    } catch (err) {
      console.error(`  ❌ Exception: ${err.message}`);
    }
  }

  console.log('\n\nMigration process complete!');
}

applyMigrations();
