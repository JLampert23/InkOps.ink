// Script to update SSActivewear credentials
// Account Number: 54074
// API Key: 1adb78cb-cbf0-46e7-878d-6fd87f08d3f4

const SUPABASE_URL = 'https://cuaukcvccxvfpuxaciac.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjA4NTQsImV4cCI6MjA4MjEzNjg1NH0.I-FDsR0oezVPxKcWgFmV-MMolV6E-lYcoA7Ew8ZgKYU';

async function updateCredentials() {
  try {
    // You'll need to provide a valid session token
    // This script should be run from the browser console where you're logged in
    console.log('Please run this in the browser console where you are logged in');
    console.log('');
    console.log('Copy and paste this code:');
    console.log('');
    console.log(`
const accountNumber = '54074';
const apiKey = '1adb78cb-cbf0-46e7-878d-6fd87f08d3f4';

// Get current session
const { data: { session } } = await window.supabase.auth.getSession();

if (!session) {
  console.error('Not logged in!');
} else {
  console.log('Encrypting API key...');

  // Encrypt the API key
  const encryptResponse = await fetch('${SUPABASE_URL}/functions/v1/crypto-service', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token
    },
    body: JSON.stringify({
      action: 'encrypt',
      token: apiKey
    })
  });

  if (!encryptResponse.ok) {
    console.error('Failed to encrypt:', await encryptResponse.text());
    throw new Error('Encryption failed');
  }

  const { result: encryptedApiKey } = await encryptResponse.json();
  console.log('Encrypted API key:', encryptedApiKey);

  // Update the integration settings
  const { data, error } = await window.supabase
    .from('integration_settings')
    .update({
      ssactivewear_enabled: true,
      ssactivewear_credentials: {
        accountNumber: accountNumber,
        apiKey: encryptedApiKey
      }
    })
    .eq('company_id', (await window.supabase.from('user_profiles').select('company_id').single()).data.company_id);

  if (error) {
    console.error('Update error:', error);
  } else {
    console.log('✅ SSActivewear credentials updated successfully!');
    console.log('Account Number:', accountNumber);
    console.log('API Key:', apiKey);
  }
}
`);
  } catch (error) {
    console.error('Error:', error);
  }
}

updateCredentials();
