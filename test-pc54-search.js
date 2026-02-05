#!/usr/bin/env node

// Test PC54 search through both SanMar and SSActivewear

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COMPANY_ID = '5f36fe64-8b67-4b62-a023-29590da87c41';

async function testSanMarAPI() {
  console.log('\n=== Testing SanMar API for PC54 ===');

  const url = `${SUPABASE_URL}/functions/v1/sanmar-api?action=unified&style=PC54&companyId=${COMPANY_ID}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testProductSearch() {
  console.log('\n=== Testing product-search API for PC54 ===');

  const url = `${SUPABASE_URL}/functions/v1/product-search?style=PC54`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.errors) {
      console.log('\nErrors:');
      data.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function main() {
  await testSanMarAPI();
  await testProductSearch();
}

main();
