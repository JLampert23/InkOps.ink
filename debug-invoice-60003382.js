import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cuaukcvccxvfpuxaciac.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjA4NTQsImV4cCI6MjA4MjEzNjg1NH0.I-FDsR0oezVPxKcWgFmV-MMolV6E-lYcoA7Ew8ZgKYU';

const supabase = createClient(supabaseUrl, supabaseKey);

const query = `
  query GetInvoice($id: ID!) {
    invoice(id: $id) {
      id
      visualId
      lineItemGroups {
        edges {
          node {
            id
            lineItems {
              edges {
                node {
                  id
                  description
                  items
                  price
                  color
                  sizes {
                    count
                    size
                  }
                  itemNumber
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function testInvoice() {
  try {
    const apiUrl = `${supabaseUrl}/functions/v1/printavo-proxy`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { id: '21589894' }
      })
    });

    const result = await response.json();
    console.log('Full response:', JSON.stringify(result, null, 2));

    if (result.data?.invoice?.lineItemGroups?.edges) {
      console.log('\n\nLine Items:');
      for (const group of result.data.invoice.lineItemGroups.edges) {
        console.log('\nGroup ID:', group.node.id);
        if (group.node.lineItems?.edges) {
          for (const item of group.node.lineItems.edges) {
            console.log('  Item:', JSON.stringify(item.node, null, 4));
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testInvoice();
