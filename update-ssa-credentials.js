import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

const CORRECT_API_KEY = '1adb78cb-cbf0-46e7-878d-6fd87f08d3f4';
const CORRECT_ACCOUNT_NUMBER = '54074';

async function updateCredentials() {
  console.log('\n=== Updating SSActivewear Credentials ===\n');
  console.log('API Key to store:', CORRECT_API_KEY);
  console.log('Account Number:', CORRECT_ACCOUNT_NUMBER);

  // First, let's encrypt the API key using the crypto service
  console.log('\nEncrypting API key...');
  
  const encryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      action: 'encrypt',
      value: CORRECT_API_KEY,
    }),
  });

  if (!encryptResponse.ok) {
    const errorText = await encryptResponse.text();
    console.error('Encryption failed:', errorText);
    return;
  }

  const { result: encryptedKey } = await encryptResponse.json();
  console.log('✅ API key encrypted successfully');
  console.log('Encrypted value length:', encryptedKey.length);

  console.log('\n📋 Next steps:');
  console.log('1. Log in to your app');
  console.log('2. Go to Account Settings');
  console.log('3. Scroll to Supplier Integrations > SSActivewear');
  console.log('4. Enter these credentials:');
  console.log('   - Account Number: ' + CORRECT_ACCOUNT_NUMBER);
  console.log('   - API Key: ' + CORRECT_API_KEY);
  console.log('5. Enable the integration and click Save');
  console.log('6. Click "Test Connection" to verify');
}

updateCredentials();
