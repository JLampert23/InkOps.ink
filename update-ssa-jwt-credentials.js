// Update SSActivewear credentials to use JWT authentication
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env file
const envFile = readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function updateCredentials() {
  try {
    // First, encrypt the JWT token
    const jwtToken = '1adb78cb-cbf0-46e7-878d-6fd87f08d3f4';
    const accountNumber = '54074';

    console.log('Encrypting JWT token...');
    const encryptResponse = await fetch(
      `${env.VITE_SUPABASE_URL}/functions/v1/crypto-service`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'encrypt',
          token: jwtToken,
        }),
      }
    );

    if (!encryptResponse.ok) {
      const errorText = await encryptResponse.text();
      console.error('Encryption failed:', errorText);
      return;
    }

    const { result: encryptedToken } = await encryptResponse.json();
    console.log('Token encrypted successfully');

    // Update the database
    console.log('\nUpdating integration_settings...');
    const { data, error } = await supabase
      .from('integration_settings')
      .update({
        ssactivewear_enabled: true,
        ssactivewear_credentials: {
          accountNumber: accountNumber,
          apiKey: encryptedToken,
          authType: 'jwt' // Add this to indicate JWT auth
        }
      })
      .eq('company_id', (await supabase.from('companies').select('id').limit(1).single()).data.id);

    if (error) {
      console.error('Update failed:', error);
      return;
    }

    console.log('✅ Credentials updated successfully!');
    console.log('Account Number:', accountNumber);
    console.log('Auth Type: JWT');

  } catch (error) {
    console.error('Error:', error);
  }
}

updateCredentials();
