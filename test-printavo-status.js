import 'dotenv/config';

const PRINTAVO_EMAIL = process.env.VITE_PRINTAVO_EMAIL;
const PRINTAVO_TOKEN = process.env.VITE_PRINTAVO_TOKEN;

async function testPrintavo() {
  const auth = Buffer.from(`${PRINTAVO_EMAIL}:${PRINTAVO_TOKEN}`).toString('base64');

  // Test 1: Get invoices with Billing Test Status
  const url1 = 'https://www.printavo.com/api/v2/invoices?status=Billing%20Test%20Status&page=1&per_page=10';
  console.log('Testing URL 1:', url1);

  const resp1 = await fetch(url1, {
    headers: { 'Authorization': `Basic ${auth}` }
  });

  const data1 = await resp1.json();
  console.log('Response 1 status:', resp1.status);
  console.log('Response 1:', JSON.stringify(data1, null, 2));
  console.log('Count:', data1.data?.length || 0);

  // Test 2: Get invoices with Sent to Accounting
  const url2 = 'https://www.printavo.com/api/v2/invoices?status=Sent%20to%20Accounting&page=1&per_page=10';
  console.log('\nTesting URL 2:', url2);

  const resp2 = await fetch(url2, {
    headers: { 'Authorization': `Basic ${auth}` }
  });

  const data2 = await resp2.json();
  console.log('Response 2 status:', resp2.status);
  console.log('Response 2:', JSON.stringify(data2, null, 2));
  console.log('Count:', data2.data?.length || 0);

  // Test 3: Get ANY invoices (no filter)
  const url3 = 'https://www.printavo.com/api/v2/invoices?page=1&per_page=5';
  console.log('\nTesting URL 3 (no filter):', url3);

  const resp3 = await fetch(url3, {
    headers: { 'Authorization': `Basic ${auth}` }
  });

  const data3 = await resp3.json();
  console.log('Response 3 status:', resp3.status);
  console.log('First invoice:', JSON.stringify(data3.data?.[0], null, 2));
  console.log('Total invoices:', data3.meta?.pagination?.total || 0);
}

testPrintavo().catch(console.error);
