# InkOps API Documentation

## Overview

InkOps provides a comprehensive REST API built on Supabase Edge Functions. All API endpoints use JWT-based authentication and follow RESTful conventions.

**Base URL:** `https://[your-project].supabase.co/functions/v1`

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Quotes API](#quotes-api)
  - [Portal Data API](#portal-data-api)
  - [Product Search API](#product-search-api)
  - [Email API](#email-api)
  - [Stripe Payments API](#stripe-payments-api)
- [Webhooks](#webhooks)
- [SDK Examples](#sdk-examples)

---

## Authentication

All API requests require authentication using a JWT token in the Authorization header.

### Request Headers

```http
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### Getting a JWT Token

Users authenticate through Supabase Auth and receive a JWT token:

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

const token = data.session.access_token;
```

### Customer Portal Authentication

Customer portal endpoints use a different authentication mechanism with magic tokens:

```http
X-Customer-Token: <magic-token>
```

---

## Error Handling

### Standard Error Response

All API errors follow this structure:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error context"
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 201  | Created |
| 400  | Bad Request - Invalid input |
| 401  | Unauthorized - Invalid or missing authentication |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource doesn't exist |
| 409  | Conflict - Resource already exists |
| 422  | Unprocessable Entity - Validation failed |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error |
| 503  | Service Unavailable |

### Common Error Codes

- `INVALID_JWT` - JWT token is invalid or expired
- `MISSING_AUTHORIZATION` - No authorization header provided
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `VALIDATION_ERROR` - Request validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## Rate Limiting

API requests are rate-limited to ensure fair usage:

- **Authenticated endpoints**: 100 requests per minute
- **Webhook endpoints**: 1000 requests per minute
- **Public endpoints**: 10 requests per minute per IP

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

---

## API Endpoints

### Quotes API

Manage quotes and proposals for customers.

#### List Quotes

Retrieve a paginated list of quotes with optional filtering.

**Endpoint:** `GET /quotes-api`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status (draft, sent, approved, etc.) |
| customer_id | uuid | No | Filter by customer ID |
| search | string | No | Search in quote number, customer name, or email |
| date_from | ISO 8601 | No | Filter quotes created after this date |
| date_to | ISO 8601 | No | Filter quotes created before this date |
| limit | integer | No | Number of results per page (default: 50, max: 100) |
| offset | integer | No | Pagination offset (default: 0) |

**Example Request:**

```bash
curl -X GET "https://your-project.supabase.co/functions/v1/quotes-api?status=sent&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "quotes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "quote_number": "Q-2024-001",
      "customer_name": "Acme Corporation",
      "customer_email": "contact@acme.com",
      "status": "sent",
      "subtotal": 1500.00,
      "tax_amount": 120.00,
      "total": 1620.00,
      "valid_until": "2024-04-01T00:00:00Z",
      "created_at": "2024-03-15T10:30:00Z",
      "customer": {
        "company_name": "Acme Corporation",
        "contact_name": "John Doe",
        "email": "contact@acme.com"
      }
    }
  ],
  "count": 45
}
```

#### Get Quote Details

Retrieve a single quote with all related data.

**Endpoint:** `GET /quotes-api/{quote_id}`

**Example Request:**

```bash
curl -X GET "https://your-project.supabase.co/functions/v1/quotes-api/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "quote": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "quote_number": "Q-2024-001",
    "customer_name": "Acme Corporation",
    "customer_email": "contact@acme.com",
    "status": "sent",
    "subtotal": 1500.00,
    "tax_rate": 0.08,
    "tax_amount": 120.00,
    "total": 1620.00,
    "notes": "Net 30 payment terms",
    "valid_until": "2024-04-01T00:00:00Z",
    "created_at": "2024-03-15T10:30:00Z"
  },
  "lineItems": [
    {
      "id": "line-1",
      "line_number": 1,
      "sku": "TSH-BLK-M",
      "description": "Black T-Shirt - Medium",
      "quantity": 100,
      "unit_price": 15.00,
      "total_price": 1500.00,
      "decoration_method": "Screen Print",
      "decoration_location": "Front"
    }
  ],
  "activityLog": [
    {
      "id": "log-1",
      "action": "quote_sent",
      "performed_by": "admin@inkops.com",
      "performed_at": "2024-03-15T10:35:00Z",
      "notes": "Quote sent to customer via email"
    }
  ],
  "approvals": []
}
```

#### Create Draft Quote

Create a minimal draft quote for building.

**Endpoint:** `POST /quotes-api/draft`

**Example Request:**

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/quotes-api/draft" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Example Response:**

```json
{
  "quote": {
    "id": "new-quote-id",
    "quote_number": "Q-2024-002",
    "customer_name": "Draft Quote",
    "status": "draft",
    "subtotal": 0,
    "tax_rate": 0,
    "tax_amount": 0,
    "total": 0,
    "autosave_enabled": true,
    "created_at": "2024-03-17T14:20:00Z"
  }
}
```

#### Create Quote

Create a new quote with line items.

**Endpoint:** `POST /quotes-api`

**Request Body:**

```json
{
  "customer_id": "customer-uuid",
  "customer_name": "Acme Corporation",
  "customer_email": "contact@acme.com",
  "customer_phone": "555-0123",
  "tax_rate": 0.08,
  "valid_until": "2024-04-01T00:00:00Z",
  "notes": "Net 30 payment terms",
  "line_items": [
    {
      "sku": "TSH-BLK-M",
      "description": "Black T-Shirt - Medium",
      "quantity": 100,
      "unit_price": 15.00,
      "decoration_method": "Screen Print",
      "decoration_location": "Front"
    }
  ]
}
```

**Example Response:**

```json
{
  "quote": {
    "id": "new-quote-id",
    "quote_number": "Q-2024-003",
    "customer_name": "Acme Corporation",
    "status": "draft",
    "total": 1620.00,
    "created_at": "2024-03-17T14:25:00Z"
  }
}
```

#### Update Quote

Update an existing quote.

**Endpoint:** `PUT /quotes-api/{quote_id}`

**Request Body:**

```json
{
  "customer_name": "Updated Company Name",
  "tax_rate": 0.085,
  "status": "sent",
  "line_items": [
    {
      "description": "Updated item",
      "quantity": 150,
      "unit_price": 14.50
    }
  ]
}
```

**Example Response:**

```json
{
  "quote": {
    "id": "quote-id",
    "quote_number": "Q-2024-001",
    "customer_name": "Updated Company Name",
    "status": "sent",
    "updated_at": "2024-03-17T14:30:00Z"
  }
}
```

#### Delete Quote

Delete a quote (Admin only).

**Endpoint:** `DELETE /quotes-api/{quote_id}`

**Example Request:**

```bash
curl -X DELETE "https://your-project.supabase.co/functions/v1/quotes-api/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "success": true
}
```

---

### Portal Data API

Retrieve customer-specific data for the customer portal.

#### Get Portal Data

**Endpoint:** `GET /portal-data?type={dataType}`

**Authentication:** Uses `X-Customer-Token` header

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | Yes | Data type: quotes, invoices, proofs, work_orders |

**Example Request:**

```bash
curl -X GET "https://your-project.supabase.co/functions/v1/portal-data?type=quotes" \
  -H "X-Customer-Token: CUSTOMER_MAGIC_TOKEN"
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "quote-id",
      "quote_number": "Q-2024-001",
      "created_at": "2024-03-15T10:30:00Z",
      "status": "sent",
      "subtotal": 1500.00,
      "tax_amount": 120.00,
      "quote_line_items": [
        {
          "description": "Black T-Shirt - Medium",
          "quantity": 100,
          "unit_price": 15.00,
          "total_price": 1500.00
        }
      ]
    }
  ]
}
```

---

### Product Search API

Search for products from integrated suppliers.

#### Search Products

**Endpoint:** `GET /product-search?style={styleNumber}`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| style | string | Yes | Product style number |
| companyId | uuid | No | Company ID (auto-detected from JWT if not provided) |

**Example Request:**

```bash
curl -X GET "https://your-project.supabase.co/functions/v1/product-search?style=PC54" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "success": true,
  "style": "PC54",
  "results": [
    {
      "supplier": "ssactivewear",
      "style": "PC54",
      "brand": "Port & Company",
      "description": "Core Cotton Tee",
      "category": "T-Shirts",
      "colors": [
        {
          "name": "Black",
          "code": "BLK",
          "partIds": ["B9876543"],
          "image_url": "https://cdn.example.com/pc54-black.jpg",
          "rear_image_url": "https://cdn.example.com/pc54-black-rear.jpg",
          "pricing": {
            "wholesale": 3.98,
            "retail": 7.99
          },
          "sizes": ["S", "M", "L", "XL", "2XL"],
          "stock": {
            "S": 1500,
            "M": 2000,
            "L": 1800
          }
        }
      ],
      "cached": true,
      "last_synced": "2024-03-17T10:00:00Z"
    }
  ],
  "count": 1,
  "diagnostics": {
    "companyId": "company-id",
    "sanmarEnabled": true,
    "ssaEnabled": true,
    "errors": []
  }
}
```

---

### Email API

Send transactional emails using templates or custom HTML.

#### Send Email

**Endpoint:** `POST /send-email`

**Request Body:**

```json
{
  "to": "customer@example.com",
  "subject": "Your Invoice is Ready",
  "template": "invoice-reminder",
  "data": {
    "customerName": "John Doe",
    "invoiceNumber": "INV-2024-001",
    "amountDue": "1620.00",
    "dueDate": "2024-04-01",
    "companyName": "InkOps",
    "companyEmail": "billing@inkops.com"
  },
  "shortCodeData": {
    "customer": {
      "name": "John Doe",
      "email": "customer@example.com"
    },
    "invoice": {
      "number": "INV-2024-001",
      "total": 1620.00,
      "balance": 1620.00
    }
  }
}
```

**Available Templates:**

- `invoice-reminder` - Payment reminder for pending invoices
- `payment-received` - Confirmation of payment receipt
- `overdue-notice` - Notice for overdue invoices
- `welcome` - Welcome email for new customers
- `custom` - Custom HTML template

**Example Request:**

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/send-email" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "customer@example.com",
    "subject": "Invoice Reminder",
    "template": "invoice-reminder",
    "data": {
      "customerName": "John Doe",
      "invoiceNumber": "INV-2024-001",
      "amountDue": "1620.00"
    }
  }'
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": "email-id-123",
    "from": "noreply@inkops.com",
    "to": ["customer@example.com"],
    "created_at": "2024-03-17T14:30:00Z"
  }
}
```

#### Send Email with Custom HTML

**Request Body:**

```json
{
  "to": ["customer@example.com"],
  "subject": "Custom Email",
  "template": "custom",
  "html": "<html><body><h1>Hello {{customer.name}}</h1><p>Your balance is {{invoice.balance|currency}}</p></body></html>",
  "shortCodeData": {
    "customer": {
      "name": "John Doe"
    },
    "invoice": {
      "balance": 1620.00
    }
  },
  "attachments": [
    {
      "filename": "invoice.pdf",
      "content": "base64-encoded-content",
      "type": "application/pdf"
    }
  ]
}
```

---

### Stripe Payments API

Process payments and manage Stripe integration.

#### Test Connection

Verify Stripe API credentials are valid.

**Endpoint:** `POST /stripe-proxy`

**Request Body:**

```json
{
  "action": "testConnection"
}
```

**Example Response:**

```json
{
  "success": true,
  "message": "Successfully connected to Stripe!",
  "balance": {
    "available": 5420.50,
    "pending": 1200.00,
    "currency": "usd"
  }
}
```

#### Create Payment Link

Generate a Stripe payment link for an invoice.

**Endpoint:** `POST /stripe-proxy`

**Request Body:**

```json
{
  "action": "createPaymentLink",
  "data": {
    "amount": 162000,
    "currency": "usd",
    "description": "Invoice INV-2024-001",
    "customerEmail": "customer@example.com",
    "metadata": {
      "invoice_id": "inv-uuid",
      "invoice_number": "INV-2024-001"
    }
  }
}
```

**Example Response:**

```json
{
  "paymentLinkId": "plink_1234567890",
  "url": "https://buy.stripe.com/test_xxxxxxxxx"
}
```

#### Create Invoice with Minimum Due

Create a Stripe invoice with partial payment options.

**Endpoint:** `POST /stripe-proxy`

**Request Body:**

```json
{
  "action": "createInvoiceWithMinimumDue",
  "data": {
    "totalAmount": 162000,
    "minimumDue": 50000,
    "currency": "usd",
    "customerEmail": "customer@example.com",
    "customerName": "John Doe",
    "description": "Invoice INV-2024-001 - Minimum payment $500",
    "metadata": {
      "invoice_id": "inv-uuid",
      "minimum_payment": "50000"
    }
  }
}
```

**Example Response:**

```json
{
  "invoiceId": "in_1234567890",
  "customerId": "cus_1234567890",
  "hostedInvoiceUrl": "https://invoice.stripe.com/i/xxxxx",
  "invoicePdfUrl": "https://pay.stripe.com/invoice/xxxxx/pdf",
  "status": "open",
  "amountDue": 162000,
  "amountPaid": 0,
  "minimumDue": 50000
}
```

#### Get Invoice Status

Check the status of a Stripe invoice.

**Endpoint:** `POST /stripe-proxy`

**Request Body:**

```json
{
  "action": "getInvoice",
  "data": {
    "invoiceId": "in_1234567890"
  }
}
```

**Example Response:**

```json
{
  "invoiceId": "in_1234567890",
  "status": "paid",
  "amountDue": 162000,
  "amountPaid": 162000,
  "amountRemaining": 0,
  "hostedInvoiceUrl": "https://invoice.stripe.com/i/xxxxx",
  "invoicePdfUrl": "https://pay.stripe.com/invoice/xxxxx/pdf"
}
```

#### Create Refund

Process a refund for a payment (Admin only).

**Endpoint:** `POST /stripe-proxy`

**Request Body:**

```json
{
  "action": "createRefund",
  "data": {
    "paymentId": "pi_1234567890",
    "amount": 50000,
    "reason": "requested_by_customer"
  }
}
```

**Example Response:**

```json
{
  "id": "re_1234567890",
  "amount": 50000,
  "currency": "usd",
  "status": "succeeded",
  "payment_intent": "pi_1234567890"
}
```

---

## Webhooks

InkOps supports webhooks for real-time event notifications.

### Stripe Webhook

Receive payment events from Stripe.

**Endpoint:** `POST /stripe-webhook`

**Webhook Events:**

- `payment_intent.succeeded` - Payment completed
- `payment_intent.payment_failed` - Payment failed
- `invoice.paid` - Invoice paid
- `invoice.payment_failed` - Invoice payment failed
- `charge.refunded` - Refund processed

**Example Payload:**

```json
{
  "id": "evt_1234567890",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "amount": 162000,
      "currency": "usd",
      "status": "succeeded",
      "metadata": {
        "invoice_id": "inv-uuid"
      }
    }
  }
}
```

### ShipStation Webhook

Receive shipping updates from ShipStation.

**Endpoint:** `POST /shipstation-webhook`

**Webhook Events:**

- `SHIP_NOTIFY` - Shipment created
- `ITEM_SHIPPED` - Item shipped
- `ITEM_ORDER_NOTIFY` - Order notification

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

// Authenticate
const { data: authData } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

const token = authData.session.access_token;

// List quotes
const response = await fetch(
  'https://your-project.supabase.co/functions/v1/quotes-api?status=sent',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const { quotes } = await response.json();
```

### Python

```python
import requests

# Authenticate
auth_response = requests.post(
    'https://your-project.supabase.co/auth/v1/token?grant_type=password',
    json={
        'email': 'user@example.com',
        'password': 'password'
    },
    headers={'apikey': 'your-anon-key'}
)

token = auth_response.json()['access_token']

# List quotes
quotes_response = requests.get(
    'https://your-project.supabase.co/functions/v1/quotes-api',
    params={'status': 'sent'},
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
)

quotes = quotes_response.json()['quotes']
```

### cURL

```bash
# Authenticate (using Supabase auth)
curl -X POST 'https://your-project.supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "password"
  }'

# Use the token from response
export TOKEN="your-jwt-token"

# List quotes
curl -X GET 'https://your-project.supabase.co/functions/v1/quotes-api?status=sent' \
  -H "Authorization: Bearer $TOKEN"
```

---

## API Documentation Tools

### Recommended Tools for Auto-Documentation

#### 1. **OpenAPI/Swagger**

Generate interactive API documentation from OpenAPI specifications.

**Setup:**

Create an `openapi.yaml` file:

```yaml
openapi: 3.0.0
info:
  title: InkOps API
  version: 1.0.0
  description: Print shop management and automation API

servers:
  - url: https://your-project.supabase.co/functions/v1
    description: Production

paths:
  /quotes-api:
    get:
      summary: List quotes
      security:
        - bearerAuth: []
      parameters:
        - name: status
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QuotesList'
```

**Tools:**
- Swagger UI: Interactive documentation
- Redoc: Clean, responsive documentation
- Postman: Import OpenAPI for testing

#### 2. **Postman Collections**

Create and share API collections for testing.

**Export Collection:**
```json
{
  "info": {
    "name": "InkOps API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Quotes",
      "item": [
        {
          "name": "List Quotes",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{jwt_token}}"
              }
            ],
            "url": "{{base_url}}/quotes-api?status=sent"
          }
        }
      ]
    }
  ]
}
```

#### 3. **TypeDoc (TypeScript Projects)**

Auto-generate documentation from TypeScript code comments.

```typescript
/**
 * List all quotes with optional filtering
 * @param {string} status - Filter by quote status
 * @param {number} limit - Number of results per page
 * @returns {Promise<Quote[]>} Array of quotes
 * @throws {Error} If authentication fails
 */
async function listQuotes(status?: string, limit: number = 50): Promise<Quote[]> {
  // Implementation
}
```

#### 4. **API Blueprint**

Markdown-based API documentation.

```markdown
# Group Quotes

## Quotes Collection [/quotes-api]

### List Quotes [GET /quotes-api{?status,limit}]

+ Parameters
    + status (string, optional) - Filter by status
    + limit (number, optional) - Results per page
        + Default: 50

+ Response 200 (application/json)
    + Attributes (QuotesList)
```

#### 5. **Docusaurus**

Build a comprehensive documentation website.

**Installation:**
```bash
npm install @docusaurus/core @docusaurus/preset-classic
```

**Structure:**
```
docs/
├── api/
│   ├── authentication.md
│   ├── quotes.md
│   ├── payments.md
│   └── webhooks.md
├── guides/
│   ├── getting-started.md
│   └── integration.md
└── reference/
    └── error-codes.md
```

### Best Practices for API Documentation

1. **Keep it up-to-date**: Update docs with every API change
2. **Include examples**: Real-world request/response examples
3. **Version your API**: Support multiple versions with clear migration paths
4. **Error documentation**: Document all possible error codes
5. **Rate limits**: Clearly state rate limits and quotas
6. **Changelog**: Maintain a detailed changelog
7. **SDK examples**: Provide code examples in multiple languages
8. **Interactive testing**: Use Swagger UI or similar for live testing
9. **Authentication guide**: Clear authentication setup instructions
10. **Webhook documentation**: Document webhook payloads and retry logic

---

## Support

For API support, contact:
- **Email:** api-support@inkops.com
- **Documentation:** https://docs.inkops.com
- **Status Page:** https://status.inkops.com

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and updates.
