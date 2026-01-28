import { readFileSync } from 'fs';

const envFile = readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

const JWT_TOKEN = '1adb78cb-cbf0-46e7-878d-6fd87f08d3f4';
const ACCOUNT_NUMBER = '54074';
const COMPANY_ID = '5f36fe64-8b67-4b62-a023-29590da87c41';

async function updateCredentials() {
  try {
    // Encrypt the JWT token
    console.log('Encrypting JWT token...');
    const encryptResponse = await fetch(
      `${env.VITE_SUPABASE_URL}/functions/v1/crypto-service`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'encrypt',
          token: JWT_TOKEN,
        }),
      }
    );

    if (!encryptResponse.ok) {
      const errorText = await encryptResponse.text();
      console.error('Encryption failed:', encryptResponse.status, errorText);
      return;
    }

    const encryptData = await encryptResponse.json();
    const encryptedToken = encryptData.result;

    console.log('Token encrypted successfully');
    console.log('Encrypted token (first 50 chars):', encryptedToken.substring(0, 50) + '...');

    // Update the database using SQL
    const updateSql = `
      UPDATE integration_settings
      SET ssactivewear_credentials = $1::jsonb
      WHERE company_id = $2
      RETURNING ssactivewear_enabled, ssactivewear_credentials->>'accountNumber' as account_number;
    `;

    const credentials = {
      accountNumber: ACCOUNT_NUMBER,
      apiKey: encryptedToken,
      authType: 'jwt'
    };

    // Use Supabase REST API to execute the update
    const updateResponse = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/integration_settings?company_id=eq.${COMPANY_ID}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': env.VITE_SUPABASE_ANON_KEY,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          ssactivewear_credentials: credentials
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Update failed:', updateResponse.status, errorText);
      return;
    }

    const result = await updateResponse.json();
    console.log('\n✅ Credentials updated successfully!');
    console.log('Account Number:', ACCOUNT_NUMBER);
    console.log('Auth Type: JWT');
    console.log('Result:', result);

  } catch (error) {
    console.error('Error:', error);
  }
}

updateCredentials();
