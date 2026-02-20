# ShipStation Integration Summary

## Overview
Complete ShipStation integration for sending invoices as shipping orders, with full UI controls and audit logging.

## Backend Implementation

### Database Changes

#### Migration 1: `add_shipstation_order_tracking`
Added tracking columns to `printavo_invoices`:
- `shipping_status` - Current status (pending, sent_to_shipstation, shipped, delivered, cancelled)
- `shipstation_order_id` - ShipStation's order ID
- `shipstation_order_key` - Order key (invoice UUID)
- `shipstation_sent_at` - Timestamp when sent
- Indexes for performance

#### Migration 2: `create_shipstation_audit_log`
Created `shipstation_order_log` table:
- Complete audit trail of all API interactions
- Stores request/response payloads
- Tracks status codes and errors
- Company-scoped with RLS policies

### Edge Function: `send-shipstation-order`

**Endpoint:** `POST /functions/v1/send-shipstation-order`

**Request Body:**
```json
{
  "invoice_id": "invoice-uuid"
}
```

**Features:**
- Fetches invoice details, line items, and customer information
- Retrieves encrypted ShipStation API credentials
- Builds ShipStation-compliant order payload
- Posts to ShipStation's `/orders/createorder` endpoint
- Updates invoice shipping status
- Comprehensive error handling
- Full audit logging

**Response:**
```json
{
  "success": true,
  "message": "Order successfully sent to ShipStation",
  "shipstation_order_id": "12345",
  "shipstation_order_number": "INV-001",
  "order_key": "invoice-uuid"
}
```

**Error Handling:**
- 401: Invalid API credentials
- 400: Missing credentials or already sent
- 404: Invoice not found
- All errors logged to audit table

## Frontend Implementation

### Invoice Detail UI Changes

**New Button (Top Action Bar):**
- Label: "Send to ShipStation"
- Icon: Truck
- Color: Blue (primary)
- Only shows when:
  - `invoice.status_stage !== "draft"`
  - `shipping_status` is NULL or "not_sent"

**Status Badge:**
- Displayed under invoice number
- Shows: "ShipStation: Order Created" (green) or "ShipStation: Not Sent" (gray)
- Real-time status indicator

**Confirmation Modal:**
- User confirms before sending
- Shows invoice number
- Clear action description

**User Flow:**
1. User clicks "Send to ShipStation" button
2. Confirmation modal appears
3. User confirms or cancels
4. Loading state during API call
5. Success: Toast notification + status badge updates
6. Error: Toast with error message

## ShipStation Order Payload

```javascript
{
  orderNumber: "INV-001",
  orderKey: "invoice-uuid",
  orderDate: "2024-01-01T00:00:00Z",
  orderStatus: "awaiting_shipment",
  customerEmail: "customer@example.com",
  billTo: {
    name: "Customer Name",
    street1: "123 Main St",
    city: "City",
    state: "ST",
    postalCode: "12345",
    country: "US",
    phone: "555-1234"
  },
  shipTo: { /* same structure */ },
  items: [
    {
      sku: "ITEM-001",
      name: "Product Name",
      quantity: 10,
      unitPrice: 25.00,
      weight: { value: 8, units: "ounces" }
    }
  ],
  amountPaid: 250.00,
  internalNotes: "InkOps Invoice: INV-001"
}
```

## Security Features

- Encrypted API credentials (uses crypto-service)
- Company-scoped data access
- RLS policies on all tables
- User authentication required
- Audit trail for compliance

## Audit Logging

Every API interaction is logged with:
- Request payload
- Response payload
- HTTP status code
- Error messages (if any)
- User who triggered action
- Timestamp

View logs in `shipstation_order_log` table.

## Usage Example

```typescript
// Frontend call
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/send-shipstation-order`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ invoice_id: 'uuid' }),
  }
);

const result = await response.json();
if (result.success) {
  // Order created successfully
  console.log('ShipStation Order ID:', result.shipstation_order_id);
}
```

## Prevents Duplicate Submissions

- Checks if invoice already sent to ShipStation
- Uses `orderKey` (invoice UUID) for deduplication
- Returns clear error if already sent

## Production Ready

- Comprehensive error handling
- Loading states
- User feedback (toasts)
- Audit logging
- Security best practices
- TypeScript types
- Responsive design
