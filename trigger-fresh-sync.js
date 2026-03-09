import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envContent = readFileSync(join(__dirname, '.env'), 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerSync() {
  console.log('🔄 Triggering fresh Printavo sync with new status filters...\n');

  try {
    const apiUrl = `${supabaseUrl}/functions/v1/printavo-sync`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'full' })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Sync triggered successfully!');
      console.log('Sync ID:', result.syncId);
      console.log('Status:', result.status);
      console.log('\nThe sync will now pull ONLY invoices with these statuses:');
      console.log('  - Billing Test Status');
      console.log('  - Sent to Accounting');
      console.log('\nMonitor progress in the printavo_sync_log table.');
    } else {
      console.error('❌ Failed to trigger sync:', result.error);
    }
  } catch (error) {
    console.error('Error triggering sync:', error);
    process.exit(1);
  }
}

triggerSync();
