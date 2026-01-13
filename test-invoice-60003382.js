// Test to fetch invoice 60003382 details from Printavo
const query = `
  query GetInvoice($id: ID!) {
    invoice(id: $id) {
      id
      visualId
      lineItemGroups {
        edges {
          node {
            id
            name
            lineItems {
              edges {
                node {
                  id
                  description
                  items
                  price
                  color
                  sizes
                  itemNumber
                  product
                }
              }
            }
          }
        }
      }
    }
  }
`;

console.log('Query for invoice 21589894 (visual ID 60003382):');
console.log(JSON.stringify({ query, variables: { id: "21589894" } }, null, 2));
