import { readFileSync } from 'fs';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  process.exit(1);
}

async function applyMigration() {
  console.log('Reading migration file...');
  const sql = readFileSync('./PRODUCTION_COMPLETE_MIGRATION.sql', 'utf8');

  console.log(`Applying ${sql.length} characters of SQL...`);
  console.log('This may take a few minutes...\n');

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql_query: sql })
    });

    if (!response.ok) {
      // Try direct SQL execution via postgres API
      console.log('RPC method not available, trying direct SQL execution...');

      const pgResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sql',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=representation'
        },
        body: sql
      });

      if (!pgResponse.ok) {
        const errorText = await pgResponse.text();
        console.error('Error applying migration:', errorText);
        process.exit(1);
      }
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('\nPlease wait 30 seconds for PostgREST to reload the schema.');
    console.log('Then refresh your application to see the changes.');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

applyMigration();
