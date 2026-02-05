import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Read .env file
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSSActivewearDirect() {
  console.log('🔍 Testing SSActivewear API Authentication...\n');

  try {
    // Get credentials from database
    const { data: settings } = await supabase
      .from('company_settings')
      .select('ssactivewear_enabled, ssactivewear_username, ssactivewear_api_key_encrypted')
      .eq('id', '5f36fe64-8b67-4b62-a023-29590da87c41')
      .single();

    console.log('✅ Settings retrieved');
    console.log('   Enabled:', settings.ssactivewear_enabled);
    console.log('   Username:', settings.ssactivewear_username);
    console.log('   API Key:', settings.ssactivewear_api_key_encrypted ? 'SET (encrypted)' : 'NOT SET');

    if (!settings.ssactivewear_enabled) {
      console.error('\n❌ SSActivewear is DISABLED in company settings!');
      return;
    }

    if (!settings.ssactivewear_api_key_encrypted) {
      console.error('\n❌ No API key found!');
      return;
    }

    // Decrypt API key
    console.log('\n🔐 Decrypting API key...');
    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        token: settings.ssactivewear_api_key_encrypted,
      }),
    });

    if (!decryptResponse.ok) {
      const errorText = await decryptResponse.text();
      console.error('❌ Decryption failed:', decryptResponse.status, errorText);
      return;
    }

    const { result: apiKey } = await decryptResponse.json();
    console.log('✅ API key decrypted successfully');
    console.log('   API Key length:', apiKey?.length);

    // Test PromoStandards Product Data API
    console.log('\n📡 Testing SSActivewear PromoStandards Product Data API...');
    console.log('   Testing with style: 18500 (Gildan Heavy Blend Crewneck)');

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    <ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${settings.ssactivewear_username}</shar:id>
      <shar:password>${apiKey}</shar:password>
      <shar:productId>18500</shar:productId>
    </ns2:GetProductRequest>
  </soap:Body>
</soap:Envelope>`;

    const soapResponse = await fetch('https://promostandards.ssactivewear.com/productdata/v2/productdataservicev2.svc', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'getProduct',
      },
      body: soapEnvelope,
    });

    console.log('📥 Response Status:', soapResponse.status, soapResponse.statusText);

    const responseText = await soapResponse.text();
    console.log('\n📄 Response (first 2000 chars):');
    console.log(responseText.substring(0, 2000));

    // Check for error
    const errorCodeMatch = responseText.match(/<code>(\d+)<\/code>/);
    const errorDescMatch = responseText.match(/<description>(.*?)<\/description>/);

    if (errorCodeMatch && errorDescMatch) {
      console.log('\n❌ PromoStandards Error:');
      console.log('   Code:', errorCodeMatch[1]);
      console.log('   Description:', errorDescMatch[1]);
      return;
    }

    // Check for product data
    const productNameMatch = responseText.match(/<productName>(.*?)<\/productName>/);
    const productBrandMatch = responseText.match(/<productBrand>(.*?)<\/productBrand>/);
    const partMatches = responseText.match(/<Part>/g);

    if (productNameMatch) {
      console.log('\n✅ Product Found!');
      console.log('   Product Name:', productNameMatch[1]);
      console.log('   Brand:', productBrandMatch?.[1] || 'N/A');
      console.log('   Parts/SKUs:', partMatches?.length || 0);
    } else {
      console.log('\n⚠️ No product data found in response');
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    console.error(error);
  }
}

testSSActivewearDirect();
