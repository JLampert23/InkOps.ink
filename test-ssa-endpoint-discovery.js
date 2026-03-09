/**
 * SSActivewear Endpoint Discovery
 * Tests different endpoint paths and structures
 */

const ACCOUNT_NUMBER = '54074';
const API_KEY = '1adb78cb-cbf0-46e7-878d-6fd87f08d3f4';
const TEST_PRODUCT = 'PC54';

// Various endpoint possibilities based on common PromoStandards implementations
const ENDPOINTS_TO_TEST = [
  // Current code
  'https://ws.ssactivewear.com/v2/productdata/',

  // Without version prefix
  'https://ws.ssactivewear.com/ProductData',
  'https://ws.ssactivewear.com/ProductDataService',

  // With .svc extension (common for WCF services)
  'https://ws.ssactivewear.com/ProductDataService.svc',
  'https://ws.ssactivewear.com/v2/ProductDataService.svc',

  // Different subdomain
  'https://api.ssactivewear.com/v2/productdata/',
  'https://api.ssactivewear.com/ProductDataService.svc',

  // PromoStandards subdomain with different paths
  'https://promostandards.ssactivewear.com/ProductDataService.svc',
  'https://promostandards.ssactivewear.com/v2.0.0/ProductDataService',

  // Maybe they use different port?
  'https://ws.ssactivewear.com:8443/v2/productdata/',

  // Standard PromoStandards paths
  'https://ws.ssactivewear.com/promostandards/v2/productdata',
  'https://ws.ssactivewear.com/services/ProductDataService.svc',
];

function createSOAPBody() {
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
}

async function testEndpoint(endpoint) {
  const basicAuth = Buffer.from(`${ACCOUNT_NUMBER}:${API_KEY}`).toString('base64');

  const headers = {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': 'http://www.promostandards.org/WSDL/ProductDataService/2.0.0/GetProduct',
    'Authorization': `Basic ${basicAuth}`,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: createSOAPBody(),
    });

    const responseText = await response.text();

    return {
      endpoint,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      bodyPreview: responseText.substring(0, 500),
      isHTML: responseText.includes('<!DOCTYPE') || responseText.includes('<html'),
      isXML: responseText.includes('<?xml') || responseText.includes('<soap:'),
      success: response.ok,
    };
  } catch (error) {
    return {
      endpoint,
      error: error.message,
      success: false,
    };
  }
}

async function discoverEndpoints() {
  console.log('🔍 SSActivewear Endpoint Discovery');
  console.log('Testing', ENDPOINTS_TO_TEST.length, 'possible endpoints...\n');

  const results = [];

  for (const endpoint of ENDPOINTS_TO_TEST) {
    console.log(`Testing: ${endpoint}`);
    const result = await testEndpoint(endpoint);
    results.push(result);

    const statusIcon = result.success ? '✅' :
                      result.status === 404 ? '🔍' :
                      result.status === 403 ? '🔒' :
                      result.error ? '❌' : '⚠️';

    console.log(`  ${statusIcon} Status: ${result.status || 'ERROR'} ${result.statusText || result.error || ''}`);
    if (result.contentType) {
      console.log(`     Content-Type: ${result.contentType}`);
    }
    if (result.isXML) {
      console.log(`     📄 Response is XML (likely SOAP)`);
    }
    if (result.isHTML) {
      console.log(`     📄 Response is HTML (likely error page)`);
    }
    console.log();

    // Small delay to be nice to their servers
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  // Categorize results
  const successful = results.filter(r => r.success);
  const forbidden = results.filter(r => r.status === 403);
  const notFound = results.filter(r => r.status === 404);
  const xmlResponses = results.filter(r => r.isXML && !r.success);
  const errors = results.filter(r => r.error);

  if (successful.length > 0) {
    console.log('\n✅ SUCCESSFUL ENDPOINTS:');
    successful.forEach(r => console.log(`   ${r.endpoint}`));
  }

  if (xmlResponses.length > 0) {
    console.log('\n📄 ENDPOINTS RETURNING XML (might be SOAP faults with useful info):');
    xmlResponses.forEach(r => {
      console.log(`   ${r.endpoint} (${r.status})`);
      console.log(`      ${r.bodyPreview.substring(0, 200)}...`);
    });
  }

  if (forbidden.length > 0) {
    console.log('\n🔒 FORBIDDEN (403) - Endpoint exists but auth failed:');
    forbidden.forEach(r => console.log(`   ${r.endpoint}`));
  }

  if (notFound.length > 0) {
    console.log('\n🔍 NOT FOUND (404) - Endpoint doesn\'t exist:');
    notFound.forEach(r => console.log(`   ${r.endpoint}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ ERRORS (network/connection issues):');
    errors.forEach(r => console.log(`   ${r.endpoint}: ${r.error}`));
  }

  console.log('\n💡 ANALYSIS:');
  if (forbidden.length > 0) {
    console.log('   - 403 errors suggest the endpoint exists but authentication is incorrect');
    console.log('   - Check: credential format, API key validity, account permissions');
  }
  if (successful.length === 0 && notFound.length === results.length) {
    console.log('   - All endpoints return 404 - the base URL or path structure is wrong');
    console.log('   - Contact SSActivewear support for correct PromoStandards endpoint');
  }
  if (xmlResponses.length > 0) {
    console.log('   - XML responses may contain SOAP faults with error details');
  }
}

discoverEndpoints().catch(console.error);
