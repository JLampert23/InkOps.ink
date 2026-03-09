/**
 * Direct SSActivewear PromoStandards API Test
 * Tests different authentication methods and endpoint configurations
 */

// CONFIGURE THESE:
const ACCOUNT_NUMBER = '54074'; // Your SSActivewear account number
const API_KEY = '1adb78cb-cbf0-46e7-878d-6fd87f08d3f4'; // Your SSActivewear API key
const TEST_PRODUCT = 'PC54'; // Test product ID

const ENDPOINTS = {
  correct: 'https://promostandards.ssactivewear.com/v2/productdata/',
  current: 'https://ws.ssactivewear.com/v2/productdata/',
};

// Test configurations
const tests = [
  {
    name: 'Test 1: Correct endpoint + Basic Auth only',
    endpoint: ENDPOINTS.correct,
    useBasicAuth: true,
    useSOAPCreds: false,
    soapAction: 'GetProduct',
  },
  {
    name: 'Test 2: Correct endpoint + SOAP body credentials only',
    endpoint: ENDPOINTS.correct,
    useBasicAuth: false,
    useSOAPCreds: true,
    soapAction: 'GetProduct',
  },
  {
    name: 'Test 3: Correct endpoint + Both Basic Auth AND SOAP credentials',
    endpoint: ENDPOINTS.correct,
    useBasicAuth: true,
    useSOAPCreds: true,
    soapAction: 'GetProduct',
  },
  {
    name: 'Test 4: Correct endpoint + Full SOAPAction URI + Basic Auth',
    endpoint: ENDPOINTS.correct,
    useBasicAuth: true,
    useSOAPCreds: false,
    soapAction: 'http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct',
  },
  {
    name: 'Test 5: Correct endpoint + Full SOAPAction URI + SOAP credentials',
    endpoint: ENDPOINTS.correct,
    useBasicAuth: false,
    useSOAPCreds: true,
    soapAction: 'http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct',
  },
  {
    name: 'Test 6: Correct endpoint + Quoted SOAPAction + Basic Auth',
    endpoint: ENDPOINTS.correct,
    useBasicAuth: true,
    useSOAPCreds: false,
    soapAction: '"http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct"',
  },
  {
    name: 'Test 7: Current (wrong) endpoint + Basic Auth (for comparison)',
    endpoint: ENDPOINTS.current,
    useBasicAuth: true,
    useSOAPCreds: false,
    soapAction: 'GetProduct',
  },
];

function createSOAPBody(useCredentials) {
  if (useCredentials) {
    return `<?xml version="1.0" encoding="utf-8"?>
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
</soap:Envelope>`;
  } else {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
  <soap:Body>
    <ns:GetProductRequest>
      <ns:wsVersion>2.0.0</ns:wsVersion>
      <ns:productId>${TEST_PRODUCT}</ns:productId>
      <ns:localizationCountry>US</ns:localizationCountry>
      <ns:localizationLanguage>en</ns:localizationLanguage>
    </ns:GetProductRequest>
  </soap:Body>
</soap:Envelope>`;
  }
}

async function runTest(test) {
  console.log('\n' + '='.repeat(80));
  console.log(test.name);
  console.log('='.repeat(80));

  const headers = {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': test.soapAction,
  };

  if (test.useBasicAuth) {
    const basicAuth = Buffer.from(`${ACCOUNT_NUMBER}:${API_KEY}`).toString('base64');
    headers['Authorization'] = `Basic ${basicAuth}`;
  }

  const body = createSOAPBody(test.useSOAPCreds);

  console.log('\n📤 REQUEST:');
  console.log(`Endpoint: ${test.endpoint}`);
  console.log(`Headers:`, JSON.stringify(headers, null, 2));
  console.log(`\nSOAP Body (first 500 chars):`);
  console.log(body.substring(0, 500) + '...');

  try {
    const startTime = Date.now();
    const response = await fetch(test.endpoint, {
      method: 'POST',
      headers,
      body,
    });
    const duration = Date.now() - startTime;

    console.log(`\n📥 RESPONSE (${duration}ms):`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    const responseText = await response.text();
    console.log(`\nBody (first 1000 chars):`);
    console.log(responseText.substring(0, 1000));

    if (response.ok) {
      console.log('\n✅ SUCCESS! This configuration works!');
      return { success: true, test, response: responseText };
    } else {
      console.log('\n❌ FAILED');

      // Try to extract error details from SOAP fault
      if (responseText.includes('faultstring')) {
        const faultMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/);
        if (faultMatch) {
          console.log(`SOAP Fault: ${faultMatch[1]}`);
        }
      }

      return { success: false, test, error: responseText };
    }
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return { success: false, test, error: error.message };
  }
}

async function runAllTests() {
  console.log('🧪 SSActivewear PromoStandards API Direct Test');
  console.log('Testing with:');
  console.log(`  Account Number: ${ACCOUNT_NUMBER}`);
  console.log(`  API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)}`);
  console.log(`  Test Product: ${TEST_PRODUCT}`);

  const results = [];

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);

    // Add a small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  results.forEach((result, index) => {
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`\nTest ${index + 1}: ${status}`);
    console.log(`  ${result.test.name}`);
    if (result.success) {
      console.log(`  ⭐ THIS IS THE CORRECT CONFIGURATION!`);
    }
  });

  const successfulTests = results.filter(r => r.success);
  if (successfulTests.length > 0) {
    console.log('\n\n🎉 FOUND WORKING CONFIGURATION(S):');
    successfulTests.forEach(result => {
      console.log(`\n✅ ${result.test.name}`);
      console.log(`   Endpoint: ${result.test.endpoint}`);
      console.log(`   Basic Auth: ${result.test.useBasicAuth}`);
      console.log(`   SOAP Credentials: ${result.test.useSOAPCreds}`);
      console.log(`   SOAPAction: ${result.test.soapAction}`);
    });
  } else {
    console.log('\n\n❌ NO WORKING CONFIGURATIONS FOUND');
    console.log('\nPossible issues:');
    console.log('1. Credentials may be incorrect');
    console.log('2. PromoStandards API may not be enabled for your account');
    console.log('3. IP address may need to be whitelisted');
    console.log('4. Different endpoint or API version may be required');
  }
}

// Run all tests
runAllTests().catch(console.error);
