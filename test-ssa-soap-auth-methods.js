/**
 * Test different SOAP authentication methods for SSActivewear PromoStandards
 * Now that we know credentials are valid, test different auth patterns
 */

const ACCOUNT_NUMBER = '54074';
const API_KEY = '1adb78cb-cbf0-46e7-878d-6fd87f08d3f4';
const TEST_PRODUCT = 'PC54';
const ENDPOINT = 'https://ws.ssactivewear.com/v2/productdata/';

// Test different SOAP body structures
const SOAP_VARIATIONS = [
  {
    name: 'Standard PromoStandards with id/password in body',
    createBody: () => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
  <soap:Body>
    <ns:GetProductRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:id>${ACCOUNT_NUMBER}</ns:id>
      <ns:password>${API_KEY}</ns:password>
      <ns:productId>${TEST_PRODUCT}</ns:productId>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
    </ns:GetProductRequest>
  </soap:Body>
</soap:Envelope>`,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '"http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct"',
    }
  },
  {
    name: 'With WS-Security UsernameToken in header',
    createBody: () => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soap:Header>
    <wsse:Security soap:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>${ACCOUNT_NUMBER}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${API_KEY}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>
    <ns:GetProductRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:productId>${TEST_PRODUCT}</ns:productId>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
    </ns:GetProductRequest>
  </soap:Body>
</soap:Envelope>`,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '"http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct"',
    }
  },
  {
    name: 'Basic Auth + credentials in body',
    createBody: () => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
  <soap:Body>
    <ns:GetProductRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:id>${ACCOUNT_NUMBER}</ns:id>
      <ns:password>${API_KEY}</ns:password>
      <ns:productId>${TEST_PRODUCT}</ns:productId>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
    </ns:GetProductRequest>
  </soap:Body>
</soap:Envelope>`,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '"http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct"',
      'Authorization': `Basic ${Buffer.from(`${ACCOUNT_NUMBER}:${API_KEY}`).toString('base64')}`,
    }
  },
  {
    name: 'Empty SOAPAction',
    createBody: () => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
  <soap:Body>
    <ns:GetProductRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:id>${ACCOUNT_NUMBER}</ns:id>
      <ns:password>${API_KEY}</ns:password>
      <ns:productId>${TEST_PRODUCT}</ns:productId>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
    </ns:GetProductRequest>
  </soap:Body>
</soap:Envelope>`,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '""',
    }
  },
  {
    name: 'Different namespace prefix (shar)',
    createBody: () => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:shar="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects">
  <soap:Body>
    <shar:GetProductRequest>
      <shar:wsVersion>2.0.0</shar:wsVersion>
      <shar:id>${ACCOUNT_NUMBER}</shar:id>
      <shar:password>${API_KEY}</shar:password>
      <shar:productId>${TEST_PRODUCT}</shar:productId>
      <shar:localizationCountry>US</shar:localizationCountry>
      <shar:localizationLanguage>en</shar:localizationLanguage>
    </shar:GetProductRequest>
  </soap:Body>
</soap:Envelope>`,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '"http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct"',
    }
  },
  {
    name: 'SOAP 1.2',
    createBody: () => `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
  <soap12:Body>
    <ns:GetProductRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:id>${ACCOUNT_NUMBER}</ns:id>
      <ns:password>${API_KEY}</ns:password>
      <ns:productId>${TEST_PRODUCT}</ns:productId>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
    </ns:GetProductRequest>
  </soap12:Body>
</soap12:Envelope>`,
    headers: {
      'Content-Type': 'application/soap+xml; charset=utf-8',
    }
  },
];

async function testSoapVariation(variation) {
  console.log('\n' + '='.repeat(80));
  console.log(variation.name);
  console.log('='.repeat(80));

  const body = variation.createBody();

  console.log('Headers:', JSON.stringify(variation.headers, null, 2));
  console.log(`\nSOAP Body (first 600 chars):`);
  console.log(body.substring(0, 600) + '...\n');

  try {
    const startTime = Date.now();
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: variation.headers,
      body,
    });
    const duration = Date.now() - startTime;

    const responseText = await response.text();

    console.log(`Response: ${response.status} ${response.statusText} (${duration}ms)`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);

    if (response.ok) {
      console.log('\n✅ SUCCESS!!!');
      console.log(responseText.substring(0, 1000));
      return { success: true, variation: variation.name };
    } else {
      console.log(`\nResponse body (first 800 chars):`);
      console.log(responseText.substring(0, 800));

      // Check for specific error messages
      if (responseText.toLowerCase().includes('authentication')) {
        console.log('\n🔒 Authentication error detected in response');
      }
      if (responseText.toLowerCase().includes('credentials')) {
        console.log('\n🔑 Credentials issue detected in response');
      }

      return { success: false, variation: variation.name, status: response.status };
    }
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return { success: false, variation: variation.name, error: error.message };
  }
}

async function runAllVariations() {
  console.log('🧪 Testing Different SOAP Authentication Methods');
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Account: ${ACCOUNT_NUMBER}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)}`);

  const results = [];

  for (const variation of SOAP_VARIATIONS) {
    const result = await testSoapVariation(variation);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 FINAL RESULTS');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length > 0) {
    console.log('\n🎉 FOUND WORKING METHOD(S):');
    successful.forEach(r => console.log(`   ✅ ${r.variation}`));
  } else {
    console.log('\n❌ No working methods found');
    console.log('\nAll variations failed with 403, which suggests:');
    console.log('   1. PromoStandards API may use completely different credentials');
    console.log('   2. PromoStandards API may require separate enablement/setup');
    console.log('   3. Account may not have PromoStandards access despite REST API working');
    console.log('   4. SSActivewear may use a non-standard PromoStandards implementation');
    console.log('\n💡 RECOMMENDATION: Contact SSActivewear support and ask:');
    console.log('   - "How do I authenticate to your PromoStandards SOAP API?"');
    console.log('   - "Are the PromoStandards credentials different from REST API credentials?"');
    console.log('   - "Can you provide a working SOAP request example for ProductDataService?"');
  }
}

runAllVariations().catch(console.error);
