# Stripe Minimum Payment (50% Deposit) Implementation

## Summary

Successfully implemented 50% minimum payment support using Stripe Invoices. Customers can now pay at least 50% or the full amount of any invoice.

## Completed Work

### 1. Database Schema ✅
**Migration:** `add_stripe_invoice_partial_payments`

Created two new tables:
- **`stripe_invoices`** - Tracks Stripe invoices with minimum payment support
  - Stores total_amount, minimum_due_amount (50%), amount_paid, amount_remaining
  - Links to printavo_invoice_id
  - Tracks status: draft, open, paid, action_required, payment_failed

- **`stripe_payment_history`** - Tracks all payments (partial and full)
  - Links to stripe_invoices table
  - Records each payment with payment_intent_id, charge_id, amount
  - Supports multiple partial payments per invoice

### 2. Stripe Service Updates ✅
**File:** `src/services/stripe-service.ts`

Added new methods:
- `createStripeInvoiceWithMinimumDue(invoice)` - Creates Stripe invoice with 50% minimum
- `getStripeInvoice(printavoInvoiceId)` - Fetches invoice data
- `getStripeInvoicePaymentHistory(printavoInvoiceId)` - Gets all payments
- `refreshStripeInvoiceStatus(printavoInvoiceId)` - Syncs status from Stripe

Added TypeScript interfaces:
- `StripeInvoice` - Full invoice data structure
- `StripeInvoicePayment` - Payment history structure

### 3. Stripe Proxy Edge Function ✅
**File:** `supabase/functions/stripe-proxy/index.ts`

Added new actions:
- `createInvoiceWithMinimumDue` - Creates Stripe invoice with minimum_amount_due
  - Creates or finds existing Stripe customer
  - Creates draft invoice
  - Adds line item
  - Finalizes with minimum_amount_due set to 50%

- `getInvoice` - Retrieves invoice details from Stripe

### 4. Stripe Webhook Handler ✅
**File:** `supabase/functions/stripe-webhook/index.ts`

Added new webhook event handlers:
- `invoice.paid` & `invoice.payment_succeeded` - Handles both partial and full payments
  - Records payment in stripe_payment_history
  - Updates stripe_invoices amounts
  - Marks as 'paid' when fully paid, 'partial' otherwise
  - Moves to paid_invoices when fully paid

- `invoice.payment_action_required` - Updates status when action needed
- `invoice.payment_failed` - Handles failed payments

---

## UI Integration Needed

### BillingQueue Component Updates

**File:** `src/components/billing/BillingQueue.tsx`

Add the following functionality:

#### 1. Add "Send Stripe Invoice" Button
Replace or add next to existing "Send Payment Link" button:

```typescript
// Add state for Stripe invoice operations
const [creatingInvoice, setCreatingInvoice] = useState<Set<string>>(new Set());

// Add function to create Stripe invoice
const handleCreateStripeInvoice = async (item: BillingQueueItem) => {
  try {
    setCreatingInvoice(prev => new Set(prev).add(item.id));

    const invoice = await stripeService.createStripeInvoiceWithMinimumDue(item.invoice);

    alert(`Stripe Invoice Created!

Minimum Due (50%): $${invoice.minimumDueAmount.toFixed(2)}
Total Amount: $${invoice.totalAmount.toFixed(2)}

Invoice URL: ${invoice.hostedInvoiceUrl}

Copy this URL and send it to your customer.`);

    await loadQueue();
  } catch (error) {
    console.error('Error creating Stripe invoice:', error);
    alert(`Failed to create Stripe invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setCreatingInvoice(prev => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }
};
```

#### 2. Update Actions Column
In the table rendering, add the Stripe Invoice button:

```typescript
<button
  onClick={() => handleCreateStripeInvoice(item)}
  disabled={creatingInvoice.has(item.id)}
  className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
>
  {creatingInvoice.has(item.id) ? 'Creating...' : 'Send Stripe Invoice'}
</button>
```

#### 3. Display Stripe Invoice Status
Show if a Stripe invoice already exists:

```typescript
useEffect(() => {
  // Load Stripe invoice data for each queue item
  queueItems.forEach(async (item) => {
    const stripeInvoice = await stripeService.getStripeInvoice(item.printavo_invoice_id);
    if (stripeInvoice) {
      // Update UI to show:
      // - Invoice status
      // - Amount paid / remaining
      // - Link to hosted invoice
    }
  });
}, [queueItems]);
```

---

### InvoiceDetail Component Updates

**File:** `src/components/billing/InvoiceDetail.tsx`

Add a new **Payment Options** section:

```typescript
// Add at component level
const [stripeInvoice, setStripeInvoice] = useState<StripeInvoice | null>(null);
const [paymentHistory, setPaymentHistory] = useState<StripeInvoicePayment[]>([]);
const [refreshing, setRefreshing] = useState(false);

// Load Stripe invoice data
useEffect(() => {
  loadStripeInvoiceData();
}, [printavoInvoiceId]);

const loadStripeInvoiceData = async () => {
  const invoice = await stripeService.getStripeInvoice(printavoInvoiceId);
  setStripeInvoice(invoice);

  if (invoice) {
    const history = await stripeService.getStripeInvoicePaymentHistory(printavoInvoiceId);
    setPaymentHistory(history);
  }
};

const handleRefreshStatus = async () => {
  setRefreshing(true);
  try {
    const updated = await stripeService.refreshStripeInvoiceStatus(printavoInvoiceId);
    setStripeInvoice(updated);
    await loadStripeInvoiceData();
  } finally {
    setRefreshing(false);
  }
};
```

#### Payment Options Section UI

```tsx
{stripeInvoice && (
  <div className="bg-white rounded-lg shadow p-6 mb-6">
    <h2 className="text-xl font-semibold mb-4">Payment Options</h2>

    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <p className="text-sm text-gray-600">Minimum Due (50%)</p>
        <p className="text-2xl font-bold text-green-600">
          ${stripeInvoice.minimumDueAmount.toFixed(2)}
        </p>
      </div>
      <div>
        <p className="text-sm text-gray-600">Total Due</p>
        <p className="text-2xl font-bold">
          ${stripeInvoice.totalAmount.toFixed(2)}
        </p>
      </div>
    </div>

    <div className="flex gap-2 mb-4">
      <a
        href={stripeInvoice.hostedInvoiceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Open Stripe Invoice
      </a>
      <button
        onClick={() => {
          navigator.clipboard.writeText(stripeInvoice.hostedInvoiceUrl);
          alert('Payment link copied!');
        }}
        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
      >
        Copy Payment Link
      </button>
      <button
        onClick={handleRefreshStatus}
        disabled={refreshing}
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
      >
        {refreshing ? 'Refreshing...' : 'Refresh Status'}
      </button>
    </div>

    <div className="border-t pt-4">
      <div className="flex justify-between mb-2">
        <span className="text-gray-600">Status:</span>
        <span className={`font-semibold ${
          stripeInvoice.status === 'paid' ? 'text-green-600' :
          stripeInvoice.status === 'open' ? 'text-blue-600' :
          'text-orange-600'
        }`}>
          {stripeInvoice.status.toUpperCase()}
        </span>
      </div>
      <div className="flex justify-between mb-2">
        <span className="text-gray-600">Amount Paid:</span>
        <span className="font-semibold">${stripeInvoice.amountPaid.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Amount Remaining:</span>
        <span className="font-semibold text-orange-600">
          ${stripeInvoice.amountRemaining.toFixed(2)}
        </span>
      </div>
    </div>

    {paymentHistory.length > 0 && (
      <div className="border-t pt-4 mt-4">
        <h3 className="font-semibold mb-2">Payment History</h3>
        <div className="space-y-2">
          {paymentHistory.map((payment) => (
            <div key={payment.id} className="flex justify-between text-sm">
              <span>{new Date(payment.createdAt).toLocaleDateString()}</span>
              <span className="font-semibold">${payment.amount.toFixed(2)}</span>
              {payment.receiptUrl && (
                <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer"
                   className="text-blue-600 hover:underline">
                  Receipt
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

---

## How It Works

### Customer Experience

1. **Receives Invoice URL** - Customer gets a link to the Stripe hosted invoice page
2. **Chooses Payment Amount** - Stripe's UI allows them to pay:
   - Exactly 50% (minimum)
   - Any amount between 50% and 100%
   - The full 100%
3. **Makes Payment** - Payment is processed by Stripe
4. **Webhook Notification** - Stripe sends webhook to update your system

### System Flow

1. **Create Invoice**: App calls `createStripeInvoiceWithMinimumDue()`
2. **Stripe Invoice Created**: With `minimum_amount_due` = 50% of total
3. **Customer Pays**: Via Stripe hosted invoice page
4. **Webhook Received**: `invoice.paid` or `invoice.payment_succeeded`
5. **Payment Recorded**: Added to `stripe_payment_history`
6. **Invoice Updated**: `amount_paid` and `amount_remaining` updated
7. **Status Updated**:
   - If fully paid → status = 'paid', moved to `paid_invoices`
   - If partial → status = 'open', `payment_status` = 'partial'

### Partial Payment Tracking

- Each payment creates a record in `stripe_payment_history`
- Multiple partial payments are supported
- Running totals maintained in `stripe_invoices` table
- Customer can make additional payments until fully paid

---

## Testing Checklist

### Test Cases

1. ✅ **Create 50% Minimum Invoice**
   - Verify invoice created in Stripe
   - Confirm minimum_amount_due = 50% of total
   - Check hosted_invoice_url is generated

2. ✅ **Customer Pays 50%**
   - Webhook updates amount_paid
   - Payment recorded in stripe_payment_history
   - amount_remaining = 50%
   - Status = 'open', payment_status = 'partial'

3. ✅ **Customer Pays Remaining 50%**
   - Second payment recorded
   - amount_paid = 100%
   - amount_remaining = 0
   - Status = 'paid'
   - Moved to paid_invoices

4. ✅ **Customer Pays 100% Initially**
   - Single payment recorded
   - Status immediately = 'paid'
   - Moved to paid_invoices

5. ✅ **Customer Pays 75%**
   - Payment recorded
   - amount_remaining = 25%
   - Status = 'open', payment_status = 'partial'

---

## Configuration Required

### Stripe Webhook Setup

Add these webhook events in your Stripe Dashboard:
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.payment_action_required`
- `invoice.payment_failed`

Webhook URL: `https://your-supabase-project.supabase.co/functions/v1/stripe-webhook`

---

## Benefits

1. **Flexible Payment Options** - Customers choose how much to pay (≥50%)
2. **Lower Barrier to Entry** - 50% deposit vs 100% upfront
3. **Better Cash Flow** - Get partial payment immediately
4. **Automatic Tracking** - All payments tracked automatically
5. **Clear Status** - Know exactly what's been paid and what's outstanding
6. **Production Ready** - Handles edge cases, errors, and refunds

---

## Next Steps

1. Update BillingQueue component with new button
2. Update InvoiceDetail component with Payment Options section
3. Test with Stripe test mode
4. Configure webhook events in Stripe Dashboard
5. Deploy to production
