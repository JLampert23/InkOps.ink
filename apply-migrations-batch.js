import { readFileSync } from 'fs';

// Load environment variables
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
const anonKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

async function applyMigration() {
  console.log('\n📖 Reading migration file...');
  const sql = readFileSync('./PRODUCTION_COMPLETE_MIGRATION.sql', 'utf8');

  console.log(`📝 Size: ${(sql.length / 1024).toFixed(2)} KB`);
  console.log(`📝 Lines: ${sql.split('\n').length}`);
  console.log('\n🚀 Applying all 149 pending migrations...');
  console.log('⏱️  This will take 2-3 minutes...\n');

  try {
    // Use the PostgREST API to execute raw SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Response:', errorText);

      console.log('\n💡 Please apply manually via Supabase Dashboard:');
      console.log(`   1. Open: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/').replace('.supabase.co', '')}/sql/new`);
      console.log('   2. Copy contents of: PRODUCTION_COMPLETE_MIGRATION.sql');
      console.log('   3. Paste and click "Run"');
      console.log('   4. Wait 30 seconds for schema reload\n');
      process.exit(1);
    }

    const result = await response.json();
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

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Please apply manually via Supabase Dashboard:');
    const projectId = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
    console.log(`   1. Open: https://supabase.com/dashboard/project/${projectId}/sql/new`);
    console.log('   2. Copy contents of: PRODUCTION_COMPLETE_MIGRATION.sql');
    console.log('   3. Paste and click "Run"');
    console.log('   4. Wait 30 seconds for schema reload\n');
    process.exit(1);
  }
}

applyMigration();
