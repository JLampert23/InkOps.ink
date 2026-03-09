// Test if the Stripe webhook secret can be decrypted successfully
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envContent = readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDecryption() {
  console.log('🔍 Testing Stripe webhook secret decryption...\n');

  // Get the encrypted webhook secret from database
  const { data, error } = await supabase
    .from('company_settings')
    .select('stripe_webhook_secret')
    .maybeSingle();

  if (error) {
    console.error('❌ Database error:', error.message);
    return;
  }

  if (!data?.stripe_webhook_secret) {
    console.log('⚠️  No webhook secret found in database');
    console.log('   Please configure Stripe in Account Settings first');
    return;
  }

  console.log('✅ Webhook secret exists in database');
  console.log(`   Length: ${data.stripe_webhook_secret.length} characters`);
  console.log(`   Preview: ${data.stripe_webhook_secret.substring(0, 30)}...\n`);

  // Try to decrypt it
  console.log('🔐 Attempting to decrypt...');
  const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      action: 'decrypt',
      token: data.stripe_webhook_secret,
    }),
  });

  const decryptResult = await decryptResponse.json();

  if (!decryptResponse.ok || !decryptResult.success) {
    console.error('❌ DECRYPTION FAILED!');
    console.error('   Error:', decryptResult.error);
    console.log('\n💡 SOLUTION:');
    console.log('   Go to Account Settings → Integrations → Stripe Payments');
    console.log('   Re-enter your Stripe webhook secret and click Save');
    console.log('   This will re-encrypt it with the current encryption key\n');
    return;
  }

  console.log('✅ DECRYPTION SUCCESSFUL!');
  console.log(`   Decrypted value starts with: ${decryptResult.result.substring(0, 10)}...\n`);
  console.log('🎉 Your webhook should work now!');
}

testDecryption();
