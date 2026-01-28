// Test SSActivewear authentication
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env file
const envFile = readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.trim();
  }
});

process.env = { ...process.env, ...env };

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function testAuth() {
  try {
    console.log('Fetching SSActivewear credentials...');

    // Get credentials from database
    const { data: settings, error } = await supabase
      .from('integration_settings')
      .select('ssactivewear_enabled, ssactivewear_credentials')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching settings:', error);
      return;
    }

    if (!settings) {
      console.log('No integration settings found');
      return;
    }

    console.log('SSActivewear enabled:', settings.ssactivewear_enabled);
    console.log('Credentials:', {
      accountNumber: settings.ssactivewear_credentials.accountNumber,
      apiKeyEncrypted: settings.ssactivewear_credentials.apiKey.substring(0, 20) + '...'
    });

    // Try to decrypt
    console.log('\nAttempting to decrypt API key...');
    const decryptResponse = await fetch(
      `${process.env.VITE_SUPABASE_URL}/functions/v1/crypto-service`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'decrypt',
          token: settings.ssactivewear_credentials.apiKey,
        }),
      }
    );

    if (!decryptResponse.ok) {
      const errorText = await decryptResponse.text();
      console.error('Decryption failed:', errorText);
      return;
    }

    const { result: decryptedApiKey } = await decryptResponse.json();
    console.log('Decrypted API key:', decryptedApiKey.substring(0, 10) + '...');
    console.log('API key length:', decryptedApiKey.length);

    // Now try to make a PromoStandards request
    console.log('\nTesting PromoStandards SOAP request...');
    const soapXML = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/">
  <soap:Body>
    <ns:GetProductRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:id>${settings.ssactivewear_credentials.accountNumber}</ns:id>
      <ns:password>${decryptedApiKey}</ns:password>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
      <ns:productId>64000</ns:productId>
    </ns:GetProductRequest>
  </soap:Body>
</soap:Envelope>`;

    const response = await fetch(
      'https://promostandards.ssactivewear.com/productdata/v2/productdataservicev2.svc',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': '',
        },
        body: soapXML,
      }
    );

    console.log('Response status:', response.status);
    console.log('Response statusText:', response.statusText);

    const responseText = await response.text();
    console.log('Response length:', responseText.length);

    if (responseText.includes('faultcode') || responseText.includes('Fault')) {
      console.error('SOAP Fault detected:');
      console.error(responseText.substring(0, 1000));
    } else if (responseText.includes('productId')) {
      console.log('Success! Product data received.');
      console.log('First 500 chars:', responseText.substring(0, 500));
    } else {
      console.log('Unknown response:', responseText.substring(0, 500));
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

testAuth();
