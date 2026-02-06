# Invoice Creation Automation

## Overview

Comprehensive invoice automation system that automatically generates professional invoices with line-item detail when quotes are approved. Includes PDF generation, email dispatch, and complete customer billing management.

---

## Architecture

### Database Tables

#### 1. Invoices Table (printavo_invoices)
Master invoice records:
- `id` - Invoice ID (INV-YYYYMMDD-XXXXX)
- `invoice_number` - Display number (same as ID)
- `customer_id` - Reference to customer
- `customer_email` - Billing email
- `customer_name` - Customer name
- `customer_company` - Company name
- `customer_phone` - Contact phone
- `customer_address` - Billing address
- `customer_city` - City
- `customer_state` - State
- `customer_zip` - ZIP code
- `subtotal` - Pre-tax total
- `tax` - Total tax amount
- `total` - Grand total
- `amount_paid` - Total payments received
- `amount_outstanding` - Balance due
- `status` - Invoice status (Open, Paid, Void, etc.)
- `status_stage` - Payment stage (unpaid, partial, paid, overdue)
- `invoice_date` - Invoice creation date
- `due_date` - Payment due date
- `raw_data` (jsonb) - Metadata including quote_id, work_order_id

#### 2. Invoice Line Items Table
Detailed line-item pricing:
- `invoice_id` - Parent invoice
- `quote_line_item_id` - Links to original quote line item
- `line_number` - Display order
- `item_type` - Type: garment, decoration, custom, fee, discount
- `description` - Item description
- `style_number` - Product SKU
- `style_name` - Product name
- `color` - Garment color
- `sizes` (jsonb) - Size breakdown
- `quantity` - Total quantity
- `unit_price` - Price per unit
- `subtotal` - Line subtotal before tax
- `tax_rate` - Tax percentage
- `tax_amount` - Tax amount for line
- `total` - Line total with tax
- `discount_percentage` - Discount percent
- `discount_amount` - Discount amount
- `notes` - Line item notes

---

## Automation Workflow

### Trigger
**When:** Quote status changes to 'approved'

### Automatic Invoice Creation

The `process_quote_approval()` function executes:

#### 1. Generate Invoice Number
```sql
Format: INV-YYYYMMDD-XXXXX
Example: INV-20250206-00001
```
- Date-based prefix
- Sequential 5-digit counter per day
- Unique per company

#### 2. Create Invoice Record
```sql
INSERT INTO printavo_invoices (
  id,
  invoice_number,
  customer_email,
  customer_name,
  customer_company,
  customer_phone,
  customer_address,
  customer_city,
  customer_state,
  customer_zip,
  subtotal,
  tax,
  total,
  amount_paid,
  amount_outstanding,
  status,
  status_stage,
  invoice_date,
  due_date,
  customer_id,
  raw_data
)
```
- Copies all customer billing info from quote
- Includes all pricing totals
- Links to work order and quote
- Sets status to 'Open' / 'unpaid'
- Calculates due date (default: 30 days)

#### 3. Populate Line Items with Pricing
```sql
FOR EACH quote_line_item:
  INSERT INTO invoice_line_items (
    invoice_id,
    company_id,
    quote_line_item_id,
    line_number,
    item_type,
    description,
    style_number,
    style_name,
    color,
    sizes,
    quantity,
    unit_price,
    subtotal,
    tax_rate,
    tax_amount,
    total,
    discount_percentage,
    discount_amount,
    notes
  )
```
**Key Points:**
- ALL pricing information included
- Tax calculations per line
- Discount tracking
- Complete audit trail
- Size breakdowns preserved

#### 4. Add Invoice-Level Fees
```sql
IF quote has fees:
  INSERT INTO invoice_line_items (
    item_type = 'fee',
    description = fee_name,
    amount = fee_amount,
    tax calculations...
  )
```
- Rush fees
- Setup charges
- Shipping fees
- Any custom fees

#### 5. Automatic Total Recalculation
**Trigger:** On line item changes
```sql
UPDATE printavo_invoices SET
  subtotal = SUM(line_items.subtotal),
  tax = SUM(line_items.tax_amount),
  total = SUM(line_items.total),
  amount_outstanding = total - amount_paid
```
- Always accurate totals
- Automatically recalculates
- Maintains balance due

---

## Invoice Number Generation

### Format
```
INV-YYYYMMDD-XXXXX
```

### Components
- `INV` - Prefix
- `YYYYMMDD` - Current date (e.g., 20250206)
- `XXXXX` - Sequential number (padded to 5 digits)

### Examples
- `INV-20250206-00001` - First invoice on Feb 6, 2025
- `INV-20250206-00002` - Second invoice on Feb 6, 2025
- `INV-20250207-00001` - First invoice on Feb 7, 2025 (counter resets)

### Generation Logic
```sql
v_invoice_id := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' ||
                LPAD(COALESCE((
                  SELECT COUNT(*) + 1
                  FROM printavo_invoices
                  WHERE invoice_date::date = CURRENT_DATE
                ), 1)::text, 5, '0');
```

---

## PDF Generation

### Features

**Professional Layout:**
- Company logo and contact info
- Invoice number and dates prominently displayed
- Status badge (PAID, UNPAID, OVERDUE)
- Complete customer billing address
- Itemized line items table
- Size breakdowns for garments
- Tax calculations per line
- Subtotal, tax, and total summary
- Payment tracking (amount paid, balance due)
- Footer with thank you message

**Table Structure:**
```
| Description              | Qty | Unit Price | Tax    | Total    |
|-------------------------|-----|------------|--------|----------|
| Port & Company PC54     | 100 | $5.00      | $0.00  | $500.00  |
| Sizes: S:10, M:30, L:40, XL:20                                  |
| Screen Printing - Front | 100 | $2.50      | $0.00  | $250.00  |
```

**Color Coding:**
- Status badges: Green (paid), Red (overdue), Yellow (unpaid), Blue (partial)
- Balance due highlighted in red when unpaid
- Company branding colors

### Implementation
```typescript
const pdfBlob = await InvoiceService.generateInvoicePDF(invoiceId);
```

Uses jsPDF with autoTable plugin for professional table formatting.

---

## Email Dispatch

### Features

**Email Content:**
- Professional HTML template
- Invoice details summary
- Itemized breakdown table
- Total and balance due highlighted
- Company branding
- Direct payment information
- Contact details

**Customization:**
- Custom subject line
- Custom message body
- Default template provided
- Personalized greeting using customer name

### Implementation

#### Frontend
```typescript
const result = await InvoiceService.emailInvoice(
  invoiceId,
  recipientEmail,
  subject,     // optional
  message      // optional
);
```

#### Backend (Edge Function)
**Location:** `supabase/functions/send-invoice/index.ts`

**Features:**
- Sends via Resend API
- Inline invoice details
- Professional HTML formatting
- Company branding
- Activity logging
- Error handling

**Email Template Includes:**
- Invoice number and dates
- Status badge
- Line items table with pricing
- Totals summary
- Payment status
- Company contact information

### Configuration

**Required Settings:**
- Resend API Key (configured in company settings)
- Email From Address
- Company information

---

## Frontend Components

### InvoiceService
**Location:** `src/services/invoice-service.ts`

**Key Methods:**
```typescript
// Get all invoices with filtering
getInvoices(filters?: {
  status?: string;
  status_stage?: string;
  customer_id?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
})

// Get single invoice with details
getInvoiceById(invoiceId: string)

// Update invoice
updateInvoice(invoiceId: string, updates: Partial<Invoice>)

// Generate and download PDF
generateInvoicePDF(invoiceId: string): Promise<Blob>
downloadInvoicePDF(invoiceId: string, filename?: string)

// Email invoice
emailInvoice(
  invoiceId: string,
  recipientEmail: string,
  subject?: string,
  message?: string
)

// Get by customer
getInvoicesByCustomerId(customerId: string)

// Get open/overdue
getOpenInvoices()
getOverdueInvoices()
```

### InvoicesList Component
**Location:** `src/components/billing/InvoicesList.tsx`

**Features:**
- Complete invoice listing
- Search and filtering
- Status-based filtering
- Summary cards (total, outstanding, paid, overdue)
- Quick download PDF
- Click to view details
- Overdue indicators
- Responsive design

**Summary Cards:**
1. Total Invoices - Count of all invoices
2. Total Outstanding - Sum of all balances due
3. Paid Invoices - Count of fully paid invoices
4. Overdue - Count of past-due invoices

### InvoiceDetailModal Component
**Location:** `src/components/billing/InvoiceDetailModal.tsx`

**Features:**
- Full invoice details
- Customer billing information
- Complete line items table
- Size breakdowns
- Tax calculations
- Payment tracking
- Status badges
- Quick actions (Download PDF, Send Email, Print)
- Link to work order
- Email modal integration

**Actions:**
- Download PDF
- Email invoice
- Print invoice
- View linked work order

---

## Data Flow

```
Quote Approved
      ↓
[process_quote_approval() trigger]
      ↓
  Generate Invoice Number
  (INV-20250206-00001)
      ↓
  Create Invoice Record
  • Customer info
  • Billing address
  • Totals
  • Dates
      ↓
  Copy Line Items with Pricing
  • All quote line items
  • Unit prices
  • Tax calculations
  • Discounts
  • Fees
      ↓
  Add Invoice-Level Fees
  • Rush fees
  • Setup charges
  • Shipping
      ↓
[Invoice Created]
      ↓
  Available in Billing Dashboard
      ↓
[User Actions]
      ↓
  • View Details
  • Generate PDF
  • Email to Customer
  • Track Payments
      ↓
[Payment Processing]
      ↓
  • Manual payments recorded
  • Stripe payments linked
  • Balance auto-updates
  • Status changes (unpaid → partial → paid)
      ↓
[Invoice Paid]
      ↓
  • Status: Paid
  • amount_outstanding: $0.00
  • Payment history tracked
```

---

## Auto-Email on Creation (Optional)

### Configuration
Can be enabled in company settings to automatically email invoices when created.

### Implementation
```sql
-- Add to process_quote_approval() function:
IF company_settings.auto_email_invoices = true THEN
  -- Call send-invoice edge function
  -- Log activity
END IF;
```

**Benefits:**
- Instant invoice delivery
- Reduces manual steps
- Improves cash flow
- Professional impression

---

## Payment Integration

### Manual Payments
Users can record payments manually:
```typescript
// Record payment
await recordManualPayment({
  invoice_id: invoiceId,
  amount: paymentAmount,
  payment_method: 'check',
  payment_date: new Date(),
  reference_number: 'CHK-12345'
});

// Automatically:
// - Updates amount_paid
// - Recalculates amount_outstanding
// - Updates status_stage
```

### Stripe Integration
Integrated with Stripe for online payments:
- Payment links in emails
- Automatic payment recording
- Webhook synchronization
- Instant balance updates

### Status Transitions
```
unpaid → partial → paid
   ↓
overdue (if past due date)
```

**Status Logic:**
- `unpaid`: amount_paid = 0
- `partial`: 0 < amount_paid < total
- `paid`: amount_paid >= total
- `overdue`: past due_date AND not paid

---

## Security & Permissions

### Row Level Security
All tables have company-based isolation:

**Invoices:**
```sql
USING (company_id = get_user_company_id())
```

**Invoice Line Items:**
```sql
USING (company_id = get_user_company_id())
```

### Permissions
- View: All authenticated users in company
- Create: Automatically via quote approval
- Update: Accounting staff, admins
- Delete: Super admins only
- Email: Users with email permissions

---

## Testing

### Test Scenario 1: Basic Invoice Creation
1. Create a quote with line items
2. Add discounts and fees
3. Approve the quote
4. Verify:
   - Invoice created with correct number
   - All line items copied with pricing
   - Fees included
   - Totals accurate
   - Status set to 'Open'/'unpaid'

### Test Scenario 2: PDF Generation
1. Open invoice details
2. Click Download PDF
3. Verify:
   - Professional layout
   - Company logo and info
   - Customer billing address
   - Line items table formatted correctly
   - Size breakdowns displayed
   - Totals calculated correctly
   - Status badge shows correct color

### Test Scenario 3: Email Dispatch
1. Open invoice details
2. Click Send Email
3. Enter recipient email
4. Customize subject/message (optional)
5. Send
6. Verify:
   - Email received
   - Professional formatting
   - Line items table displays correctly
   - Totals accurate
   - Links functional
   - Activity logged

### Test Scenario 4: Payment Recording
1. Record a partial payment
2. Verify:
   - amount_paid updates
   - amount_outstanding recalculates
   - status_stage changes to 'partial'
3. Record remaining balance
4. Verify:
   - status_stage changes to 'paid'
   - amount_outstanding = $0.00

### Verification Queries

```sql
-- Check invoice created
SELECT
  inv.*,
  (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = inv.id) as line_item_count
FROM printavo_invoices inv
WHERE raw_data->>'quote_id' = ?;

-- Check line items with pricing
SELECT
  ili.*
FROM invoice_line_items ili
WHERE invoice_id = ?
ORDER BY line_number;

-- Verify totals match
SELECT
  id,
  subtotal as invoice_subtotal,
  (SELECT SUM(subtotal) FROM invoice_line_items WHERE invoice_id = printavo_invoices.id) as calculated_subtotal,
  tax as invoice_tax,
  (SELECT SUM(tax_amount) FROM invoice_line_items WHERE invoice_id = printavo_invoices.id) as calculated_tax,
  total as invoice_total,
  (SELECT SUM(total) FROM invoice_line_items WHERE invoice_id = printavo_invoices.id) as calculated_total
FROM printavo_invoices
WHERE id = ?;

-- Check email activity logs
SELECT *
FROM quote_activity_log
WHERE action = 'invoice_emailed'
  AND meta->>'invoice_id' = ?
ORDER BY created_at DESC;
```

---

## Common Issues & Solutions

### Issue: Invoice totals don't match line items
**Solution:**
```sql
-- Manually recalculate
UPDATE printavo_invoices
SET
  subtotal = (SELECT SUM(subtotal) FROM invoice_line_items WHERE invoice_id = ?),
  tax = (SELECT SUM(tax_amount) FROM invoice_line_items WHERE invoice_id = ?),
  total = (SELECT SUM(total) FROM invoice_line_items WHERE invoice_id = ?)
WHERE id = ?;
```

### Issue: PDF won't generate
**Checks:**
1. Verify invoice exists
2. Check line items present
3. Verify company settings loaded
4. Check browser console for errors
5. Ensure jsPDF library loaded

### Issue: Email not sending
**Checks:**
1. Verify Resend API key configured
2. Check email from address set
3. Verify recipient email valid
4. Check edge function logs
5. Ensure network connection

### Issue: Missing line items
**Check:**
1. Quote had line items before approval
2. Line items had pricing set
3. Check trigger executed successfully
4. Review activity logs

---

## Best Practices

### Invoice Management
1. **Review Before Sending:** Always review invoice details before emailing
2. **Clear Descriptions:** Ensure line item descriptions are clear
3. **Accurate Pricing:** Verify pricing before quote approval
4. **Timely Dispatch:** Send invoices promptly after creation
5. **Follow Up:** Monitor overdue invoices

### PDF Customization
1. **Professional Branding:** Upload company logo
2. **Complete Info:** Fill out all company details
3. **Clear Terms:** Include payment terms
4. **Contact Details:** Provide multiple contact methods

### Email Communication
1. **Personalize Messages:** Customize email content
2. **Clear Subject Lines:** Use descriptive subjects
3. **Professional Tone:** Maintain professional language
4. **Include Details:** Provide payment instructions
5. **Prompt Response:** Reply to customer inquiries quickly

---

## Integration Points

### With Quote System
- Triggers on quote approval
- Maintains quote_id link
- Copies all pricing data
- Preserves audit trail
- Links to activity logs

### With Work Order System
- Links to work order via raw_data
- Shared customer information
- Connected production tracking
- Unified order management

### With Payment System
- Manual payment recording
- Stripe payment integration
- Automatic balance updates
- Payment history tracking

### With Customer Management
- Links to customer records
- Billing address management
- Payment method tracking
- Communication history

---

## Reporting

### Available Reports
1. **Outstanding Invoices:** All unpaid/partial invoices
2. **Overdue Report:** Past-due invoices
3. **Revenue Report:** Paid invoices by date range
4. **Customer Statement:** All invoices for a customer
5. **Aging Report:** Invoices by age (0-30, 31-60, 61-90, 90+ days)

### Key Metrics
- Total outstanding balance
- Average invoice value
- Days to payment (DSO)
- Payment success rate
- Overdue percentage

---

## Future Enhancements

Potential additions:
1. Recurring invoices
2. Invoice templates
3. Multi-currency support
4. Payment plans
5. Credit notes/refunds
6. Late payment fees
7. Early payment discounts
8. Invoice approval workflow
9. Batch email sending
10. Custom PDF templates

---

## Summary

The Invoice Creation Automation provides:

**Automatic Creation:**
- Generated on quote approval
- Unique invoice numbers (INV-YYYYMMDD-XXXXX)
- Complete pricing details
- Line-item breakdown
- Tax calculations
- Fees and discounts

**Professional PDFs:**
- Company branding
- Itemized billing
- Size breakdowns
- Tax details
- Payment tracking
- Professional layout

**Email Dispatch:**
- One-click sending
- Professional templates
- Customizable content
- Inline invoice details
- Activity logging

**Complete Management:**
- Invoice listing and search
- Status tracking
- Payment recording
- Balance calculations
- Overdue monitoring

This system eliminates manual invoice creation, provides professional customer communications, maintains complete audit trails, and streamlines the billing process from quote approval to payment collection.
