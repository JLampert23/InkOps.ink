# Stripe Partial Payments Guide

## The Issue

Stripe's Invoice API does not support a native "minimum payment amount" parameter. The `minimum_amount_due` field that exists in Stripe's API is **read-only** and cannot be set directly when creating or finalizing an invoice.

## Solutions for 50% Down Payment

Here are the recommended approaches to handle 50% down payment requirements:

### Option 1: Two Separate Invoices (Recommended)

Create two invoices - one for the down payment (50%) and one for the balance (50%).

**Pros:**
- Clean separation of payments
- Easy to track in Stripe
- Customer can see exactly what they're paying

**Cons:**
- Two separate invoices to manage
- Requires customer to complete two transactions

**Implementation:**
1. Create first invoice for 50% of total
2. Mark as "Down Payment" in description
3. After payment, create second invoice for remaining 50%

### Option 2: Payment Links with Descriptions

Use Stripe Payment Links instead of invoices, with clear descriptions about the 50% requirement.

**Pros:**
- Simpler implementation
- Single transaction
- Can add custom messaging

**Cons:**
- Less formal than invoices
- Harder to track partial payments

### Option 3: Accept Partial Payments (Current Implementation)

The current implementation creates a full invoice that allows customers to pay any amount. While Stripe will accept partial payments on invoices, it doesn't enforce a minimum.

**How it works:**
- Invoice created for full amount
- Customer can pay full amount OR any partial amount
- `minimum_due_amount` is stored in your database for reference
- You must manually track and enforce the 50% minimum through your application logic

**Pros:**
- Flexible payment options
- Single invoice
- Tracks all payments against one invoice

**Cons:**
- No automatic enforcement of 50% minimum
- Requires manual review of payments
- Customer might pay less than 50%

## Recommended Workflow

### For 50% Down Payment Enforcement:

1. **Calculate Amounts:**
   ```typescript
   const totalAmount = 1000; // $10.00
   const downPayment = totalAmount * 0.50; // $5.00
   const balanceAmount = totalAmount - downPayment; // $5.00
   ```

2. **Create Down Payment Invoice:**
   - Amount: 50% of total
   - Description: "Down Payment (50%) - Invoice #12345"
   - Due immediately

3. **After Down Payment Received:**
   - Create balance invoice
   - Amount: Remaining 50%
   - Description: "Balance Due - Invoice #12345"
   - Link to original invoice in metadata

4. **Track in Your Database:**
   - Store both invoice IDs
   - Link them to the same Printavo invoice
   - Update status when both are paid

## Stripe Settings to Enable

### In Your Stripe Dashboard:

1. **Enable Hosted Invoice Page:**
   - Settings → Invoices
   - Enable "Hosted invoice page"
   - This allows customers to view and pay invoices online

2. **Enable Partial Payments (Optional):**
   - Settings → Invoices
   - Enable "Allow partial payments"
   - Set minimum payment amount (Note: This is a global setting, not per-invoice)

3. **Configure Payment Methods:**
   - Settings → Payment methods
   - Enable desired payment methods (Card, ACH, etc.)

4. **Email Settings:**
   - Settings → Invoices → Email settings
   - Configure invoice email templates
   - Set up automatic reminders

### Important Notes:

- Stripe's global "minimum payment amount" setting applies to ALL invoices
- It cannot be set per-invoice through the API
- You must handle invoice-specific minimum payments through your application logic

## Current System Behavior

The system currently:
1. Creates a Stripe invoice for the full amount
2. Stores the `minimum_due_amount` (50%) in your database
3. Allows customers to make partial payments
4. **Does NOT enforce** the 50% minimum at Stripe level

To enforce the 50% minimum, you must:
- Check payment amounts in your application
- Reject or warn about payments below 50%
- Or implement Option 1 (two separate invoices)

## Implementation Recommendation

For the best user experience with 50% down payment enforcement, implement **Option 1** (Two Separate Invoices):

```typescript
// Create down payment invoice (50%)
const downPaymentInvoice = await createStripeInvoice({
  amount: totalAmount * 0.50,
  description: `Down Payment (50%) - Order #${orderId}`,
  dueDate: 'immediate',
});

// After down payment is received (webhook)
const balanceInvoice = await createStripeInvoice({
  amount: totalAmount * 0.50,
  description: `Balance Due - Order #${orderId}`,
  dueDate: '+30 days',
  metadata: {
    related_invoice: downPaymentInvoice.id,
    payment_type: 'balance',
  },
});
```

This approach provides:
- Clear payment expectations
- Automatic enforcement of 50% down payment
- Easy tracking and reconciliation
- Better customer experience
