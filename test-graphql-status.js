// Test if Printavo GraphQL supports status filtering

async function testGraphQL() {
  const email = 'jamie@toddssportinggoods.com';
  const token = 'ba59c8e51bf7f1c00e8a7e69d8fa63b4'; // this needs to be decrypted from DB

  const query1 = `
    query GetInvoices {
      invoices(first: 5, sortDescending: true) {
        edges {
          node {
            id
            visualId
            status {
              name
            }
            createdAt
            total
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  console.log('Testing GraphQL without status filter...');
  const resp1 = await fetch('https://www.printavo.com/api/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'email': email,
      'token': token
    },
    body: JSON.stringify({ query: query1 })
  });

  const data1 = await resp1.json();
  console.log('Response status:', resp1.status);
  console.log('Invoices found:', data1.data?.invoices?.edges?.length || 0);

  if (data1.data?.invoices?.edges) {
    console.log('\nInvoice statuses:');
    data1.data.invoices.edges.forEach((edge, i) => {
      console.log(`  ${i + 1}. Invoice ${edge.node.visualId}: ${edge.node.status?.name}`);
    });
  }

  console.log('\nFull response:', JSON.stringify(data1, null, 2));

  // Now test with status filter
  const query2 = `
    query GetInvoicesByStatus($status: String) {
      invoices(first: 5, status: $status, sortDescending: true) {
        edges {
          node {
            id
            visualId
            status {
              name
            }
          }
        }
      }
    }
  `;

  console.log('\n\nTesting GraphQL WITH status filter...');
  const resp2 = await fetch('https://www.printavo.com/api/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'email': email,
      'token': token
    },
    body: JSON.stringify({
      query: query2,
      variables: { status: 'Billing Test Status' }
    })
  });

  const data2 = await resp2.json();
  console.log('Response status:', resp2.status);
  console.log('Response:', JSON.stringify(data2, null, 2));
}

testGraphQL().catch(console.error);
