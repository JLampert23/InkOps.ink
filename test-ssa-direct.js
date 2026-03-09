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

async function testSSADirect() {
  console.log('\n=== Testing SSActivewear API Through Edge Function ===\n');

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Get session - you'll need to be logged in
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.error('No active session found. Please log in first.');
    console.log('\nPlease enter your email and password:');
    console.log('You can run this in the app or manually authenticate.');
    return;
  }

  console.log('✅ Session found for user:', session.user.email);

  // Call the edge function
  console.log('\nCalling ssactivewear-api edge function...');

  const response = await fetch(
    `${supabaseUrl}/functions/v1/ssactivewear-api?action=product&productId=PC54`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log('\nResponse status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  const responseText = await response.text();

  try {
    const json = JSON.parse(responseText);
    console.log('\nResponse body:', JSON.stringify(json, null, 2));
  } catch {
    console.log('\nResponse body (raw):', responseText.substring(0, 1000));
  }
}

testSSADirect();
