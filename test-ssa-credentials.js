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
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSSACredentials() {
  console.log('\n=== Testing SSActivewear Credentials ===\n');

  // 1. Get the integration settings
  const { data: settings, error } = await supabase
    .from('integration_settings')
    .select('*')
    .eq('ssactivewear_enabled', true)
    .maybeSingle();

  if (error || !settings) {
    console.error('Error fetching settings:', error);
    return;
  }

  console.log('Settings found:', {
    id: settings.id,
    company_id: settings.company_id,
    enabled: settings.ssactivewear_enabled,
    hasCredentials: !!settings.ssactivewear_credentials,
  });

  const creds = settings.ssactivewear_credentials;
  console.log('\nStored credentials structure:', {
    accountNumber: creds.accountNumber,
    hasApiKey: !!creds.apiKey,
    apiKeyLength: creds.apiKey?.length,
    apiKeyPrefix: creds.apiKey?.substring(0, 20),
  });

  // 2. Try to decrypt the API key
  console.log('\nAttempting to decrypt API key...');

  try {
    const decryptResponse = await fetch(`${supabaseUrl}/functions/v1/crypto-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'decrypt',
        token: creds.apiKey,
      }),
    });

    if (!decryptResponse.ok) {
      const errorText = await decryptResponse.text();
      console.error('Decryption failed:', decryptResponse.status, errorText);
      return;
    }

    const { result: decryptedApiKey } = await decryptResponse.json();
    console.log('Decryption successful!');
    console.log('Decrypted API key:', {
      length: decryptedApiKey?.length,
      prefix: decryptedApiKey?.substring(0, 10) + '...',
      full: decryptedApiKey, // Show the full key for debugging
    });

    // 3. Test the credentials with SSActivewear
    console.log('\nTesting credentials with SSActivewear PromoStandards API...');

    const basicAuth = btoa(`${creds.accountNumber}:${decryptedApiKey}`);
    console.log('Basic auth header:', {
      accountNumber: creds.accountNumber,
      authHeaderLength: basicAuth.length,
      authPrefix: basicAuth.substring(0, 20) + '...',
    });

    const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns:GetProductRequest xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects">
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${creds.accountNumber}</shar:id>
      <shar:password>${decryptedApiKey}</shar:password>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
      <shar:productId>PC54</shar:productId>
    </ns:GetProductRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

    const response = await fetch('https://ws.ssactivewear.com/v2/productdata/', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct"',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: soapBody,
    });

    console.log('\nSSActivewear Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('\n❌ Request failed!');
      console.error('Response body:', responseText.substring(0, 500));
    } else {
      console.log('\n✅ Request successful!');
      console.log('Response preview:', responseText.substring(0, 300) + '...');
    }

  } catch (err) {
    console.error('Error during test:', err);
  }
}

testSSACredentials();
