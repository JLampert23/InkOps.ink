import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cuaukcvccxvfpuxaciac.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjA4NTQsImV4cCI6MjA4MjEzNjg1NH0.I-FDsR0oezVPxKcWgFmV-MMolV6E-lYcoA7Ew8ZgKYU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Sign in as the admin user
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'jamie@inkops.com',
  password: 'password123'
});

if (authError) {
  console.error('Auth error:', authError);
  process.exit(1);
}

console.log('Authenticated successfully');

// Get the integration settings
const { data: settings, error: settingsError } = await supabase
  .from('integration_settings')
  .select('ssactivewear_credentials')
  .single();

if (settingsError) {
  console.error('Settings error:', settingsError);
  process.exit(1);
}

console.log('\nStored credentials:');
console.log('Account Number:', settings.ssactivewear_credentials.accountNumber);
console.log('Encrypted API Key:', settings.ssactivewear_credentials.apiKey);

// Decrypt the API key
const session = authData.session;
const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    action: 'decrypt',
    token: settings.ssactivewear_credentials.apiKey
  })
});

if (!decryptResponse.ok) {
  console.error('Decrypt error:', await decryptResponse.text());
  process.exit(1);
}

const { result: decryptedApiKey } = await decryptResponse.json();

console.log('\nDecrypted API Key:', decryptedApiKey);
console.log('\nExpected API Key: 1adb78cb-cbf0-46e7-878d-6fd87f08d3f4');
console.log('Match:', decryptedApiKey === '1adb78cb-cbf0-46e7-878d-6fd87f08d3f4');

process.exit(0);
