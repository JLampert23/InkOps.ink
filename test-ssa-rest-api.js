/**
 * Test SSActivewear REST API (not PromoStandards)
 * This will verify if the credentials are valid at all
 */

const ACCOUNT_NUMBER = '54074';
const API_KEY = '1adb78cb-cbf0-46e7-878d-6fd87f08d3f4';

// SSActivewear REST API endpoints
const REST_ENDPOINTS = [
  'https://api.ssactivewear.com/v2/products',
  'https://api.ssactivewear.com/v2/styles',
  'https://api.ssactivewear.com/v2/categories',
];

async function testRESTEndpoint(endpoint) {
  console.log(`\nTesting REST API: ${endpoint}`);
  console.log('='.repeat(80));

  const basicAuth = Buffer.from(`${ACCOUNT_NUMBER}:${API_KEY}`).toString('base64');

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Accept': 'application/json',
      },
    });

    const contentType = response.headers.get('content-type');
    const responseText = await response.text();

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${contentType}`);
    console.log(`Response (first 500 chars):\n${responseText.substring(0, 500)}`);

    if (response.ok) {
      console.log('\n✅ SUCCESS! Credentials work with REST API');
      return { success: true, endpoint, status: response.status };
    } else if (response.status === 403) {
      console.log('\n❌ 403 Forbidden - Credentials rejected');
    } else if (response.status === 401) {
      console.log('\n❌ 401 Unauthorized - Invalid credentials');
    } else {
      console.log(`\n⚠️ Unexpected status: ${response.status}`);
    }

    return { success: false, endpoint, status: response.status };
  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    return { success: false, endpoint, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Testing SSActivewear REST API (to verify credentials)');
  console.log(`Account: ${ACCOUNT_NUMBER}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)}\n`);

  const results = [];

  for (const endpoint of REST_ENDPOINTS) {
    const result = await testRESTEndpoint(endpoint);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length > 0) {
    console.log('\n✅ REST API works! The credentials are valid.');
    console.log('   This means the PromoStandards authentication method is the issue.');
  } else {
    console.log('\n❌ REST API also fails!');
    if (failed.every(r => r.status === 403 || r.status === 401)) {
      console.log('   The credentials appear to be invalid or the account may not have API access.');
    }
  }

  console.log('\n💡 NEXT STEPS:');
  if (successful.length > 0) {
    console.log('   1. PromoStandards may use different authentication than REST API');
    console.log('   2. PromoStandards may require separate credentials or API token');
    console.log('   3. Contact SSActivewear support about PromoStandards authentication');
  } else {
    console.log('   1. Verify credentials in SSActivewear dashboard');
    console.log('   2. Check if API access is enabled for your account');
    console.log('   3. Verify the account number format (with or without leading zeros?)');
    console.log('   4. Try regenerating the API key');
  }
}

runTests().catch(console.error);
