# Financial Lock Protection Implementation

## Overview
This implementation protects invoice financial data from being overwritten by Printavo sync after payments have been recorded in our system. When an invoice is paid in full through Stripe, it becomes "financially locked" and sync will only update safe fields.

## What Was Implemented

### 1. Database Changes (Migration)
**File:** `supabase/migrations/add_financial_lock_to_invoices.sql`

Added new fields to `printavo_invoices` table:
- `is_financially_locked` (boolean) - Lock flag
- `locked_at` (timestamptz) - When it was locked
- `locked_by` (text) - What locked it ('stripe', 'manual', 'system')
- `balance_remaining` (numeric) - Our calculated balance

**Auto-locked existing paid invoices** during migration for data safety.

### 2. Sync Protection Logic
**File:** `supabase/functions/printavo-sync/index.ts`

The sync function now:
- Checks if invoice exists and is locked before updating
- For **locked invoices**, only updates safe fields:
  - Customer info (name, email, phone, company)
  - Addresses (billing/shipping)
  - Invoice amounts (subtotal, tax, total) - allows quantity changes
  - Dates (invoice_date, due_date)
  - Metadata (raw_data)

- For **locked invoices**, NEVER overwrites:
  - `amount_paid`
  - `amount_outstanding`
  - `balance_remaining`
  - `status`
  - `status_stage`
  - Lock fields

- For **unlocked or new invoices**, updates everything normally

### 3. Automatic Locking on Payment
**File:** `supabase/functions/stripe-webhook/index.ts`

The Stripe webhook now locks invoices when:
- Invoice is paid in FULL (balance = 0)
- Sets `is_financially_locked = true`
- Sets `locked_by = 'stripe'`
- Sets `locked_at = current timestamp`

**Important:** Partial payments do NOT lock the invoice (per your requirements).

### 4. Admin Unlock Function
**File:** `supabase/functions/unlock-invoice/index.ts`

New edge function that allows admins to unlock invoices:
- Requires admin role authentication
- Accepts `invoiceId` and `reason`
- Logs unlock action with admin email and reason
- Returns success/error status

**Usage:**
```javascript
POST /functions/v1/unlock-invoice
Headers: Authorization: Bearer {token}
Body: { invoiceId: "...", reason: "..." }
```

### 5. UI Changes
**File:** `src/components/billing/InvoiceDetail.tsx`
**File:** `src/services/invoice-detail-service.ts`

Added to Invoice Detail page:
- **Lock Status Badge** - Yellow badge showing "Financially Locked" when applicable
- **Unlock Button** - Visible only to admins when invoice is locked
- Prompts admin for reason before unlocking
- Shows loading state during unlock
- Refreshes invoice data after successful unlock

## Protected vs Safe Fields

### Protected Fields (Never Overwritten When Locked)
- `amount_paid` - Our payment tracking
- `amount_outstanding` - Our balance calculation
- `balance_remaining` - Our balance tracking
- `status` - Our status based on payments
- `status_stage` - Our workflow stage
- `is_financially_locked` - Lock flag
- `locked_at` - Lock timestamp
- `locked_by` - Lock source

### Safe Fields (Always Updated)
- Customer info: `customer_name`, `customer_email`, `customer_phone`, `customer_company`
- Addresses: All billing and shipping address fields
- Amounts: `subtotal`, `tax`, `total` (allows for quantity adjustments)
- Dates: `invoice_date`, `due_date`
- Metadata: `raw_data` (for audit trail)

## How It Works

### New Invoice Flow
1. Printavo sync fetches invoice
2. Invoice doesn't exist locally
3. Creates invoice with all Printavo data
4. Sets `is_financially_locked = false`

### Unlocked Invoice Update Flow
1. Printavo sync fetches invoice
2. Invoice exists but is NOT locked
3. Updates ALL fields from Printavo (safe)

### Locked Invoice Update Flow
1. Printavo sync fetches invoice
2. Invoice exists and IS locked
3. Updates ONLY safe fields (customer, addresses, amounts, dates)
4. SKIPS financial fields (amount_paid, status, etc.)

### Payment Flow (Locking)
1. Customer pays invoice via Stripe
2. Stripe webhook receives payment event
3. Calculates if invoice is paid in FULL
4. If fully paid: Sets lock and updates financial fields
5. If partially paid: Updates financial fields but does NOT lock

### Unlock Flow
1. Admin views locked invoice in UI
2. Clicks "Unlock" button
3. Enters reason for unlocking
4. System verifies admin role
5. Removes lock (sets all lock fields to null)
6. Invoice can now be updated by sync again

## Testing Checklist

- [ ] New invoices sync correctly
- [ ] Unlocked invoices update fully
- [ ] Locked invoices only update safe fields
- [ ] Stripe payment locks invoice when paid in full
- [ ] Partial payments don't lock invoice
- [ ] Admin can unlock invoice
- [ ] Non-admins cannot see unlock button
- [ ] Lock badge displays correctly
- [ ] Sync respects lock protection

## Security Notes

- Only admins can unlock invoices
- Unlock action requires authentication
- Unlock reason is logged for audit trail
- Lock is set automatically by system (Stripe webhook)
- RLS policies protect invoice data

## Future Enhancements

Consider adding:
- Unlock audit log table (who unlocked what and when)
- Email notification when invoice is unlocked
- Lock history tracking
- Manual lock feature for admins
- Bulk unlock capability
