import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSSActivewear() {
  try {
    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error('❌ No session found. Please log in first.');
      return;
    }

    console.log('✅ Session found');
    console.log('🔍 Testing SSActivewear API with style 18500...\n');

    // Test direct SSActivewear API call
    const ssaUrl = `${supabaseUrl}/functions/v1/ssactivewear-api?action=product&productId=18500`;

    console.log('📡 Calling:', ssaUrl);

    const response = await fetch(ssaUrl, {
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
      if (data.details) {
        console.log('Details:', data.details);
      }
    }

    if (data.success && data.data) {
      console.log('\n✅ Success! Found', data.data.length, 'product(s)');
      if (data.data.length > 0) {
        const product = data.data[0];
        console.log('Product ID:', product.productId);
        console.log('Product Name:', product.productName);
        console.log('Brand:', product.productBrand);
        console.log('Parts/SKUs:', product.parts?.length || 0);
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error(error);
  }
}

testSSActivewear();
