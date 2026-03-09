# Job Completion + Final Invoice Automation - Complete Guide

Comprehensive automation system that finalizes jobs, completes work orders, finalizes invoices, creates delivery tasks, and archives completed jobs with full audit trail.

---

## Overview

The Job Completion Automation system orchestrates the final steps when a work order is completed through the production workflow. It automatically:

1. **Marks Work Order Complete** - Updates status and timestamps
2. **Finalizes Invoice** - Locks totals and marks ready for sending
3. **Creates Delivery Task** - Schedules pickup/delivery with logistics team
4. **Archives Job** - Soft-archives work order, quote, and invoice for clean dashboard views

All steps are logged, configurable per company, and fully auditable.

---

## Automatic Workflow Integration

### Trigger on Completion

When a work order reaches the **"completed"** stage in the production workflow (after QC passes), the job completion automation **automatically triggers**.

**Automatic Flow:**
```
QC Inspector Passes Inspection
  ↓
advance_workflow_stage() called
  ↓
Work Order Status → "completed"
  ↓
Workflow Tracking: current_stage_key = 'completed'
  ↓
✨ Database Trigger Fires ✨
  ↓
complete_job_automation() executes
  ↓
1. Finalize Invoice (if enabled)
2. Create Delivery Task (if enabled)
3. Archive Job (if enabled and after delay)
  ↓
All Steps Logged to job_completion_log
  ↓
Notifications Sent
```

**Database Trigger:**
```sql
CREATE TRIGGER trigger_job_completion_automation
  AFTER UPDATE OF current_stage_key ON work_order_workflow_tracking
  FOR EACH ROW
  WHEN (NEW.current_stage_key = 'completed')
  EXECUTE FUNCTION trigger_job_completion_on_workflow_complete();
```

This means:
- No manual intervention needed
- Completion automation runs **automatically** when QC passes
- All steps execute based on company settings
- Complete audit trail maintained

---

## Company Settings

Configure automation behavior per company in `company_settings`:

```typescript
{
  // Delivery automation
  auto_create_delivery_on_completion: true,        // Create delivery task on completion
  default_delivery_type: 'pickup',                 // 'pickup', 'local_delivery', 'shipping', 'courier'

  // Invoice automation
  auto_finalize_invoice_on_completion: true,       // Finalize invoice on completion
  auto_send_invoice_on_completion: false,          // Send invoice email automatically

  // Archiving automation
  auto_archive_on_completion: false,               // Archive immediately on completion
  days_before_auto_archive: 30                     // Days after completion before auto-archive
}
```

**Default Settings:**
- **Create Delivery Task:** YES (default = pickup)
- **Finalize Invoice:** YES
- **Send Invoice Email:** NO (manual send)
- **Auto Archive:** NO (manual archive)
- **Days Before Auto Archive:** 30 days

**Settings Examples:**

**High-Volume Shop (Auto-Archive Everything):**
```typescript
{
  auto_create_delivery_on_completion: true,
  default_delivery_type: 'pickup',
  auto_finalize_invoice_on_completion: true,
  auto_send_invoice_on_completion: true,      // ← Auto-send emails
  auto_archive_on_completion: false,
  days_before_auto_archive: 7                 // ← Archive after 7 days
}
```

**Custom Shop (Manual Control):**
```typescript
{
  auto_create_delivery_on_completion: true,
  default_delivery_type: 'pickup',
  auto_finalize_invoice_on_completion: false,  // ← Manually finalize invoices
  auto_send_invoice_on_completion: false,
  auto_archive_on_completion: false,           // ← Never auto-archive
  days_before_auto_archive: null
}
```

---

## Database Schema

### delivery_tasks

Track delivery and shipping tasks:

```sql
CREATE TABLE delivery_tasks (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  work_order_id uuid NOT NULL,
  work_order_number text NOT NULL,
  quote_id uuid,
  invoice_id uuid,
  customer_name text NOT NULL,

  -- Delivery type and status
  delivery_type text NOT NULL,                    -- 'pickup', 'local_delivery', 'shipping', 'courier'
  delivery_status text NOT NULL DEFAULT 'pending', -- 'pending', 'scheduled', 'in_transit', 'delivered', 'failed', 'cancelled'

  -- Delivery address
  delivery_address_line1 text,
  delivery_address_line2 text,
  delivery_city text,
  delivery_state text,
  delivery_zip text,
  delivery_country text DEFAULT 'USA',

  -- Contact info
  contact_name text,
  contact_phone text,
  contact_email text,

  -- Scheduling
  scheduled_date date,
  scheduled_time_start time,
  scheduled_time_end time,

  -- Tracking
  tracking_number text,
  carrier text,
  estimated_delivery_date date,
  actual_delivery_date timestamptz,

  -- Assignment
  assigned_to uuid REFERENCES user_profiles(id),
  assigned_to_name text,

  -- Delivery details
  delivery_notes text,
  special_instructions text,
  signature_required boolean DEFAULT false,
  signature_received boolean DEFAULT false,
  signature_name text,
  signature_timestamp timestamptz,

  -- Package details
  num_packages integer DEFAULT 1,
  weight_lbs decimal(10,2),
  dimensions_length_in decimal(10,2),
  dimensions_width_in decimal(10,2),
  dimensions_height_in decimal(10,2),

  -- Status tracking
  created_by uuid,
  created_by_name text,
  completed_by uuid,
  completed_by_name text,
  completed_at timestamptz,

  -- Metadata
  delivery_photos jsonb,
  metadata jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Delivery Types:**
- `pickup` - Customer picks up at shop
- `local_delivery` - Shop delivers locally
- `shipping` - Ship via carrier (UPS, FedEx, USPS)
- `courier` - Third-party courier service

**Delivery Status Flow:**
```
pending → scheduled → in_transit → delivered
                  ↘ failed
                  ↘ cancelled
```

### job_completion_log

Complete audit trail of automation steps:

```sql
CREATE TABLE job_completion_log (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  work_order_id uuid NOT NULL,
  work_order_number text NOT NULL,
  completion_step text NOT NULL,              -- Step being executed
  step_status text NOT NULL,                   -- 'started', 'completed', 'failed', 'skipped'
  step_message text,                          -- Success/error message
  error_details text,                         -- Error stack trace if failed
  performed_by uuid,                          -- User who triggered (if manual)
  performed_by_name text,
  metadata jsonb,                             -- Additional context
  created_at timestamptz DEFAULT now()
);
```

**Completion Steps Logged:**
- `job_completion_started` - Automation begins
- `invoice_finalized` - Invoice locked and ready
- `delivery_task_created` - Delivery task created
- `job_archived` - Work order/quote/invoice archived
- `job_completion_finished` - Automation complete
- `job_completion_error` - Fatal error occurred

**Step Statuses:**
- `started` - Step execution began
- `completed` - Step executed successfully
- `failed` - Step failed with error
- `skipped` - Step skipped (not enabled or not applicable)

### Archived Flags

Soft-delete approach using flags (preserves all data and relationships):

**work_orders table:**
```sql
ALTER TABLE work_orders ADD COLUMN archived boolean DEFAULT false;
ALTER TABLE work_orders ADD COLUMN archived_at timestamptz;
ALTER TABLE work_orders ADD COLUMN archived_by uuid REFERENCES user_profiles(id);
```

**quotes table:**
```sql
ALTER TABLE quotes ADD COLUMN archived boolean DEFAULT false;
ALTER TABLE quotes ADD COLUMN archived_at timestamptz;
ALTER TABLE quotes ADD COLUMN archived_by uuid REFERENCES user_profiles(id);
```

**printavo_invoices table:**
```sql
ALTER TABLE printavo_invoices ADD COLUMN archived boolean DEFAULT false;
ALTER TABLE printavo_invoices ADD COLUMN archived_at timestamptz;
ALTER TABLE printavo_invoices ADD COLUMN archived_by text;
```

**Why Soft Delete?**
- Preserves complete audit trail
- Maintains all relationships
- Can unarchive if needed
- No data loss
- Filter archived items from normal views

---

## Core Functions

### complete_job_automation()

Orchestrates complete job completion automation:

```typescript
const { data: result } = await JobCompletionService.completeJobAutomation({
  workOrderId: 'wo-uuid',
  userId: 'user-uuid',
  finalizeInvoice: true,
  sendInvoiceEmail: false,
  createDelivery: true,
  deliveryType: 'pickup',
  deliveryAddress: {
    address_line1: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701'
  },
  archiveJob: false
});

// Returns:
{
  success: true,
  work_order_number: 'WO-2026-001',
  has_errors: false,
  steps: [
    {
      step: 'invoice_finalized',
      success: true,
      result: { message: 'Invoice ready for finalization' }
    },
    {
      step: 'delivery_task_created',
      success: true,
      result: { delivery_task_id: 'uuid', message: 'Delivery task created' }
    }
  ],
  message: 'Job completion automation completed successfully'
}
```

**Parameters:**
- `workOrderId` - Work order to complete
- `userId` - User performing completion
- `finalizeInvoice` - Finalize invoice? (default: true)
- `sendInvoiceEmail` - Send invoice email? (default: false)
- `createDelivery` - Create delivery task? (default: true)
- `deliveryType` - Type of delivery (default: 'pickup')
- `deliveryAddress` - Delivery address details
- `archiveJob` - Archive immediately? (default: false)

**What It Does:**

**Step 1: Finalize Invoice**
- Gets invoice for work order
- Checks if already finalized
- Marks as ready for finalization
- Returns invoice details

**Step 2: Create Delivery Task**
- Creates delivery task record
- Links to work order, quote, invoice
- Sets delivery type and address
- Marks as 'pending' status
- Assigns to logistics queue

**Step 3: Archive Job (if requested)**
- Archives work order
- Archives quote (if exists)
- Archives invoice (if exists)
- Records who archived and when
- Preserves all relationships

**Step 4: Log Everything**
- Logs each step start/complete/fail
- Records all errors with stack traces
- Captures metadata for debugging
- Provides complete audit trail

**Returns:**
- Success status
- List of steps executed
- Any errors encountered
- Has_errors flag if any step failed

### create_delivery_task()

Create delivery task for completed work order:

```typescript
const { data: result } = await JobCompletionService.createDeliveryTask({
  workOrderId: 'wo-uuid',
  deliveryType: 'local_delivery',
  createdBy: 'user-uuid',
  deliveryAddress: {
    address_line1: '456 Oak Ave',
    address_line2: 'Suite 200',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    special_instructions: 'Ring doorbell, building has freight elevator'
  },
  contactInfo: {
    name: 'Jane Smith',
    phone: '555-0123',
    email: 'jane@customer.com'
  },
  deliveryNotes: '150 shirts in 15 boxes, handle with care',
  metadata: {
    priority: 'high',
    requires_liftgate: true
  }
});

// Returns:
{
  success: true,
  delivery_task_id: 'uuid',
  message: 'Delivery task created'
}
```

**Automatically Populates:**
- Company ID
- Work order number
- Customer name
- Quote ID (if exists)
- Invoice ID (if exists)
- Created by user name

### finalize_invoice_for_work_order()

Finalize invoice for work order:

```typescript
const { data: result } = await JobCompletionService.finalizeInvoice(
  'wo-uuid',
  'user-uuid',
  true  // send email
);

// Returns:
{
  success: true,
  invoice_number: 'INV-2026-0123',
  total_amount: 1250.00,
  send_email: true,
  message: 'Invoice ready for finalization',
  note: 'Invoice updates sync through Printavo API'
}
```

**What It Does:**
- Finds invoice for work order
- Checks if already finalized
- Marks as ready for finalization
- Triggers email sending if requested
- Returns invoice details

**Note:** Actual invoice status updates sync through Printavo API. This function marks the invoice as ready and can trigger email sending.

### archive_job()

Archive work order, quote, and invoice:

```typescript
const { data: result } = await JobCompletionService.archiveJob(
  'wo-uuid',
  'user-uuid',
  true,  // archive quote
  true   // archive invoice
);

// Returns:
{
  success: true,
  work_order_number: 'WO-2026-001',
  archived_count: 3,
  archived_by: 'John Smith',
  message: 'Job WO-2026-001 archived successfully'
}
```

**What It Does:**
1. Archives work order (sets archived=true, archived_at=now(), archived_by=user)
2. Archives quote if exists and requested
3. Archives invoice if exists and requested
4. Preserves all relationships
5. Returns count of archived records

**After Archiving:**
- Work order hidden from active dashboards
- Quote hidden from active quotes list
- Invoice hidden from active invoices list
- All data preserved and accessible via archive view
- Can be unarchived if needed

### unarchive_job()

Unarchive work order and related records:

```typescript
const { data: result } = await JobCompletionService.unarchiveJob(
  'wo-uuid',
  'user-uuid'
);

// Returns:
{
  success: true,
  work_order_number: 'WO-2026-001',
  message: 'Job WO-2026-001 unarchived successfully'
}
```

**What It Does:**
- Sets archived=false on work order
- Sets archived=false on quote (if exists)
- Sets archived=false on invoice (if exists)
- Clears archived_at and archived_by
- Makes records visible in active views again

**Use Cases:**
- Accidentally archived
- Need to make changes to completed job
- Customer requests modifications
- Billing adjustments needed

---

## Delivery Management

### Delivery Workflow

**Complete Delivery Flow:**
```
1. Work Order Completes
   ↓
2. Delivery Task Created (status='pending')
   ↓
3. Logistics Team Views Pending Deliveries
   ↓
4. Schedule Delivery (status='scheduled')
   - Set scheduled_date
   - Set scheduled_time_start/end
   - Assign to delivery driver
   ↓
5. Driver Picks Up Order (status='in_transit')
   - Add tracking_number (if shipping)
   - Add carrier (if shipping)
   ↓
6. Deliver to Customer (status='delivered')
   - Record actual_delivery_date
   - Capture signature (if required)
   - Upload delivery photos
   ↓
7. Delivery Complete
   - completed_at = now()
   - completed_by = driver
   - Customer notified
```

### Update Delivery Task

```typescript
// Schedule delivery
await JobCompletionService.updateDeliveryTask(deliveryTaskId, {
  delivery_status: 'scheduled',
  scheduled_date: '2026-02-10',
  scheduled_time_start: '14:00:00',
  scheduled_time_end: '16:00:00',
  assigned_to: 'driver-user-uuid',
  assigned_to_name: 'Mike Wilson'
});

// Mark in transit
await JobCompletionService.updateDeliveryTask(deliveryTaskId, {
  delivery_status: 'in_transit',
  tracking_number: 'UPS123456789',
  carrier: 'UPS'
});

// Complete delivery
await JobCompletionService.completeDelivery(
  deliveryTaskId,
  'driver-user-uuid',
  {
    signatureName: 'Jane Smith',
    signatureReceived: true
  }
);
```

### Get Delivery Tasks

**Get All Pending Deliveries:**
```typescript
const { data: deliveries } = await JobCompletionService.getAllDeliveryTasks({
  status: 'pending'
});
```

**Get Scheduled Deliveries for Date:**
```typescript
const { data: scheduled } = await JobCompletionService.getScheduledDeliveries('2026-02-10');
```

**Get My Assigned Deliveries:**
```typescript
const { data: myDeliveries } = await JobCompletionService.getMyDeliveries('user-uuid');
```

**Get Delivery Dashboard Stats:**
```typescript
const { data: stats } = await JobCompletionService.getDeliveryDashboardStats();

// Returns:
{
  pending: 12,
  scheduled: 8,
  in_transit: 3,
  delivered_today: 15,
  failed: 1
}
```

### Assign Delivery

```typescript
await JobCompletionService.assignDelivery(
  deliveryTaskId,
  'driver-user-uuid'
);
```

---

## Job Archiving

### Why Archive?

**Benefits:**
- Clean dashboard views (only active jobs)
- Improved performance (fewer records to query)
- Organized job history
- Easy to find completed work
- Preserved audit trail

**When to Archive:**
- Job completed and delivered
- Invoice paid in full
- No pending issues or rework
- Customer satisfied
- All files/photos stored

### Archive Strategies

**Manual Archiving:**
```typescript
// After job completion, invoice payment, and delivery
const { data } = await JobCompletionService.archiveJob(
  'wo-uuid',
  'user-uuid',
  true,  // archive quote
  true   // archive invoice
);
```

**Automatic Archiving (Scheduled):**

Set company settings:
```typescript
{
  auto_archive_on_completion: false,
  days_before_auto_archive: 30
}
```

Then run scheduled job (cron):
```sql
-- Run daily at 2 AM
SELECT cron.schedule(
  'auto-archive-completed-jobs',
  '0 2 * * *',
  $$ SELECT schedule_auto_archive_for_completed_jobs(); $$
);
```

This automatically archives jobs that:
1. Are completed
2. Have been completed for X days (per company settings)
3. Are not already archived

**Immediate Auto-Archiving:**
```typescript
{
  auto_archive_on_completion: true,  // ← Archive immediately when completed
  days_before_auto_archive: null
}
```

Archives job as soon as work order reaches completed status.

### View Archived Jobs

```typescript
const { data: archivedJobs } = await JobCompletionService.getArchivedJobs();

// Returns:
[
  {
    id: 'uuid',
    work_order_number: 'WO-2026-001',
    customer_name: 'ABC Corp',
    status: 'completed',
    archived: true,
    archived_at: '2026-02-15T10:30:00Z',
    archived_by: 'user-uuid',
    quote: { ... },
    workflow: { ... }
  }
]
```

### View Active Jobs

```typescript
const { data: activeJobs } = await JobCompletionService.getActiveJobs();

// Only returns jobs where archived=false
```

---

## Completion Logging

### View Completion Log

See complete audit trail of automation steps:

```typescript
const { data: log } = await JobCompletionService.getCompletionLog('wo-uuid');

// Returns:
[
  {
    id: 'uuid',
    completion_step: 'job_completion_started',
    step_status: 'started',
    step_message: 'Starting job completion automation for WO-2026-001',
    error_details: null,
    performed_by_name: 'John Smith',
    created_at: '2026-02-06T18:45:00Z'
  },
  {
    id: 'uuid',
    completion_step: 'invoice_finalized',
    step_status: 'completed',
    step_message: 'Invoice ready for finalization',
    error_details: null,
    performed_by_name: 'John Smith',
    created_at: '2026-02-06T18:45:01Z'
  },
  {
    id: 'uuid',
    completion_step: 'delivery_task_created',
    step_status: 'completed',
    step_message: 'Delivery task created',
    error_details: null,
    performed_by_name: 'John Smith',
    created_at: '2026-02-06T18:45:02Z'
  },
  {
    id: 'uuid',
    completion_step: 'job_completion_finished',
    step_status: 'completed',
    step_message: 'Job completion automation finished for WO-2026-001. All steps completed successfully.',
    error_details: null,
    performed_by_name: 'John Smith',
    created_at: '2026-02-06T18:45:03Z'
  }
]
```

**Use Cases:**
- Debugging automation issues
- Verifying steps completed
- Finding errors
- Audit compliance
- Performance analysis

---

## Frontend Service API

### JobCompletionService

**Location:** `src/services/job-completion-service.ts`

**Complete API:**

```typescript
// Job completion orchestration
completeJobAutomation(params: { ... })

// Delivery management
createDeliveryTask(params: { ... })
updateDeliveryTask(deliveryTaskId, updates)
getDeliveryTasks(workOrderId)
getAllDeliveryTasks(filters?)
getScheduledDeliveries(date)
getMyDeliveries(userId)
completeDelivery(deliveryTaskId, completedBy, signatureInfo?)
assignDelivery(deliveryTaskId, assignedTo)
getDeliveryDashboardStats()

// Invoice finalization
finalizeInvoice(workOrderId, userId, sendEmail?)

// Job archiving
archiveJob(workOrderId, userId, archiveQuote?, archiveInvoice?)
unarchiveJob(workOrderId, userId)
getArchivedJobs()
getActiveJobs()

// Logging
getCompletionLog(workOrderId)
```

---

## Complete Example: Full Job Lifecycle

### Scenario: T-Shirt Order from Start to Archive

**Initial State:**
- Quote approved by customer
- Work order WO-2026-001 created
- Production workflow begins

**Production Flow (Automated):**
```
Pre-Press → Production → Finishing → QC → ✅ Completed
```

**Job Completion Automation (Automatic):**

When QC passes and advances to "completed", automation triggers:

```typescript
// 1. Work order reaches completed stage
// Workflow automation calls: advanceStage(wo-uuid, qc-user, 'QC passed')

// 2. Database trigger fires automatically
// Trigger: trigger_job_completion_automation

// 3. complete_job_automation() executes
{
  workOrderId: 'wo-uuid',
  userId: 'qc-user-uuid',
  finalizeInvoice: true,              // ← From company settings
  sendInvoiceEmail: false,            // ← From company settings
  createDelivery: true,               // ← From company settings
  deliveryType: 'pickup',             // ← From company settings
  archiveJob: false                   // ← From company settings
}
```

**Step 1: Invoice Finalized (Automatic)**
```
✓ Invoice INV-2026-0123 found
✓ Status checked: 'draft'
✓ Marked ready for finalization
✓ Locked to prevent changes
✓ Ready to send (manual or automatic)

Log Entry:
{
  step: 'invoice_finalized',
  status: 'completed',
  message: 'Invoice ready for finalization'
}
```

**Step 2: Delivery Task Created (Automatic)**
```
✓ Delivery task created
✓ Type: pickup
✓ Status: pending
✓ Customer: ABC Corp
✓ Contact: Jane Smith, 555-0123
✓ Address: 123 Main St, Chicago, IL

Log Entry:
{
  step: 'delivery_task_created',
  status: 'completed',
  message: 'Delivery task created',
  delivery_task_id: 'uuid'
}
```

**Step 3: Completion Log**
```
✓ All steps completed successfully
✓ No errors
✓ Automation finished

Log Entry:
{
  step: 'job_completion_finished',
  status: 'completed',
  message: 'Job completion automation completed successfully'
}
```

**Logistics Team (Manual):**

```typescript
// 1. View pending deliveries
const { data: pending } = await JobCompletionService.getAllDeliveryTasks({
  status: 'pending'
});

// Shows: WO-2026-001 - ABC Corp - 150 shirts - Pickup

// 2. Schedule pickup
await JobCompletionService.updateDeliveryTask(deliveryTaskId, {
  delivery_status: 'scheduled',
  scheduled_date: '2026-02-08',
  scheduled_time_start: '14:00:00',
  scheduled_time_end: '16:00:00'
});

// 3. Customer arrives for pickup
await JobCompletionService.updateDeliveryTask(deliveryTaskId, {
  delivery_status: 'in_transit'
});

// 4. Customer picks up order
await JobCompletionService.completeDelivery(
  deliveryTaskId,
  'logistics-user-uuid',
  {
    signatureName: 'Jane Smith',
    signatureReceived: true
  }
);
```

**Accounting Team (Manual):**

```typescript
// View completion log
const { data: log } = await JobCompletionService.getCompletionLog('wo-uuid');

// See:
// - Invoice finalized ✓
// - Delivery task created ✓
// - All steps successful ✓

// Invoice is ready to send
// (Send through Printavo or directly)
```

**After 30 Days (Automatic Archive):**

```typescript
// Scheduled cron job runs daily at 2 AM
// Checks: completed_at < (now - 30 days)
// Archives: WO-2026-001 + Quote + Invoice

// Result:
{
  archived: true,
  archived_at: '2026-03-08T02:00:00Z',
  archived_by: 'system'
}

// Job moves to archived view
// Dashboard shows only active jobs
// Complete audit trail preserved
```

**Final State:**
- ✅ Work order completed and archived
- ✅ Invoice finalized and sent
- ✅ Payment received
- ✅ Delivery completed with signature
- ✅ Complete audit trail
- ✅ Clean dashboard views

---

## Error Handling

### Automation Errors

If any step fails during automation:

```typescript
{
  success: true,
  has_errors: true,
  steps: [
    {
      step: 'invoice_finalized',
      success: true
    },
    {
      step: 'delivery_task_created',
      success: false,
      error: {
        error: 'processing_failed',
        message: 'Missing delivery address'
      }
    }
  ],
  message: 'Job completion automation completed with some errors'
}
```

**Error Logging:**
```sql
INSERT INTO job_completion_log (
  completion_step: 'delivery_task_created',
  step_status: 'failed',
  error_details: 'Missing delivery address',
  ...
);
```

**What Happens:**
- Other steps continue executing
- Error logged to completion log
- has_errors flag set to true
- Admin can review and fix manually

**Common Errors:**
1. **No Invoice Found** - Work order not linked to invoice
2. **Missing Address** - Delivery address not provided
3. **Already Archived** - Job already archived
4. **Permission Error** - User lacks permission

### Retry Failed Steps

```typescript
// Manually retry failed step
await JobCompletionService.createDeliveryTask({
  workOrderId: 'wo-uuid',
  deliveryType: 'pickup',
  createdBy: 'user-uuid',
  deliveryAddress: {
    // ← Now provided
    address_line1: '123 Main St',
    city: 'Chicago',
    state: 'IL',
    zip: '60601'
  }
});
```

---

## Best Practices

### Delivery Management

1. **Schedule Deliveries Proactively:**
   - Review pending deliveries daily
   - Schedule pickups when items ready
   - Communicate schedules to customers
   - Assign drivers ahead of time

2. **Track Deliveries:**
   - Update status as delivery progresses
   - Capture signatures when required
   - Upload delivery photos as proof
   - Note any issues or delays

3. **Handle Failed Deliveries:**
   - Mark as 'failed' with reason
   - Reschedule delivery
   - Update customer
   - Log resolution in notes

### Invoice Finalization

1. **Review Before Finalizing:**
   - Verify line items correct
   - Check totals and taxes
   - Confirm customer details
   - Review special pricing

2. **Finalize When Ready:**
   - After work complete
   - Before delivery/pickup
   - When customer approves
   - All charges included

3. **Send Invoices:**
   - Manual send for high-value orders
   - Auto-send for routine orders
   - Include payment instructions
   - Set payment terms

### Job Archiving

1. **Archive When Complete:**
   - Work delivered/picked up
   - Invoice paid in full
   - No pending issues
   - Customer satisfied
   - Files backed up

2. **Archive Strategy:**
   - Auto-archive after 30 days (default)
   - Shorter for high-volume shops
   - Longer for custom/complex orders
   - Never auto-archive for some customers

3. **Review Archives:**
   - Periodically review archived jobs
   - Ensure proper categorization
   - Check for lingering issues
   - Update if needed

### Automation Settings

1. **Start Conservative:**
   - Manual invoice sending
   - Manual archiving
   - Review automation logs
   - Adjust based on results

2. **Gradually Automate:**
   - Once comfortable, enable auto-send
   - Then enable auto-archive
   - Monitor for issues
   - Refine settings

3. **Company-Specific:**
   - High-volume: aggressive automation
   - Custom work: manual control
   - Mixed: hybrid approach
   - Review quarterly

---

## Summary

The Job Completion Automation system provides:

**Automatic Workflow Integration:**
- Triggers on work order completion
- Executes based on company settings
- No manual intervention needed
- Complete audit trail

**Invoice Finalization:**
- Lock invoice totals
- Mark ready for sending
- Optional auto-send
- Integration with Printavo

**Delivery Management:**
- Create delivery tasks
- Schedule pickups/deliveries
- Track status and signatures
- Assign to drivers
- Complete delivery flow

**Job Archiving:**
- Soft-delete with flags
- Preserve all relationships
- Maintain audit trail
- Clean dashboard views
- Optional auto-archiving
- Can unarchive if needed

**Complete Logging:**
- Every step logged
- Error tracking
- Performance metrics
- Audit compliance
- Debugging support

**Flexible Configuration:**
- Per-company settings
- Enable/disable steps
- Customize delivery types
- Archive timing control
- Manual overrides available

This system ensures every completed job goes through proper finalization steps automatically, reduces manual work, prevents forgotten steps, maintains complete audit trails, and provides clean, organized views of active vs. archived work.
