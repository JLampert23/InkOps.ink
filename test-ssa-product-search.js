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
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testProductSearch() {
  console.log('🔍 Testing Product Search API with style 18500...\n');

  try {
    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('❌ No session found. Please log in to the app first, then run this test.');
      console.error('   You can log in at:', supabaseUrl.replace('https://', 'https://'));
      return;
    }

    console.log('✅ Session found, user:', session.user.email);

    const url = `${supabaseUrl}/functions/v1/product-search?style=18500`;

    console.log('📡 Calling product-search:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📥 Response Status:', response.status, response.statusText);

    const data = await response.json();

    console.log('\n📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));

    if (data.error) {
      console.log('\n❌ ERROR:', data.error);
    }

    if (data.results && data.results.length > 0) {
      console.log('\n✅ Found', data.results.length, 'result(s)');
      data.results.forEach((result, i) => {
        console.log(`\nResult ${i + 1}:`);
        console.log('  Supplier:', result.supplier);
        console.log('  Style:', result.style);
        console.log('  Brand:', result.brand);
        console.log('  Description:', result.description);
        console.log('  Colors:', result.colors?.length || 0);
      });
    } else {
      console.log('\n⚠️ No results found');
    }

    if (data.errors && data.errors.length > 0) {
      console.log('\n⚠️ Errors:');
      data.errors.forEach(error => console.log('  -', error));
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
  }
}

testProductSearch();
