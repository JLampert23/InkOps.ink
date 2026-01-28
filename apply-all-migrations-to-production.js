import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
const envFile = readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigrations() {
  console.log('📖 Reading migration file...');
  const sql = readFileSync('./PRODUCTION_COMPLETE_MIGRATION.sql', 'utf8');

  console.log(`📝 Migration file size: ${sql.length} characters`);
  console.log(`📝 Migration file lines: ${sql.split('\n').length}`);
  console.log('\n🚀 Applying all 149 pending migrations...');
  console.log('⏱️  This may take 2-3 minutes...\n');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      console.error('\nDetails:', error);
      process.exit(1);
    }

    console.log('\n✅ All migrations applied successfully!\n');
    console.log('📊 Database is now fully set up with:');
    console.log('   • Invoices & Payments tracking');
    console.log('   • Customers & Contacts management');
    console.log('   • Quotes & Line Items');
    console.log('   • Billing workflows & Stripe integration');
    console.log('   • Production scheduling');
    console.log('   • Automations & Reports');
    console.log('   • Security (RLS policies)');
    console.log('\n⏳ Please wait 30 seconds for PostgREST to reload the schema...');
    console.log('🔄 Then refresh your application to see all features.\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.stack) {
      console.error('\nStack trace:', err.stack);
    }
    process.exit(1);
  }
}

applyMigrations();
