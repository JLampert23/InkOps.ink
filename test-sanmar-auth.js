/**
 * SanMar Authentication Test Script
 *
 * Tests SanMar API credentials and SOAP authentication
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testSanMarAuth() {
  console.log('🔍 Testing SanMar Authentication...\n');

  // 1. Get company with SanMar enabled
  const { data: companies, error: companiesError } = await supabase
    .from('company_settings')
    .select('id, sanmar_enabled, sanmar_account_number, sanmar_username, sanmar_password_encrypted')
    .eq('sanmar_enabled', true)
    .limit(1);

  if (companiesError || !companies || companies.length === 0) {
    console.error('❌ No company with SanMar enabled found');
    console.error(companiesError);
    return;
  }

  const company = companies[0];
  console.log('✅ Found company:', company.id);
  console.log('   Account Number:', company.sanmar_account_number);
  console.log('   Username:', company.sanmar_username);
  console.log('   Password:', company.sanmar_password_encrypted ? 'SET (encrypted)' : 'NOT SET');

  if (!company.sanmar_username || !company.sanmar_password_encrypted) {
    console.error('❌ SanMar credentials not configured');
    return;
  }

  // 2. Test credential decryption
  console.log('\n🔐 Testing credential decryption...');
  try {
    const decryptResponse = await fetch(`${SUPABASE_URL}/functions/v1/crypto-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        token: company.sanmar_password_encrypted,
      }),
    });

    if (!decryptResponse.ok) {
      const errorText = await decryptResponse.text();
      console.error('❌ Decryption failed:', errorText);
      return;
    }

    const { result: decryptedPassword } = await decryptResponse.json();
    console.log('✅ Decryption successful');
    console.log('   Decrypted password length:', decryptedPassword.length);
    console.log('   Decrypted password (masked):', decryptedPassword.slice(0, 3) + '***');

    // 3. Test direct SOAP request
    console.log('\n📡 Testing direct SOAP API call...');

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    <ns2:GetProductRequest xmlns:ns2="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${company.sanmar_username}</shar:id>
      <shar:password>${decryptedPassword}</shar:password>
      <shar:productId>PC54</shar:productId>
    </ns2:GetProductRequest>
  </soap:Body>
</soap:Envelope>`;

    // Try with Basic Auth
    const basicAuth = Buffer.from(`${company.sanmar_username}:${decryptedPassword}`).toString('base64');

    console.log('   Endpoint: https://api.sanmar.com/ps/ProductDataService.svc');
    console.log('   Username:', company.sanmar_username);
    console.log('   Basic Auth header:', `Basic ${basicAuth.slice(0, 20)}...`);

    const soapResponse = await fetch('https://api.sanmar.com/ps/ProductDataService.svc', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'getProduct',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: soapBody,
    });

    console.log('   Response status:', soapResponse.status, soapResponse.statusText);

    const responseText = await soapResponse.text();

    if (!soapResponse.ok) {
      console.error('❌ SOAP request failed');
      console.error('   Response:', responseText.slice(0, 500));

      // Check for common authentication errors
      if (soapResponse.status === 401) {
        console.error('\n💡 401 Unauthorized - Possible issues:');
        console.error('   1. Username or password is incorrect');
        console.error('   2. Account doesn\'t have API access enabled');
        console.error('   3. IP address not whitelisted (if required)');
        console.error('   4. Account is not active');
      }
    } else {
      console.log('✅ SOAP request successful!');
      console.log('   Response length:', responseText.length);

      // Check for product data
      if (responseText.includes('<productName>')) {
        const productNameMatch = responseText.match(/<productName>([^<]*)<\/productName>/);
        if (productNameMatch) {
          console.log('   Product found:', productNameMatch[1]);
        }
      }
    }

    // 4. Test via sanmar-api edge function
    console.log('\n🔧 Testing sanmar-api edge function...');
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/sanmar-api?action=product&style=PC54&companyId=${company.id}`;

    const edgeFunctionResponse = await fetch(edgeFunctionUrl, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    console.log('   Response status:', edgeFunctionResponse.status, edgeFunctionResponse.statusText);

    if (edgeFunctionResponse.ok) {
      const data = await edgeFunctionResponse.json();
      console.log('✅ Edge function call successful!');
      console.log('   Data:', JSON.stringify(data, null, 2).slice(0, 500));
    } else {
      const errorText = await edgeFunctionResponse.text();
      console.error('❌ Edge function call failed:', errorText);
    }

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error(error.stack);
  }
}

testSanMarAuth();
