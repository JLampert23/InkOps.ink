# Quote Approval Automation System

## Overview

A comprehensive automation system that triggers when a quote is approved. The system locks the quote, captures approval metadata, and initiates multiple downstream processes to streamline the quote-to-production workflow.

---

## Architecture

### Database Tables

#### 1. Quotes Table (Enhanced)
New columns added:
- `is_locked` (boolean) - Prevents editing after approval
- `approved_by_name` (text) - Name of approver
- `approved_by_email` (text) - Email of approver
- `approved_ip` (text) - IP address of approval submission

#### 2. Work Orders Table (New)
Created to track production work:
- `work_order_number` - Unique WO number (format: WO-YYYYMMDD-XXXXX)
- `company_id` - Company isolation
- `quote_id` - Links to originating quote
- `customer_id` - Customer reference
- `status` - Current status (draft, in_progress, completed, cancelled, on_hold)
- `priority` - Priority level (low, medium, high, urgent)
- `production_due_date` - Production deadline
- `customer_due_date` - Customer expected delivery
- `assigned_to` - User assigned to work order
- `total_quantity` - Total items
- `notes` - Production notes
- Timestamps: `created_at`, `updated_at`, `started_at`, `completed_at`

#### 3. Garment Requirements Staging Table (New)
Stages garment requirements for PO creation:
- `quote_id` - Source quote
- `work_order_id` - Associated work order
- `supplier_type` - Supplier category (sanmar, ssactivewear, independent, other)
- `supplier_name` - Supplier name
- `style_number` - Product SKU
- `style_name` - Product name
- `color` - Garment color
- `sizes` (jsonb) - Size breakdown (e.g., {"S": 10, "M": 20, "L": 15})
- `total_quantity` - Total needed
- `unit_cost` - Cost per unit
- `total_cost` - Total cost
- `is_po_created` - Whether PO has been created
- `po_id` - Reference to created PO
- `notes` - Special instructions

#### 4. Production Schedule Entries Table (Existing)
Already configured to receive imprint data from approved quotes.

---

## Automation Workflow

### Trigger Event
**When:** `quotes.status` changes to `'approved'`

### Automated Actions

The `process_quote_approval()` database function executes the following steps automatically:

#### 1. Lock Quote
```sql
NEW.is_locked := true;
```
- Prevents further editing
- Ensures data integrity

#### 2. Capture Approval Metadata
```sql
NEW.approved_by_name := [from approval response]
NEW.approved_by_email := [from approval response]
NEW.approved_ip := [from approval response]
NEW.approved_at := now()
```
- Captures who approved
- Records when and where
- Creates audit trail

#### 3. Create Activity Log Entry
```sql
INSERT INTO quote_activity_log (...)
```
- Logs approval action
- Records metadata
- Maintains full audit trail

#### 4. Create Work Order
```sql
INSERT INTO work_orders (...)
```
- Generates unique WO number
- Links to quote
- Sets initial status to 'draft'
- Copies relevant dates and customer info
- Calculates total quantity from line items

#### 5. Create Invoice
```sql
INSERT INTO printavo_invoices (...)
```
- Generates invoice ID (format: INV-YYYYMMDD-XXXXX)
- Copies customer and pricing data
- Sets status to 'Open' with 'unpaid' stage
- Links to quote and work order
- Sets due date (defaults to 30 days)

#### 6. Stage Garment Requirements for POs
```sql
INSERT INTO garment_requirements_staging (...)
```
- Extracts garment data from quote line items
- Groups by supplier, style, color
- Calculates quantities and costs
- Marks as pending PO creation
- Links to work order

#### 7. Push Imprints to Scheduler
```sql
INSERT INTO production_schedule_entries (...)
```
- Creates schedule entry for each imprint
- Sets production due dates
- Links to line items and imprints
- Enables production tracking

#### 8. Log All Actions
```sql
INSERT INTO quote_activity_log (...)
```
- Logs each automated step
- Records system actions
- Maintains complete history

---

## Integration Points

### Public Quote Approval (Edge Function)
**Location:** `supabase/functions/quote-approval/index.ts`

**Endpoints:**
- `GET /quote-approval/:token` - View quote for approval
- `POST /quote-approval/:token/respond` - Submit approval/rejection

**When a customer approves:**
1. Edge function updates quote status to 'approved'
2. Database trigger `process_quote_approval()` fires automatically
3. All downstream processes execute
4. Edge function returns success response

**Metadata Captured:**
- Approver name and email (from form)
- IP address (from request headers)
- User agent (from request headers)
- Approval timestamp
- Notes (optional)

### Manual Approval (Internal)
When staff manually approve a quote in the UI:
1. Update quote status to 'approved'
2. Trigger fires automatically
3. All processes execute
4. Approval metadata populated from most recent approval response

---

## Data Flow Diagram

```
Quote Approved
      ↓
  [TRIGGER: process_quote_approval()]
      ↓
  ┌───────────────────────────────────┐
  │                                   │
  ├─→ Lock Quote                      │
  ├─→ Capture Metadata                │
  ├─→ Log Activity                    │
  │                                   │
  ├─→ Create Work Order               │
  ├─→ Create Invoice                  │
  ├─→ Stage Garment Requirements      │
  ├─→ Push to Scheduler               │
  │                                   │
  └───────────────────────────────────┘
      ↓
  [Downstream Systems Ready]

  • Work Order → Production Tracking
  • Invoice → Billing System
  • Garment Requirements → PO Creation
  • Schedule Entries → Production Scheduler
```

---

## Security & Permissions

### Row Level Security (RLS)
All new tables have RLS enabled with company-based isolation:

**Work Orders:**
- View: Users can view their company's work orders
- Create: Users can create work orders for their company
- Update: Users can update their company's work orders
- Delete: Users can delete their company's work orders

**Garment Requirements Staging:**
- Same company-based isolation as work orders

**Production Schedule Entries:**
- Same company-based isolation (already configured)

### Trigger Execution
- Runs with DEFINER privileges (has necessary permissions)
- Uses security definer functions where needed
- Maintains data integrity across tables

---

## Testing the Automation

### Test Scenario 1: Public Approval Link
1. Create a quote with line items and imprints
2. Generate public approval link
3. Customer clicks link and approves
4. Verify:
   - Quote is locked (`is_locked = true`)
   - Approval metadata populated
   - Work order created
   - Invoice created
   - Garment requirements staged
   - Schedule entries created
   - Activity log has all entries

### Test Scenario 2: Manual Internal Approval
1. Create a quote
2. Change status to 'approved' via UI or API
3. Verify same results as scenario 1

### Verification Queries

```sql
-- Check quote approval metadata
SELECT
  quote_number,
  status,
  is_locked,
  approved_by_name,
  approved_by_email,
  approved_at
FROM quotes
WHERE quote_number = 'Q-20250206-00001';

-- Check work order created
SELECT *
FROM work_orders
WHERE quote_id = (SELECT id FROM quotes WHERE quote_number = 'Q-20250206-00001');

-- Check invoice created
SELECT *
FROM printavo_invoices
WHERE raw_data->>'quote_number' = 'Q-20250206-00001';

-- Check garment requirements staged
SELECT *
FROM garment_requirements_staging
WHERE quote_id = (SELECT id FROM quotes WHERE quote_number = 'Q-20250206-00001');

-- Check schedule entries created
SELECT *
FROM production_schedule_entries
WHERE quote_id = (SELECT id FROM quotes WHERE quote_number = 'Q-20250206-00001');

-- Check activity log
SELECT
  action,
  performed_by_name,
  performed_at,
  meta
FROM quote_activity_log
WHERE quote_id = (SELECT id FROM quotes WHERE quote_number = 'Q-20250206-00001')
ORDER BY performed_at;
```

---

## Error Handling

The automation function includes:
- Transaction-safe operations
- Graceful degradation (logs errors but continues)
- Activity logging for all actions
- NULL handling for optional fields
- Default values for missing data

If any step fails:
- Error is logged to application logs
- Transaction may rollback (depends on severity)
- Activity log captures what succeeded

---

## Monitoring & Maintenance

### Key Metrics to Monitor
1. Approval-to-work-order conversion rate
2. Time from approval to invoice creation
3. Garment requirements staging completion
4. Schedule entry creation success rate

### Activity Log Queries

```sql
-- Get approval automation summary for a date range
SELECT
  action,
  COUNT(*) as count,
  DATE(performed_at) as date
FROM quote_activity_log
WHERE action IN (
  'quote_approved',
  'work_order_created',
  'invoice_created',
  'garment_requirements_staged',
  'scheduler_entries_created'
)
AND performed_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY action, DATE(performed_at)
ORDER BY date DESC, action;
```

---

## Future Enhancements

Potential additions to the automation:
1. Email notifications on approval
2. SMS notifications for urgent orders
3. Automatic PO creation from staged requirements
4. Integration with external production systems
5. Real-time dashboard updates
6. Approval analytics and reporting

---

## Troubleshooting

### Issue: Quote approved but no work order created
**Check:**
1. Verify trigger is enabled: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_comprehensive_quote_approval'`
2. Check for errors in logs
3. Verify quote actually changed to 'approved' status

### Issue: Approval metadata not captured
**Check:**
1. Ensure approval response was created first
2. Verify approval token is valid
3. Check quote_approval_responses table has entry

### Issue: Garment requirements not staged
**Check:**
1. Verify quote line items have supplier metadata populated
2. Check that style_number is not null
3. Look for errors in activity log

---

## API Reference

### Update Quote Status (Triggers Automation)

```typescript
// Approve a quote (triggers automation)
const { data, error } = await supabase
  .from('quotes')
  .update({ status: 'approved' })
  .eq('id', quoteId);

// The trigger will automatically:
// - Lock the quote
// - Create work order
// - Create invoice
// - Stage garment requirements
// - Push to scheduler
```

### Query Work Orders

```typescript
// Get work orders for a quote
const { data: workOrders } = await supabase
  .from('work_orders')
  .select('*')
  .eq('quote_id', quoteId);
```

### Query Garment Requirements

```typescript
// Get staged garment requirements
const { data: requirements } = await supabase
  .from('garment_requirements_staging')
  .select('*')
  .eq('quote_id', quoteId)
  .eq('is_po_created', false);
```

---

## Migration Files

The following migrations were created:

1. `add_quote_approval_metadata_and_locking.sql`
   - Adds approval fields to quotes table

2. `create_work_orders_table.sql`
   - Creates work orders table with RLS

3. `create_garment_requirements_staging.sql`
   - Creates garment staging table with RLS

4. `implement_comprehensive_quote_approval_automation.sql`
   - Implements main automation trigger and function

---

## Summary

The Quote Approval Automation System provides a complete, automated workflow from quote approval through production setup. It ensures data consistency, maintains a full audit trail, and eliminates manual steps in the quote-to-production process.

**Key Benefits:**
- Zero manual intervention required
- Full audit trail maintained
- Data consistency guaranteed
- Reduced errors and omissions
- Faster order processing
- Complete integration with existing systems
