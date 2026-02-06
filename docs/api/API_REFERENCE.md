# Printavo API v2 - GraphQL Reference

This document provides examples of GraphQL queries used in InkOps and expected response formats.

## API Endpoint

```
POST https://www.printavo.com/api/v2
```

## Authentication Headers

```json
{
  "Content-Type": "application/json",
  "email": "your-email@example.com",
  "token": "your-api-token"
}
```

## Rate Limits

- **10 requests per 5 seconds** per user/IP
- Exceeded limits return HTTP 429 (Too Many Requests)
- InkOps implements automatic throttling to stay within limits

---

## Invoices Query

### Request

```graphql
query GetInvoices($after: String, $first: Int = 50) {
  invoices(after: $after, first: $first) {
    edges {
      cursor
      node {
        id
        invoiceNumber
        status
        createdAt
        dueDate
        total
        subtotal
        tax
        customer {
          id
          name
          email
        }
        lineItems {
          edges {
            node {
              id
              name
              quantity
              price
            }
          }
        }
        payments {
          edges {
            node {
              id
              amount
              date
              method
            }
          }
        }
        fees {
          edges {
            node {
              id
              name
              amount
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Example Response

```json
{
  "data": {
    "invoices": {
      "edges": [
        {
          "cursor": "YXJyYXljb25uZWN0aW9uOjA=",
          "node": {
            "id": "SW52b2ljZS0xMjM0NQ==",
            "invoiceNumber": "INV-2024-001",
            "status": "paid",
            "createdAt": "2024-01-15T10:30:00Z",
            "dueDate": "2024-02-15T10:30:00Z",
            "total": 1250.00,
            "subtotal": 1000.00,
            "tax": 80.00,
            "customer": {
              "id": "Q3VzdG9tZXItNzg5",
              "name": "Acme Corporation",
              "email": "orders@acme.com"
            },
            "lineItems": {
              "edges": [
                {
                  "node": {
                    "id": "TGluZUl0ZW0tMQ==",
                    "name": "Custom T-Shirts (500 qty)",
                    "quantity": 500,
                    "price": 2.00
                  }
                }
              ]
            },
            "payments": {
              "edges": [
                {
                  "node": {
                    "id": "UGF5bWVudC0xMjM=",
                    "amount": 1250.00,
                    "date": "2024-01-20T14:22:00Z",
                    "method": "credit_card"
                  }
                }
              ]
            },
            "fees": {
              "edges": [
                {
                  "node": {
                    "id": "RmVlLTQ1Ng==",
                    "name": "Rush Fee",
                    "amount": 170.00
                  }
                }
              ]
            }
          }
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "endCursor": "YXJyYXljb25uZWN0aW9uOjQ5"
      }
    }
  }
}
```

---

## Payments Query

### Request

```graphql
query GetPayments($after: String, $first: Int = 50) {
  payments(after: $after, first: $first) {
    edges {
      cursor
      node {
        id
        amount
        date
        method
        invoice {
          id
          invoiceNumber
          customer {
            id
            name
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Example Response

```json
{
  "data": {
    "payments": {
      "edges": [
        {
          "cursor": "YXJyYXljb25uZWN0aW9uOjA=",
          "node": {
            "id": "UGF5bWVudC0xMjM0NQ==",
            "amount": 1250.00,
            "date": "2024-01-20T14:22:00Z",
            "method": "credit_card",
            "invoice": {
              "id": "SW52b2ljZS0xMjM0NQ==",
              "invoiceNumber": "INV-2024-001",
              "customer": {
                "id": "Q3VzdG9tZXItNzg5",
                "name": "Acme Corporation"
              }
            }
          }
        },
        {
          "cursor": "YXJyYXljb25uZWN0aW9uOjE=",
          "node": {
            "id": "UGF5bWVudC0xMjM0Ng==",
            "amount": 750.50,
            "date": "2024-01-21T09:15:00Z",
            "method": "bank_transfer",
            "invoice": {
              "id": "SW52b2ljZS0xMjM0Ng==",
              "invoiceNumber": "INV-2024-002",
              "customer": {
                "id": "Q3VzdG9tZXItNzkw",
                "name": "Widget Industries"
              }
            }
          }
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "endCursor": "YXJyYXljb25uZWN0aW9uOjQ5"
      }
    }
  }
}
```

---

## Estimates Query

### Request

```graphql
query GetEstimates($after: String, $first: Int = 50) {
  estimates(after: $after, first: $first) {
    edges {
      cursor
      node {
        id
        quoteNumber
        total
        subtotal
        tax
        createdAt
        status
        convertedToInvoice
        customer {
          id
          name
          email
        }
        lineItems {
          edges {
            node {
              id
              name
              quantity
              price
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Example Response

```json
{
  "data": {
    "estimates": {
      "edges": [
        {
          "cursor": "YXJyYXljb25uZWN0aW9uOjA=",
          "node": {
            "id": "RXN0aW1hdGUtMTIzNDU=",
            "quoteNumber": "QT-2024-001",
            "total": 2500.00,
            "subtotal": 2100.00,
            "tax": 168.00,
            "createdAt": "2024-01-10T11:00:00Z",
            "status": "approved",
            "convertedToInvoice": true,
            "customer": {
              "id": "Q3VzdG9tZXItNzg5",
              "name": "Acme Corporation",
              "email": "orders@acme.com"
            },
            "lineItems": {
              "edges": [
                {
                  "node": {
                    "id": "TGluZUl0ZW0tMQ==",
                    "name": "Custom Hoodies (200 qty)",
                    "quantity": 200,
                    "price": 10.50
                  }
                }
              ]
            }
          }
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "endCursor": "YXJyYXljb25uZWN0aW9uOjQ5"
      }
    }
  }
}
```

---

## Customers Query

### Request

```graphql
query GetCustomers($after: String, $first: Int = 50) {
  customers(after: $after, first: $first) {
    edges {
      cursor
      node {
        id
        name
        email
        phone
        company
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Example Response

```json
{
  "data": {
    "customers": {
      "edges": [
        {
          "cursor": "YXJyYXljb25uZWN0aW9uOjA=",
          "node": {
            "id": "Q3VzdG9tZXItNzg5",
            "name": "Acme Corporation",
            "email": "orders@acme.com",
            "phone": "+1-555-123-4567",
            "company": "Acme Corp",
            "createdAt": "2023-05-15T08:00:00Z"
          }
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "endCursor": "YXJyYXljb25uZWN0aW9uOjQ5"
      }
    }
  }
}
```

---

## Customer Financials Query

### Request

```graphql
query GetCustomerFinancials($customerId: ID!) {
  customer(id: $customerId) {
    id
    name
    email
    invoices {
      edges {
        node {
          id
          invoiceNumber
          total
          status
          createdAt
          payments {
            edges {
              node {
                id
                amount
                date
                method
              }
            }
          }
        }
      }
    }
    estimates {
      edges {
        node {
          id
          quoteNumber
          total
          status
          createdAt
          convertedToInvoice
        }
      }
    }
  }
}
```

### Example Response

```json
{
  "data": {
    "customer": {
      "id": "Q3VzdG9tZXItNzg5",
      "name": "Acme Corporation",
      "email": "orders@acme.com",
      "invoices": {
        "edges": [
          {
            "node": {
              "id": "SW52b2ljZS0xMjM0NQ==",
              "invoiceNumber": "INV-2024-001",
              "total": 1250.00,
              "status": "paid",
              "createdAt": "2024-01-15T10:30:00Z",
              "payments": {
                "edges": [
                  {
                    "node": {
                      "id": "UGF5bWVudC0xMjM=",
                      "amount": 1250.00,
                      "date": "2024-01-20T14:22:00Z",
                      "method": "credit_card"
                    }
                  }
                ]
              }
            }
          }
        ]
      },
      "estimates": {
        "edges": [
          {
            "node": {
              "id": "RXN0aW1hdGUtMTIzNDU=",
              "quoteNumber": "QT-2024-001",
              "total": 2500.00,
              "status": "approved",
              "createdAt": "2024-01-10T11:00:00Z",
              "convertedToInvoice": true
            }
          }
        ]
      }
    }
  }
}
```

---

## Tasks Query (Optional)

### Request

```graphql
query GetTasks($after: String, $first: Int = 50) {
  tasks(after: $after, first: $first) {
    edges {
      cursor
      node {
        id
        name
        dueDate
        completed
        invoice {
          id
          invoiceNumber
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

---

## Common Invoice Statuses

- `draft` - Invoice has been created but not sent
- `pending` - Invoice sent, awaiting payment
- `paid` - Invoice fully paid
- `overdue` - Invoice past due date and unpaid
- `cancelled` - Invoice cancelled
- `partial` - Invoice partially paid

## Common Payment Methods

- `credit_card` - Credit card payment
- `bank_transfer` - Bank transfer / ACH
- `check` - Check payment
- `cash` - Cash payment
- `paypal` - PayPal payment
- `other` - Other payment method

## Common Estimate Statuses

- `draft` - Estimate created but not sent
- `sent` - Estimate sent to customer
- `approved` - Customer approved estimate
- `rejected` - Customer rejected estimate
- `expired` - Estimate expired

---

## Pagination Pattern

All queries use cursor-based pagination:

1. **First Request**: Omit `after` parameter
   ```graphql
   query GetInvoices($first: Int = 50) {
     invoices(first: $first) { ... }
   }
   ```

2. **Subsequent Requests**: Use `endCursor` from previous response
   ```graphql
   query GetInvoices($after: String, $first: Int = 50) {
     invoices(after: $after, first: $first) { ... }
   }
   ```

3. **Check for More**: Use `pageInfo.hasNextPage`
   - `true`: More pages available, use `pageInfo.endCursor` for next request
   - `false`: No more pages, you have all data

## Error Responses

### Authentication Error (401)

```json
{
  "errors": [
    {
      "message": "Authentication failed",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

### Rate Limit Error (429)

```json
{
  "errors": [
    {
      "message": "Rate limit exceeded",
      "extensions": {
        "code": "RATE_LIMIT_EXCEEDED",
        "retryAfter": 5
      }
    }
  ]
}
```

### Invalid Query (400)

```json
{
  "errors": [
    {
      "message": "Field 'invalidField' doesn't exist on type 'Invoice'",
      "locations": [{ "line": 5, "column": 7 }],
      "extensions": {
        "code": "GRAPHQL_VALIDATION_FAILED"
      }
    }
  ]
}
```

---

## Tips for Using the API

1. **Always paginate**: Don't try to fetch all records in one request
2. **Use cursors**: They're more reliable than offset-based pagination
3. **Respect rate limits**: The dashboard's built-in throttling handles this
4. **Request only needed fields**: Smaller responses = faster performance
5. **Handle errors gracefully**: Network issues happen, implement retries
6. **Cache when possible**: Reduce API calls for static data

## Testing Queries

You can test queries using tools like:

- **GraphQL Playground**: https://www.printavo.com/api/v2/playground (if available)
- **Postman**: Create GraphQL requests with authentication headers
- **curl**: Command line testing

Example curl request:

```bash
curl -X POST https://www.printavo.com/api/v2 \
  -H "Content-Type: application/json" \
  -H "email: your-email@example.com" \
  -H "token: your-api-token" \
  -d '{
    "query": "query { invoices(first: 5) { edges { node { id invoiceNumber total } } pageInfo { hasNextPage endCursor } } }"
  }'
```

---

## Additional Resources

- **Printavo Support**: Contact Printavo for API-specific questions
- **GraphQL Spec**: https://graphql.org/learn/
- **Apollo Client Docs**: https://www.apollographql.com/docs/react/

---

This dashboard abstracts away the complexity of pagination, rate limiting, and error handling, allowing you to focus on analyzing your financial data.
