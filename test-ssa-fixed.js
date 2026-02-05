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
const supabaseServiceKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function testSSA() {
  console.log('🔍 Testing SSActivewear API with style 18500...\n');

  try {
    const url = `${supabaseUrl}/functions/v1/ssactivewear-api?action=product&productId=18500&companyId=5f36fe64-8b67-4b62-a023-29590da87c41`;

    console.log('📡 Calling:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📥 Response Status:', response.status, response.statusText);

    const data = await response.json();

    console.log('\n📦 Response Data:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success === false) {
      console.log('\n⚠️ API returned success=false');
      console.log('Error:', data.error);
      console.log('Error Code:', data.errorCode);
    } else if (data.success && data.data && data.data.length > 0) {
      console.log('\n✅ Product found!');
      const product = data.data[0];
      console.log('Product ID:', product.productId);
      console.log('Product Name:', product.productName);
      console.log('Brand:', product.productBrand);
      console.log('Parts:', product.parts?.length || 0);
    } else {
      console.log('\n⚠️ Unexpected response format');
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
  }
}

testSSA();
