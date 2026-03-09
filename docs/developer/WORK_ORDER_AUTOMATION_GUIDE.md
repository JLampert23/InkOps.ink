# Work Order Creation Automation

## Overview

Comprehensive work order creation system that automatically generates production-ready work orders when quotes are approved. Work orders include all production data without pricing, integrate with the workflow board, and track progress through customizable production stages.

---

## Architecture

### Database Tables

#### 1. Work Orders Table
Production tracking master table:
- `work_order_number` - Auto-generated (WO-YYYYMMDD-XXXXX)
- `company_id` - Company isolation
- `quote_id` - Links to originating quote
- `customer_id` - Customer reference
- `customer_name` - Cached customer name
- `status` - Current workflow stage (matches workflow column names)
- `priority` - Priority level (low, medium, high, urgent)
- `production_due_date` - Production deadline
- `customer_due_date` - Customer delivery date
- `assigned_to` - User ID of assigned team member
- `total_quantity` - Total items across all line items
- `notes` - Production notes from quote
- `started_at` - When production began
- `completed_at` - When work completed

#### 2. Work Order Line Items Table
Production data without pricing:
- `work_order_id` - Parent work order
- `quote_line_item_id` - Links to original quote line item
- `line_number` - Display order
- `item_type` - Type: garment, decoration, custom, other
- `description` - Item description
- `style_number` - Product SKU
- `style_name` - Product name
- `color` - Garment color
- `sizes` (jsonb) - Size breakdown for production
- `quantity` - Total quantity
- `supplier_type` - Supplier category
- `supplier_name` - Supplier name
- `garment_images` (jsonb) - Product images for reference
- `notes` - Production-specific notes
- `is_completed` - Completion status
- `completed_at` - Completion timestamp

#### 3. Production Workflow Columns Table
Customizable workflow stages:
- `column_name` - Display name (e.g., "Pending Scheduling", "In Production")
- `column_order` - Display order in workflow board
- `color` - Visual color indicator
- `is_default` - Whether new work orders start in this column

**Default Columns:**
1. Pending Scheduling (gray, default)
2. In Production (blue)
3. Quality Check (yellow)
4. Ready to Ship (purple)
5. Completed (green)

---

## Automation Workflow

### Trigger
**When:** Quote status changes to 'approved'

### Automatic Work Order Creation

The `process_quote_approval()` function executes:

#### 1. Generate Work Order Number
```sql
Format: WO-YYYYMMDD-XXXXX
Example: WO-20250206-00001
```
- Date-based prefix
- Sequential 5-digit counter per day
- Unique per company

#### 2. Create Work Order Record
```sql
INSERT INTO work_orders (
  work_order_number,
  company_id,
  quote_id,
  customer_id,
  customer_name,
  status,
  priority,
  production_due_date,
  customer_due_date,
  total_quantity,
  notes
)
```
- Copies relevant quote data
- Sets status to default workflow column
- Calculates total quantity from line items
- Links to customer and quote

#### 3. Populate Line Items (Without Pricing)
```sql
FOR EACH quote_line_item:
  INSERT INTO work_order_line_items (
    work_order_id,
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
    supplier_type,
    supplier_name,
    garment_images,
    notes
  )
```
**Key Points:**
- Pricing information EXCLUDED (production doesn't need it)
- All production-relevant data copied
- Maintains line order
- Links back to original quote line item

#### 4. Link Imprints
- Imprints remain linked via `quote_id`
- Accessible through work order → quote relationship
- Production schedule entries reference work order

#### 5. Set Initial Workflow Status
- Status set to default workflow column name
- Typically "Pending Scheduling"
- Appears in correct column on workflow board

---

## Work Order Number Generation

### Format
```
WO-YYYYMMDD-XXXXX
```

### Components
- `WO` - Prefix
- `YYYYMMDD` - Current date (e.g., 20250206)
- `XXXXX` - Sequential number (padded to 5 digits)

### Examples
- `WO-20250206-00001` - First work order on Feb 6, 2025
- `WO-20250206-00002` - Second work order on Feb 6, 2025
- `WO-20250207-00001` - First work order on Feb 7, 2025 (counter resets)

### Generation Logic
```sql
SELECT 'WO-' || to_char(now(), 'YYYYMMDD') || '-' ||
       LPAD(COALESCE(MAX(SUBSTRING(work_order_number FROM '\d+$'))::int, 0) + 1::text, 5, '0')
FROM work_orders
WHERE company_id = ?
  AND work_order_number LIKE 'WO-' || to_char(now(), 'YYYYMMDD') || '-%';
```

---

## Workflow Board Integration

### Kanban-Style Board
Visual workflow management with drag-and-drop:

**Columns:**
- Each column represents a production stage
- Configurable per company
- Color-coded for visual distinction

**Cards:**
- Work order number
- Customer name
- Due date (with overdue indicator)
- Total quantity
- Priority indicator
- Assigned status

### Card Features
- **Drag & Drop:** Move between workflow stages
- **Color Indicators:** Priority-based left border
  - Red: Urgent
  - Orange: High
  - Yellow: Medium
  - Green: Low
- **Overdue Alerts:** Red text and alert icon for past-due dates
- **Click to View:** Opens detailed work order view

### Status Updates
```typescript
// Moving a work order updates its status
await WorkOrderService.updateWorkOrderStatus(workOrderId, columnName);
```
- Drag card to new column
- Status updates automatically
- Triggers timestamp updates

---

## Work Order Detail View

### Overview Section
- Work order number
- Status badge
- Priority badge
- Customer name
- Link to original quote
- Key dates (production due, customer due)
- Total quantity
- Assigned user
- Progress bar (completed items / total items)
- Production notes

### Tabs

#### 1. Line Items Tab
**Features:**
- Checkbox to mark items complete
- Item description
- Style number and name
- Color
- Size breakdown
- Quantity
- Supplier information
- Completion status
- Strike-through when completed

**Actions:**
- Toggle completion status
- Auto-completes work order when all items done

#### 2. Imprints Tab
**Displays:**
- Artwork thumbnail
- Type of work (Screen Printing, Embroidery, etc.)
- Location
- Imprint number
- Production details

#### 3. Schedule Tab
**Shows:**
- Type of work
- Quantity
- Assigned station
- Production due date
- Step statuses

---

## Frontend Components

### WorkOrderService
**Location:** `src/services/work-order-service.ts`

**Key Methods:**
```typescript
// Get all work orders with filters
getWorkOrders(filters?: {
  status?: string;
  priority?: string;
  assigned_to?: string;
  search?: string;
})

// Get single work order with details
getWorkOrderById(workOrderId: string)

// Get work orders grouped by status (for board)
getWorkOrdersByStatus()

// Update work order status
updateWorkOrderStatus(workOrderId: string, status: string)

// Assign work order to user
assignWorkOrder(workOrderId: string, userId: string)

// Complete/uncomplete line items
completeLineItem(lineItemId: string)
uncompleteLineItem(lineItemId: string)

// Get workflow columns
getWorkflowColumns()

// Manage workflow columns
createWorkflowColumn(columnName: string, color: string)
updateWorkflowColumn(columnId: string, updates: Partial<WorkflowColumn>)
deleteWorkflowColumn(columnId: string)
```

### WorkflowBoard Component
**Location:** `src/components/production/WorkflowBoard.tsx`

**Features:**
- Kanban-style board layout
- Drag-and-drop work order cards
- Status-based columns
- Priority indicators
- Overdue alerts
- Real-time updates

### WorkOrderDetail Component
**Location:** `src/components/production/WorkOrderDetail.tsx`

**Features:**
- Complete work order information
- Tabbed interface (line items, imprints, schedule)
- Line item completion tracking
- Progress visualization
- Back navigation

### WorkOrdersManager Component
**Location:** `src/components/production/WorkOrdersManager.tsx`

**Purpose:**
- Wrapper component
- Manages view state (board vs detail)
- Handles navigation between views

---

## Data Flow

```
Quote Approved
      ↓
[process_quote_approval() trigger]
      ↓
  Generate WO Number
      ↓
  Create Work Order Record
      ↓
  Copy Line Items (no pricing)
      ↓
  Set to Default Workflow Column
      ↓
  Link Imprints & Schedule
      ↓
[Work Order Created]
      ↓
  Appears in Workflow Board
      ↓
[Production Team Actions]
      ↓
  Drag to move through stages
  Check off completed items
  Update assignments
      ↓
[Auto-Complete when all items done]
      ↓
  Status → "Completed"
  completed_at timestamp set
```

---

## Line Item Completion Automation

### Trigger
**When:** Line item `is_completed` status changes

### Function: `check_work_order_completion()`

**Logic:**
```sql
1. Count total line items for work order
2. Count completed line items
3. If all items completed:
   - Update work order status to 'completed'
   - Set completed_at timestamp
```

**Result:**
- Work order automatically marked complete
- No manual status update needed
- Maintains accurate completion tracking

---

## Security & Permissions

### Row Level Security
All tables have company-based isolation:

**Work Orders:**
```sql
USING (company_id = get_user_company_id())
```

**Work Order Line Items:**
```sql
USING (company_id = get_user_company_id())
```

**Workflow Columns:**
```sql
USING (company_id = get_user_company_id())
```

### Permissions
- View: All authenticated users in company
- Create: All authenticated users in company
- Update: All authenticated users in company
- Delete: All authenticated users in company

---

## Testing

### Test Scenario 1: Basic Work Order Creation
1. Create a quote with multiple line items
2. Add imprints
3. Approve the quote
4. Verify:
   - Work order created with correct number
   - Line items copied (without pricing)
   - Status set to "Pending Scheduling"
   - Appears in workflow board
   - All imprints linked

### Test Scenario 2: Workflow Board Movement
1. Open workflow board
2. Drag work order to different column
3. Verify:
   - Status updates
   - Card moves to new column
   - Database reflects change

### Test Scenario 3: Line Item Completion
1. Open work order detail
2. Check off all line items
3. Verify:
   - Progress bar updates
   - Work order auto-completes
   - Status changes to "Completed"
   - `completed_at` timestamp set

### Verification Queries

```sql
-- Check work order created
SELECT
  wo.*,
  (SELECT COUNT(*) FROM work_order_line_items WHERE work_order_id = wo.id) as line_item_count
FROM work_orders wo
WHERE quote_id = ?;

-- Check line items (no pricing)
SELECT
  woli.*
FROM work_order_line_items woli
WHERE work_order_id = ?
ORDER BY line_number;

-- Verify pricing excluded
SELECT
  COUNT(*)
FROM information_schema.columns
WHERE table_name = 'work_order_line_items'
  AND column_name IN ('unit_price', 'total_price', 'price');
-- Should return 0

-- Check workflow columns
SELECT *
FROM production_workflow_columns
WHERE company_id = ?
ORDER BY column_order;
```

---

## Customization

### Adding Workflow Columns
```typescript
await WorkOrderService.createWorkflowColumn(
  'Custom Stage',
  '#ff6b6b' // Custom color
);
```

### Reordering Columns
```typescript
await WorkOrderService.updateWorkflowColumn(columnId, {
  column_order: newOrder
});
```

### Setting Default Column
```typescript
await WorkOrderService.updateWorkflowColumn(columnId, {
  is_default: true
});
```

---

## Integration Points

### With Quote System
- Triggers on quote approval
- Maintains quote_id link
- Copies production data
- Preserves audit trail

### With Production Scheduler
- Schedule entries link to quote
- Accessible via work order → quote relationship
- Shared production due dates

### With Garment Requirements
- Garment staging includes work_order_id
- Links PO creation to work orders
- Tracks supplier fulfillment

### With Invoicing
- Invoice links to work order
- Billing separate from production
- Shared customer and order data

---

## Best Practices

### Work Order Management
1. **Assign Early:** Assign work orders to team members quickly
2. **Update Status:** Move cards as work progresses
3. **Track Items:** Check off line items as they complete
4. **Monitor Due Dates:** Watch for overdue indicators
5. **Add Notes:** Use notes field for production updates

### Workflow Organization
1. **Keep Columns Relevant:** Only add columns you'll use
2. **Logical Flow:** Order columns by production sequence
3. **Color Code:** Use colors meaningfully (red for urgent stages)
4. **Regular Reviews:** Check board daily for bottlenecks

### Data Quality
1. **Complete Quotes:** Ensure quotes have all production data
2. **Accurate Quantities:** Verify size breakdowns
3. **Clear Descriptions:** Write clear line item descriptions
4. **Supplier Info:** Include supplier details for ordering

---

## Troubleshooting

### Issue: Work order created but no line items
**Check:**
1. Verify quote has line items
2. Check line items have required fields populated
3. Look for errors in activity log

### Issue: Work order not appearing in workflow board
**Check:**
1. Verify work order status matches a column name
2. Check workflow columns exist for company
3. Refresh the board

### Issue: Can't complete line items
**Check:**
1. User has permissions
2. Work order is not already completed
3. Check for RLS policy issues

### Issue: Drag and drop not working
**Check:**
1. Browser supports drag events
2. Work order is not locked/completed
3. Target column exists

---

## Future Enhancements

Potential additions:
1. Batch assignment to users
2. Time tracking per line item
3. Resource allocation
4. Capacity planning
5. Production reports
6. Mobile app for floor staff
7. Barcode scanning
8. Real-time notifications
9. Production analytics dashboard

---

## Summary

The Work Order Creation Automation provides:

**Automatic Creation:**
- Generated on quote approval
- Unique WO numbers
- Complete production data
- No pricing information

**Visual Workflow:**
- Kanban-style board
- Drag-and-drop status updates
- Priority indicators
- Overdue alerts

**Detailed Tracking:**
- Line-by-line completion
- Progress visualization
- Linked imprints and schedule
- Auto-completion

**Complete Integration:**
- Quotes system
- Production scheduler
- Garment requirements
- Invoicing system

This system eliminates manual work order creation, provides visual production tracking, and maintains complete audit trails from quote to completion.
