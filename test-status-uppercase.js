// Test to verify the status matching logic

const ALLOWED_STATUSES = ['BILLING TEST STATUS', 'SENT TO ACCOUNTING'];

const testStatuses = [
  'BILLING TEST STATUS',
  'Billing Test Status',
  'billing test status',
  'SENT TO ACCOUNTING',
  'Sent to Accounting',
  'sent to accounting',
  'Billing Test status', // Mixed case
  'BILLING test STATUS', // Mixed case
];

console.log('Testing status matching:\n');

testStatuses.forEach(status => {
  const upperStatus = status.toUpperCase();
  const isMatch = ALLOWED_STATUSES.includes(upperStatus);
  console.log(`Status: "${status}"`);
  console.log(`  Upper: "${upperStatus}"`);
  console.log(`  Match: ${isMatch ? '✓' : '✗'}`);
  console.log('');
});
