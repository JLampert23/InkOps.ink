import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
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

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CORRECT_API_KEY = '1adb78cb-cbf0-46e7-878d-6fd87f08d3f4';
const CORRECT_ACCOUNT_NUMBER = '54074';

async function verifyAndFixCredentials() {
  console.log('\n=== Verifying SSActivewear Credentials ===\n');

  // Sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'jamie@gearedapparel.com',
    password: 'jamie3121'
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  console.log('✅ Authenticated as:', authData.user.email);

  // Get current settings
  const { data: settings, error: settingsError } = await supabase
    .from('integration_settings')
    .select('*')
    .maybeSingle();

  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
    return;
  }

  if (!settings) {
    console.log('No settings found, creating new record...');
  } else {
    console.log('\nCurrent settings:', {
      id: settings.id,
      company_id: settings.company_id,
      ssactivewear_enabled: settings.ssactivewear_enabled,
      has_credentials: !!settings.ssactivewear_credentials,
    });

    if (settings.ssactivewear_credentials) {
      const creds = settings.ssactivewear_credentials;
      console.log('\nStored credentials:', {
        accountNumber: creds.accountNumber,
        apiKeyStored: creds.apiKey?.substring(0, 50) + '...',
      });

      // Try to decrypt current key
      try {
        const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.session.access_token}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            action: 'decrypt',
            token: creds.apiKey,
          }),
        });

        if (decryptResponse.ok) {
          const { result: decryptedKey } = await decryptResponse.json();
          console.log('\nDecrypted API key:', decryptedKey);
          console.log('Expected API key: ', CORRECT_API_KEY);
          console.log('Keys match:', decryptedKey === CORRECT_API_KEY);

          if (decryptedKey === CORRECT_API_KEY) {
            console.log('\n✅ Credentials are correct! No update needed.');
            return;
          }
        }
      } catch (err) {
        console.log('Could not decrypt existing key:', err.message);
      }
    }
  }

  // Encrypt the correct API key
  console.log('\n📝 Encrypting correct API key...');
  const encryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.session.access_token}`,
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

  // Update or insert settings
  const updatedCredentials = {
    accountNumber: CORRECT_ACCOUNT_NUMBER,
    apiKey: encryptedKey,
  };

  if (settings?.id) {
    console.log('\n📝 Updating existing settings...');
    const { error: updateError } = await supabase
      .from('integration_settings')
      .update({
        ssactivewear_enabled: true,
        ssactivewear_credentials: updatedCredentials,
      })
      .eq('id', settings.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return;
    }
  } else {
    console.log('\n📝 Creating new settings...');
    const { error: insertError } = await supabase
      .from('integration_settings')
      .insert({
        company_id: authData.user.user_metadata.company_id,
        ssactivewear_enabled: true,
        ssactivewear_credentials: updatedCredentials,
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return;
    }
  }

  console.log('✅ Credentials updated successfully!');

  // Now test the connection
  console.log('\n🧪 Testing connection with SSActivewear...');

  const testResponse = await fetch(
    `${supabaseUrl}/functions/v1/ssactivewear-api?action=product&productId=PC54`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.session.access_token}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log('Test response status:', testResponse.status);
  const testResult = await testResponse.text();

  if (testResponse.ok) {
    console.log('✅ Connection successful!');
    console.log('Response preview:', testResult.substring(0, 300));
  } else {
    console.log('❌ Connection failed');
    console.log('Error:', testResult);
  }
}

verifyAndFixCredentials();
