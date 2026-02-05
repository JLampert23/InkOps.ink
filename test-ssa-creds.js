import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTY1NjA1NCwiZXhwIjoyMDUxMjMyMDU0fQ.nXIE4z3iQJSv5bTy4M9f5h8lfkX0jCGhgr4p7_wD0-I';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function test() {
  console.log('Testing SSActivewear credentials...\n');

  const { data } = await supabase
    .from('company_settings')
    .select('ssactivewear_username, ssactivewear_api_key_encrypted')
    .eq('id', '5f36fe64-8b67-4b62-a023-29590da87c41')
    .single();

  console.log('Username:', data.ssactivewear_username);
  console.log('Has API key:', !!data.ssactivewear_api_key_encrypted);

  const decrypt = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      action: 'decrypt',
      token: data.ssactivewear_api_key_encrypted,
    }),
  });

  const { result: apiKey } = await decrypt.json();
  console.log('API Key:', apiKey);
}

test();
