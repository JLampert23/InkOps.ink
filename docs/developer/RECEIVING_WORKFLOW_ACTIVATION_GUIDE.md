## Receiving Workflow Activation - Complete Guide

Comprehensive receiving workflow with vendor confirmation enforcement, automatic job readiness detection, and production scheduler integration.

---

## Overview

The Receiving Workflow Activation system enables warehouse teams to receive goods from purchase orders with intelligent vendor confirmation enforcement, automatic quantity tracking, and seamless integration with the production schedule. When all garments for a job are received, the system automatically updates work order status and notifies the production scheduler.

---

## Architecture

### Database Schema

#### work_orders (Enhanced)
Production jobs with garment readiness tracking:
- `id` - Unique identifier
- `work_order_number` - Human-readable WO number
- `company_id` - Company isolation
- `quote_id` - Originating quote
- `customer_id` - Customer reference
- `status` - Current status (draft, in_progress, completed, cancelled, on_hold)
- `priority` - Priority level (low, medium, high, urgent)
- `production_due_date` - When production is due
- `customer_due_date` - Customer delivery date
- `assigned_to` - Assigned user
- `total_quantity` - Total items
- **`garments_ready`** - All garments received (boolean)
- **`garments_received_at`** - Timestamp when garments ready
- **`ready_for_production`** - Ready to start production (boolean)
- **`ready_for_production_at`** - Timestamp when ready

#### purchase_orders (Enhanced)
Purchase orders with receiving tracking:
- `id` - Unique identifier
- `po_number` - PO number
- `vendor_id` - Vendor reference
- `status` - PO status (draft, sent, confirmed, in_transit, partially_received, fully_received, closed)
- `expected_delivery_date` - Calculated delivery date
- **`receiving_status`** - Receiving progress (pending, partial, complete)
- Standard PO fields (totals, notes, etc.)

#### purchase_order_line_items (Enhanced)
Line items with receiving quantities:
- `id` - Unique identifier
- `po_id` - Parent PO
- `line_number` - Sequential line number
- `style_number` - Product SKU
- `product_name` - Description
- `color`, `size` - Attributes
- `quantity_ordered` - Units ordered
- **`quantity_received`** - Units received (cumulative)
- **`quantity_damaged`** - Damaged units (cumulative)
- **`quantity_short`** - Short/missing units (cumulative)
- **`upc_code`** - Barcode for scanning
- `unit_cost`, `extended_cost` - Pricing

#### receiving_logs
Receiving transactions:
- `id` - Unique identifier
- `company_id` - Company isolation
- `po_id` - Purchase order reference
- `received_by` - User who received
- `received_at` - Receipt timestamp
- `status` - partial or complete
- `notes` - Receipt notes
- `created_at` - Log timestamp

#### receiving_line_items
Line-level receiving details:
- `id` - Unique identifier
- `receiving_log_id` - Parent log
- `po_line_item_id` - PO line reference
- `quantity_received` - Units received this transaction
- `quantity_damaged` - Damaged this transaction
- `quantity_short` - Short this transaction
- `variance_notes` - Variance explanations
- `scanned_upc` - Scanned barcode
- `created_at` - Timestamp

#### garment_requirements_staging
Links POs to work orders:
- `id` - Unique identifier
- `work_order_id` - Work order reference
- `po_id` - Purchase order reference
- `is_po_created` - PO creation status
- `style_number`, `color` - Product details
- `total_quantity` - Total needed
- Standard requirement fields

---

## Vendor Confirmation Enforcement

### Configuration

**Company Setting:**
```sql
SELECT po_vendor_confirmation_required
FROM company_settings
WHERE id = company_id;
```

- `true` = Vendor confirmation required before receiving
- `false` = Can receive after PO sent

### PO Status Flow

#### Without Vendor Confirmation Required:
```
draft → sent → [CAN RECEIVE] → partially_received → fully_received → closed
```

#### With Vendor Confirmation Required:
```
draft → sent → [BLOCKED] → confirmed → [CAN RECEIVE] → partially_received → fully_received → closed
```

### Enforcement Logic

**Function: `can_receive_po()`**

```sql
CREATE FUNCTION can_receive_po(p_po_id uuid)
RETURNS boolean AS $$
DECLARE
  v_po_status text;
  v_company_id uuid;
  v_vendor_confirmation_required boolean;
BEGIN
  -- Get PO details
  SELECT po.status, po.company_id
  INTO v_po_status, v_company_id
  FROM purchase_orders po
  WHERE po.id = p_po_id;

  -- Draft POs cannot be received
  IF v_po_status = 'draft' THEN
    RETURN false;
  END IF;

  -- Get company settings
  SELECT po_vendor_confirmation_required
  INTO v_vendor_confirmation_required
  FROM company_settings
  WHERE id = v_company_id;

  -- If vendor confirmation required
  IF COALESCE(v_vendor_confirmation_required, false) THEN
    -- Must be confirmed before receiving
    IF v_po_status NOT IN ('confirmed', 'in_transit', 'partially_received', 'fully_received') THEN
      RETURN false;
    END IF;
  ELSE
    -- If confirmation not required, just need to be sent
    IF v_po_status NOT IN ('sent', 'confirmed', 'in_transit', 'partially_received', 'fully_received') THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;
```

**Block Reasons:**

| PO Status | Vendor Confirmation Required | Can Receive? | Block Reason |
|-----------|----------------------------|--------------|--------------|
| draft | Yes/No | No | PO is still in draft status |
| sent | Yes | No | Vendor confirmation required |
| sent | No | Yes | - |
| confirmed | Yes/No | Yes | - |
| in_transit | Yes/No | Yes | - |
| partially_received | Yes/No | Yes | - |
| fully_received | Yes/No | No | PO is already fully received |
| closed | Yes/No | No | PO is closed |

---

## Receiving Process

### Step-by-Step Workflow

#### 1. Check PO Receivability

**Frontend:**
```typescript
const { data: receivablePOs } = await ReceivingService.getReceivablePOs();

// Returns:
[
  {
    po_id: 'uuid',
    po_number: 'PO-00123',
    vendor_name: 'SanMar',
    status: 'sent',
    can_receive: false,
    block_reason: 'Vendor confirmation required',
    expected_delivery_date: '2026-02-17',
    total_items: 150,
    received_items: 0,
    pending_items: 150
  },
  {
    po_id: 'uuid',
    po_number: 'PO-00124',
    vendor_name: 'SSActivewear',
    status: 'confirmed',
    can_receive: true,
    block_reason: null,
    ...
  }
]
```

#### 2. Load PO for Receiving

**Frontend:**
```typescript
const { data: poDetails } = await ReceivingService.getPOWithLineItems(poId);

// Returns:
{
  po: {
    id: 'uuid',
    po_number: 'PO-00123',
    vendor: { vendor_name: 'SanMar', ... },
    status: 'confirmed',
    expected_delivery_date: '2026-02-17',
    ...
  },
  line_items: [
    {
      id: 'line-uuid-1',
      style_number: 'PC54',
      product_name: 'Port & Company Core Blend Tee',
      color: 'Navy',
      size: 'S',
      quantity_ordered: 10,
      quantity_received: 0,  // Previously received
      upc_code: '123456789',
      ...
    },
    ...
  ]
}
```

#### 3. Receive Items

**User Actions:**
- Enter received quantities manually
- Scan barcodes (UPC/SKU)
- Mark damaged items
- Note short shipments
- Add variance notes

**Frontend State:**
```typescript
const lineItems = [
  {
    id: 'line-uuid-1',
    ...originalData,
    receiving: {
      quantity_received: 10,    // New receipt
      quantity_damaged: 0,
      quantity_short: 0,
      variance_notes: ''
    }
  },
  {
    id: 'line-uuid-2',
    ...originalData,
    receiving: {
      quantity_received: 18,
      quantity_damaged: 2,      // 2 damaged
      quantity_short: 0,
      variance_notes: 'Torn packaging on 2 units'
    }
  }
]
```

#### 4. Process Receiving

**Function: `process_receiving()`**

```typescript
const { data: result, error } = await ReceivingService.processReceiving(
  poId,
  userId,
  [
    {
      po_line_item_id: 'line-uuid-1',
      quantity_received: 10,
      quantity_damaged: 0,
      quantity_short: 0,
      variance_notes: ''
    },
    {
      po_line_item_id: 'line-uuid-2',
      quantity_received: 18,
      quantity_damaged: 2,
      quantity_short: 0,
      variance_notes: 'Torn packaging on 2 units'
    }
  ],
  'Received from SanMar delivery'
);

// Returns:
{
  success: true,
  receiving_log_id: 'log-uuid',
  total_received: 28,
  message: 'Successfully received 28 items'
}

// Or if blocked:
{
  success: false,
  error: 'vendor_confirmation_required',
  message: 'This PO requires vendor confirmation before receiving...'
}
```

**Backend Process:**
```sql
1. Validate: can_receive_po(po_id)
   └─ If false → Return error

2. Create receiving_logs entry
   └─ company_id, po_id, received_by, status, notes

3. For each line item:
   └─ Create receiving_line_items entry
   └─ Update purchase_order_line_items quantities
      └─ quantity_received += received
      └─ quantity_damaged += damaged
      └─ quantity_short += short

4. Trigger: update_po_receiving_status()
   └─ Calculate totals
   └─ Update PO.receiving_status
      └─ pending → partial → complete

5. Trigger: update_work_order_status_after_receiving()
   └─ Find linked work orders via garment_requirements
   └─ For each work order:
      └─ Check: check_work_order_readiness()
      └─ If ready:
         └─ Update work_order:
            └─ garments_ready = true
            └─ ready_for_production = true
            └─ status = in_progress (if draft)
         └─ Log activity: 'work_order_ready'

6. Return success with totals
```

---

## Receiving Updates

### PO Line Item Updates

**Automatic Cumulative Tracking:**

```sql
-- Initial state
quantity_ordered: 20
quantity_received: 0
quantity_damaged: 0
quantity_short: 0

-- After first receiving (15 good, 0 damaged, 0 short)
quantity_ordered: 20
quantity_received: 15
quantity_damaged: 0
quantity_short: 0

-- After second receiving (3 good, 2 damaged, 0 short)
quantity_ordered: 20
quantity_received: 18  -- 15 + 3
quantity_damaged: 2    -- 0 + 2
quantity_short: 0      -- 0 + 0

-- Total accounted for: 18 + 2 = 20 ✓
```

### PO Status Updates

**Trigger: `update_po_receiving_status()`**

```sql
-- Calculate totals
SELECT
  SUM(quantity_ordered) as total_ordered,
  SUM(quantity_received) as total_received
FROM purchase_order_line_items
WHERE po_id = po_id;

-- Update PO status
IF total_received = 0 THEN
  receiving_status = 'pending'
ELSIF total_received >= total_ordered THEN
  receiving_status = 'complete'
  status = 'fully_received'  (from check_po_received_status trigger)
ELSIF total_received > 0 THEN
  receiving_status = 'partial'
  status = 'partially_received'  (from check_po_received_status trigger)
END IF;
```

**Status Flow:**
```
receiving_status: pending → partial → complete
status: sent/confirmed → partially_received → fully_received
```

---

## Job Readiness System

### Readiness Check Logic

**Function: `check_work_order_readiness()`**

```sql
CREATE FUNCTION check_work_order_readiness(p_work_order_id uuid)
RETURNS boolean AS $$
DECLARE
  v_requirements_count integer;
  v_requirements_with_po integer;
  v_total_needed integer;
  v_total_received integer;
BEGIN
  -- 1. Count total requirements for this work order
  SELECT COUNT(*)
  INTO v_requirements_count
  FROM garment_requirements_staging
  WHERE work_order_id = p_work_order_id;

  -- If no requirements, not ready
  IF v_requirements_count = 0 THEN
    RETURN false;
  END IF;

  -- 2. Count requirements that have POs created
  SELECT COUNT(*)
  INTO v_requirements_with_po
  FROM garment_requirements_staging
  WHERE work_order_id = p_work_order_id
    AND is_po_created = true
    AND po_id IS NOT NULL;

  -- If not all requirements have POs, not ready
  IF v_requirements_with_po < v_requirements_count THEN
    RETURN false;
  END IF;

  -- 3. Calculate total quantities needed vs received
  SELECT
    COALESCE(SUM(grs.total_quantity), 0),
    COALESCE(SUM(poli.quantity_received), 0)
  INTO v_total_needed, v_total_received
  FROM garment_requirements_staging grs
  LEFT JOIN purchase_order_line_items poli ON grs.po_id = poli.po_id
    AND grs.style_number = poli.style_number
    AND COALESCE(grs.color, '') = COALESCE(poli.color, '')
  WHERE grs.work_order_id = p_work_order_id;

  -- Check if all items received
  IF v_total_received >= v_total_needed THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;
```

**Readiness Criteria:**
1. Work order has garment requirements
2. All requirements have POs created (`is_po_created = true`)
3. All requirements have `po_id` assigned
4. Total `quantity_received` >= total `total_quantity` needed

### Work Order Status Updates

**Trigger: `update_work_order_status_after_receiving()`**

```sql
-- After receiving line items inserted/updated
1. Get PO ID from receiving log

2. Find all work orders linked to this PO
   SELECT ARRAY_AGG(DISTINCT work_order_id)
   FROM garment_requirements_staging
   WHERE po_id = po_id
     AND work_order_id IS NOT NULL;

3. For each work order:
   a. Check readiness: check_work_order_readiness(work_order_id)

   b. If ready (returns true):
      UPDATE work_orders
      SET
        garments_ready = true,
        garments_received_at = COALESCE(garments_received_at, now()),
        ready_for_production = true,
        ready_for_production_at = COALESCE(ready_for_production_at, now()),
        status = CASE
          WHEN status = 'draft' THEN 'in_progress'
          ELSE status
        END,
        updated_at = now()
      WHERE id = work_order_id
        AND garments_ready = false;  -- Only update if not already ready

   c. Log activity
      INSERT INTO purchase_order_activity_log (...)
      VALUES (
        ...,
        'work_order_ready',
        format('Work Order %s is now ready for production', wo.work_order_number),
        jsonb_build_object(
          'work_order_id', work_order_id,
          'work_order_number', wo.work_order_number
        )
      );
```

**Status Changes:**
- `garments_ready`: false → true (permanent)
- `garments_received_at`: NULL → timestamp (permanent)
- `ready_for_production`: false → true
- `ready_for_production_at`: NULL → timestamp
- `status`: draft → in_progress (if needed)

---

## Production Scheduler Integration

### Automatic Readiness Notification

When work order becomes ready, the system:

1. **Updates Work Order:**
   - Sets `ready_for_production = true`
   - Records `ready_for_production_at` timestamp
   - Changes `status` from draft to in_progress

2. **Logs Activity:**
   - Creates activity log entry
   - Action: `work_order_ready`
   - Includes work order number
   - Metadata with work order details

3. **Scheduler Visibility:**
   - Production scheduler queries ready work orders
   - Shows in "Ready to Start" section
   - Prioritized by `production_due_date`

### Scheduler Query

```typescript
const { data: readyWorkOrders } = await ReceivingService.getReadyWorkOrders();

// Returns:
[
  {
    id: 'wo-uuid',
    work_order_number: 'WO-2026-001',
    customer_name: 'ABC Corp',
    status: 'in_progress',
    priority: 'high',
    production_due_date: '2026-02-25',
    customer_due_date: '2026-03-01',
    garments_ready: true,
    garments_received_at: '2026-02-10T14:30:00Z',
    ready_for_production: true,
    ready_for_production_at: '2026-02-10T14:30:00Z',
    total_quantity: 150,
    ...
  }
]
```

### Scheduler Dashboard Integration

**Filter Ready Jobs:**
```typescript
// Get work orders ready for production
const readyWOs = await ReceivingService.getReadyWorkOrders();

// Get pending work orders (waiting for garments)
const pendingWOs = await ReceivingService.getPendingWorkOrders();
```

**Display Logic:**
- **Ready Section:** `ready_for_production = true` AND `garments_ready = true`
- **Pending Section:** `garments_ready = false`
- **In Progress:** `status = 'in_progress'` (may or may not have garments)

---

## Complete Workflow Example

### Scenario: Approved Quote → Garments Received → Production Ready

```
1. Quote Approved
   └─ Creates work_order (WO-2026-001)
   └─ Creates garment_requirements_staging:
      └─ Requirement 1: 50 × PC54-Navy
      └─ Requirement 2: 100 × PC61-Red

2. Auto-PO Creation
   └─ Groups by vendor (SanMar)
   └─ Creates PO-00123 with 2 line items:
      └─ Line 1: PC54-Navy-S (10), PC54-Navy-M (20), PC54-Navy-L (20)
      └─ Line 2: PC61-Red-M (50), PC61-Red-L (50)
   └─ Updates requirements:
      └─ is_po_created = true
      └─ po_id = 'PO-00123'
   └─ PO status = 'draft'

3. PO Sent to Vendor
   └─ User changes status to 'sent'
   └─ sent_at timestamp recorded

4. Vendor Confirmation (if required)
   └─ User marks PO as 'confirmed'
   └─ confirmed_at timestamp recorded
   └─ Now can_receive_po() returns true

5. First Partial Receiving
   ┌─ Warehouse receives first delivery
   └─ Process receiving:
      └─ PC54-Navy-S: 10 received
      └─ PC54-Navy-M: 20 received
      └─ PC54-Navy-L: 18 received, 2 damaged
   └─ Creates receiving_log (status: partial)
   └─ Creates receiving_line_items for each
   └─ Updates PO line items:
      └─ quantity_received updated
      └─ quantity_damaged updated
   └─ Trigger updates PO:
      └─ receiving_status = 'partial'
      └─ status = 'partially_received'
   └─ Trigger checks work order readiness:
      └─ Total needed: 150
      └─ Total received: 48
      └─ Not ready yet (48 < 150)

6. Second Partial Receiving
   ┌─ Warehouse receives remaining delivery
   └─ Process receiving:
      └─ PC54-Navy-L: 2 received (completes PC54)
      └─ PC61-Red-M: 50 received
      └─ PC61-Red-L: 50 received
   └─ Creates receiving_log (status: complete)
   └─ Creates receiving_line_items
   └─ Updates PO line items:
      └─ All quantities now received
   └─ Trigger updates PO:
      └─ receiving_status = 'complete'
      └─ status = 'fully_received'
   └─ Trigger checks work order readiness:
      └─ Total needed: 150
      └─ Total received: 150
      └─ ✓ READY! (150 >= 150)
   └─ Updates work_order:
      └─ garments_ready = true
      └─ garments_received_at = now()
      └─ ready_for_production = true
      └─ ready_for_production_at = now()
      └─ status = 'in_progress'
   └─ Logs activity: 'work_order_ready'

7. Production Scheduler Sees Ready Job
   └─ Query: getReadyWorkOrders()
   └─ Returns WO-2026-001
   └─ Shows in "Ready to Start" section
   └─ Production team can begin work
```

---

## Frontend Service API

### ReceivingService

**Location:** `src/services/receiving-service.ts`

**Complete API:**

```typescript
// Get receivable POs with vendor confirmation check
getReceivablePOs(): Promise<{
  data: ReceivablePO[] | null;
  error: any;
}>

// Check if specific PO can be received
canReceivePO(poId: string): Promise<{
  data: boolean | null;
  error: any;
}>

// Get PO with line items for receiving
getPOWithLineItems(poId: string): Promise<{
  data: { po: any; line_items: POLineItem[] } | null;
  error: any;
}>

// Process receiving with vendor confirmation enforcement
processReceiving(
  poId: string,
  receivedBy: string,
  lineItems: ReceivingLineItem[],
  notes?: string
): Promise<{
  data: ReceivingResult | null;
  error: any;
}>

// Get receiving history for a PO
getReceivingHistory(poId: string): Promise<{
  data: ReceivingLog[] | null;
  error: any;
}>

// Get all receiving logs with filters
getAllReceivingLogs(filters?: {
  start_date?: string;
  end_date?: string;
  po_id?: string;
  received_by?: string;
}): Promise<{
  data: ReceivingLog[] | null;
  error: any;
}>

// Check work order readiness
checkWorkOrderReadiness(workOrderId: string): Promise<{
  data: boolean | null;
  error: any;
}>

// Get ready work orders (garments received)
getReadyWorkOrders(): Promise<{
  data: WorkOrder[] | null;
  error: any;
}>

// Get pending work orders (waiting for garments)
getPendingWorkOrders(): Promise<{
  data: WorkOrder[] | null;
  error: any;
}>

// Get garment requirements for work order
getWorkOrderRequirements(workOrderId: string): Promise<{
  data: Array<{
    style_number: string;
    total_quantity: number;
    quantity_received: number;
    quantity_pending: number;
  }> | null;
  error: any;
}>

// Get receiving statistics
getReceivingStats(): Promise<{
  data: {
    pending_pos: number;
    blocked_pos: number;
    partially_received_pos: number;
    total_received_today: number;
    total_received_week: number;
    ready_work_orders: number;
    pending_work_orders: number;
  } | null;
  error: any;
}>
```

---

## UI Components

### ReceiveGoods Component

**Location:** `src/components/purchase-orders/ReceiveGoods.tsx`

**Features:**
- Vendor confirmation enforcement validation
- Line-by-line receiving with quantities
- Barcode scanning support (UPC/SKU)
- Damaged and short quantity tracking
- Variance notes per line item
- Quick "Receive All" button per line
- Real-time totals display
- Receiving notes
- Mark as complete option

**Validation:**
- Blocks receiving if vendor confirmation required and not confirmed
- Shows clear error message with block reason
- Prevents save with 0 quantities
- Validates quantities don't exceed ordered

**Enhanced with:**
- Uses `ReceivingService.processReceiving()` for backend enforcement
- Handles vendor confirmation errors gracefully
- Provides user-friendly error messages

### ReceivingDashboard Component

**Location:** `src/components/purchase-orders/ReceivingDashboard.tsx`

**Features:**
- List of receivable POs
- Visual indication of blocked POs
- Filter by status, vendor, date
- Quick receive action
- Receiving history view
- Statistics dashboard

---

## Testing Scenarios

### Test 1: Vendor Confirmation Required

**Setup:**
```sql
UPDATE company_settings
SET po_vendor_confirmation_required = true
WHERE id = company_id;

INSERT INTO purchase_orders (...) VALUES (
  ..., 'sent', NULL, ...  -- status = sent, confirmed_at = NULL
);
```

**Test:**
```typescript
const { data: canReceive } = await ReceivingService.canReceivePO(poId);
// Expected: false

const { data: result } = await ReceivingService.processReceiving(...);
// Expected:
{
  success: false,
  error: 'vendor_confirmation_required',
  message: 'This PO requires vendor confirmation before receiving...'
}
```

**Fix and Retest:**
```sql
UPDATE purchase_orders
SET status = 'confirmed', confirmed_at = now()
WHERE id = po_id;
```

```typescript
const { data: canReceive } = await ReceivingService.canReceivePO(poId);
// Expected: true

const { data: result } = await ReceivingService.processReceiving(...);
// Expected:
{
  success: true,
  receiving_log_id: 'uuid',
  total_received: 50,
  message: 'Successfully received 50 items'
}
```

### Test 2: Work Order Readiness

**Setup:**
```sql
-- Create work order with 2 requirements
INSERT INTO work_orders (...) VALUES (...);

INSERT INTO garment_requirements_staging (...) VALUES
  (..., work_order_id, ..., 50, ..., false, NULL),  -- Requirement 1: 50 units
  (..., work_order_id, ..., 100, ..., false, NULL); -- Requirement 2: 100 units
```

**Test Initial State:**
```typescript
const { data: isReady } = await ReceivingService.checkWorkOrderReadiness(workOrderId);
// Expected: false (no POs created yet)
```

**Create POs:**
```sql
-- Auto-PO creates POs and updates requirements
-- Requirement 1: is_po_created = true, po_id = 'PO-1'
-- Requirement 2: is_po_created = true, po_id = 'PO-2'
```

```typescript
const { data: isReady } = await ReceivingService.checkWorkOrderReadiness(workOrderId);
// Expected: false (POs created but nothing received yet)
```

**Receive Partial:**
```typescript
await ReceivingService.processReceiving('PO-1', userId, [
  { po_line_item_id: 'line1', quantity_received: 50, ... }
]);

const { data: isReady } = await ReceivingService.checkWorkOrderReadiness(workOrderId);
// Expected: false (50/150 received)
```

**Receive Remaining:**
```typescript
await ReceivingService.processReceiving('PO-2', userId, [
  { po_line_item_id: 'line2', quantity_received: 100, ... }
]);

const { data: isReady } = await ReceivingService.checkWorkOrderReadiness(workOrderId);
// Expected: true (150/150 received)

// Check work order was updated
const { data: wo } = await supabase
  .from('work_orders')
  .select('garments_ready, ready_for_production, status')
  .eq('id', workOrderId)
  .single();

// Expected:
{
  garments_ready: true,
  ready_for_production: true,
  status: 'in_progress'
}
```

### Test 3: Partial Receiving Flow

**Setup:**
```sql
INSERT INTO purchase_order_line_items (...) VALUES
  ('line1', ..., 'PC54', 'Navy', 'M', 20, 0, ...);  -- 20 ordered, 0 received
```

**First Receipt:**
```typescript
await ReceivingService.processReceiving(poId, userId, [
  { po_line_item_id: 'line1', quantity_received: 15, ... }
]);

// Check line item
const { data: lineItem } = await supabase
  .from('purchase_order_line_items')
  .select('quantity_ordered, quantity_received')
  .eq('id', 'line1')
  .single();

// Expected:
{ quantity_ordered: 20, quantity_received: 15 }

// Check PO status
const { data: po } = await supabase
  .from('purchase_orders')
  .select('status, receiving_status')
  .eq('id', poId)
  .single();

// Expected:
{ status: 'partially_received', receiving_status: 'partial' }
```

**Second Receipt:**
```typescript
await ReceivingService.processReceiving(poId, userId, [
  { po_line_item_id: 'line1', quantity_received: 5, ... }
]);

// Check line item (cumulative)
const { data: lineItem } = await supabase
  .from('purchase_order_line_items')
  .select('quantity_ordered, quantity_received')
  .eq('id', 'line1')
  .single();

// Expected:
{ quantity_ordered: 20, quantity_received: 20 }  // 15 + 5 = 20

// Check PO status (should be complete)
const { data: po } = await supabase
  .from('purchase_orders')
  .select('status, receiving_status')
  .eq('id', poId)
  .single();

// Expected:
{ status: 'fully_received', receiving_status: 'complete' }
```

### Test 4: Damaged and Short Tracking

**Setup:**
```sql
INSERT INTO purchase_order_line_items (...) VALUES
  ('line1', ..., 'PC54', 'Navy', 'L', 100, 0, 0, 0, ...);
```

**Receipt with Variances:**
```typescript
await ReceivingService.processReceiving(poId, userId, [
  {
    po_line_item_id: 'line1',
    quantity_received: 95,
    quantity_damaged: 3,
    quantity_short: 2,
    variance_notes: '3 damaged (torn), 2 short shipped'
  }
]);

// Check line item
const { data: lineItem } = await supabase
  .from('purchase_order_line_items')
  .select('quantity_ordered, quantity_received, quantity_damaged, quantity_short')
  .eq('id', 'line1')
  .single();

// Expected:
{
  quantity_ordered: 100,
  quantity_received: 95,
  quantity_damaged: 3,
  quantity_short: 2
  // Total accounted: 95 + 3 + 2 = 100 ✓
}

// Check receiving log captured variances
const { data: receivingLog } = await supabase
  .from('receiving_line_items')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

// Expected:
{
  quantity_received: 95,
  quantity_damaged: 3,
  quantity_short: 2,
  variance_notes: '3 damaged (torn), 2 short shipped'
}
```

---

## Troubleshooting

### Issue: PO Not Receivable

**Check:**
```typescript
const { data: receivablePOs } = await ReceivingService.getReceivablePOs();

const blockedPO = receivablePOs.find(po => po.po_number === 'PO-00123');
console.log(blockedPO.block_reason);
```

**Common Reasons:**
1. "PO is still in draft status"
   - Solution: Change status to 'sent' or 'confirmed'
2. "Vendor confirmation required"
   - Solution: Update company_settings.po_vendor_confirmation_required = false OR confirm the PO
3. "PO is already fully received"
   - Solution: PO is complete, no further receiving needed

### Issue: Work Order Not Becoming Ready

**Check Readiness:**
```typescript
const { data: isReady } = await ReceivingService.checkWorkOrderReadiness(workOrderId);
console.log('Is Ready:', isReady);

const { data: requirements } = await ReceivingService.getWorkOrderRequirements(workOrderId);
console.log('Requirements:', requirements);
```

**Verify:**
1. All requirements have `is_po_created = true`
2. All requirements have `po_id` assigned
3. Total received >= total needed

**Common Issues:**
- Missing PO link: `po_id = NULL`
  - Solution: Run auto-PO creation
- Partial receipt: `quantity_received < total_quantity`
  - Solution: Complete receiving
- Style/color mismatch: PO line items don't match requirements
  - Solution: Verify style_number and color match exactly

### Issue: Incorrect Quantities

**Check Line Item History:**
```typescript
const { data: history } = await ReceivingService.getReceivingHistory(poId);

history.forEach(log => {
  console.log('Received at:', log.received_at);
  console.log('Line items:', log.line_items);
});
```

**Verify Cumulative Totals:**
```sql
SELECT
  style_number,
  color,
  size,
  quantity_ordered,
  quantity_received,
  quantity_damaged,
  quantity_short,
  (quantity_received + quantity_damaged + quantity_short) as total_accounted
FROM purchase_order_line_items
WHERE po_id = 'po-uuid';
```

**Common Issues:**
- Duplicate receiving: Same items received twice
  - Solution: Check receiving_logs for duplicates
- Missing receiving: Some items not recorded
  - Solution: Process missed receipt

---

## Best Practices

### Vendor Confirmation
1. **Enable for Critical Vendors:** Turn on for large/expensive orders
2. **Disable for Trusted Vendors:** Streamline for frequent, reliable suppliers
3. **Document Confirmations:** Use PO notes to record confirmation details
4. **Track Confirmation Time:** Monitor `confirmed_at` timestamp

### Receiving Process
1. **Daily Receiving:** Process receipts same day as delivery
2. **Immediate Verification:** Check quantities and quality during receipt
3. **Document Variances:** Always note damaged/short items with details
4. **Barcode Scanning:** Use UPC scanning for speed and accuracy
5. **Partial Receipts:** Accept partial deliveries but track carefully

### Work Order Readiness
1. **Monitor Pending:** Check pending work orders daily
2. **Expedite Critical:** Prioritize receiving for urgent jobs
3. **Clear Communication:** Notify production when jobs ready
4. **Regular Review:** Weekly review of garment requirements status

### Quality Control
1. **Damage Documentation:** Photo damaged items, note details
2. **Short Shipment Claims:** File with vendor immediately
3. **Reject Poor Quality:** Don't accept if below standards
4. **Track Vendor Performance:** Monitor damage/short rates by vendor

---

## Summary

The Receiving Workflow Activation system provides:

**Intelligent Enforcement:**
- Vendor confirmation rules enforced automatically
- Clear blocking reasons when POs can't be received
- Company-configurable confirmation requirements

**Accurate Tracking:**
- Cumulative quantity tracking (received, damaged, short)
- Line-by-line receiving with variances
- Complete receiving history audit trail
- Barcode scanning support

**Automatic Readiness:**
- Checks work order readiness after every receipt
- Updates work order status when all garments received
- Sets ready_for_production flag automatically
- Records timestamps for accountability

**Production Integration:**
- Scheduler sees ready jobs immediately
- Prioritized by production due date
- Clear distinction between ready and pending
- Complete garment availability tracking

**User Experience:**
- Simple receiving interface
- Real-time validation and feedback
- Quick actions for common tasks
- Clear error messages and guidance

This system ensures receiving teams can efficiently process deliveries while maintaining data accuracy, enforcing business rules, and seamlessly integrating with production scheduling for optimal workflow from order to fulfillment.
