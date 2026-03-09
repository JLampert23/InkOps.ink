## Auto-PO Creation System - Complete Guide

Comprehensive automatic purchase order creation from garment requirements with intelligent vendor grouping, lead time calculation, and notification system.

---

## Overview

The Auto-PO Creation System automatically generates draft purchase orders when garment requirements exist from approved quotes. The system intelligently groups requirements by vendor, calculates delivery dates based on lead times, and creates properly structured POs ready for review.

---

## Architecture

### Database Tables

#### 1. vendors (Enhanced)
Vendor management with auto-PO capabilities:
- `id` - Unique identifier
- `company_id` - Company isolation
- `vendor_name` - Vendor display name
- `vendor_type` - Type (ssactivewear, sanmar, independent)
- `contact_name` - Primary contact
- `contact_email` - Email address
- `contact_phone` - Phone number
- `address_1`, `address_2`, `city`, `state`, `zip`, `country` - Physical address
- `payment_terms` - Payment terms (Net 30, etc.)
- `notes` - Internal notes
- `is_active` - Active status
- **`default_lead_time_days`** - Business days from order to delivery
- **`minimum_order_quantity`** - Min units per order
- **`minimum_order_value`** - Min dollar amount per order
- **`preferred_vendor`** - Preferred for auto-PO when multiple options
- **`auto_po_enabled`** - Allow automatic PO creation

#### 2. company_settings (Enhanced)
Auto-PO configuration per company:
- **`po_auto_create_enabled`** - Enable/disable auto-PO feature
- **`po_auto_create_threshold_days`** - Days before due date to trigger
- **`po_auto_create_notify_users`** - User IDs to notify (uuid[])
- **`po_auto_create_notify_enabled`** - Enable notifications
- `po_auto_group_by_vendor` - Group by vendor (recommended)
- `po_auto_split_by_vendor` - Split into separate POs
- `po_number_format` - PO numbering format
- `po_starting_sequence` - Starting sequence number

#### 3. garment_requirements_staging
Staging area for requirements from approved quotes:
- `id` - Unique identifier
- `company_id` - Company isolation
- `quote_id` - Source quote
- `work_order_id` - Linked work order
- `supplier_type` - Supplier category
- `supplier_name` - Supplier name
- `style_number` - Product SKU/style
- `style_name` - Product name
- `color` - Garment color
- `sizes` (jsonb) - Size breakdown {"S": 10, "M": 20, "L": 15}
- `total_quantity` - Total units needed
- `unit_cost` - Cost per unit
- `total_cost` - Total cost
- **`is_po_created`** - PO creation status
- **`po_id`** - Reference to created PO
- `notes` - Special instructions
- `created_at`, `updated_at` - Timestamps

#### 4. purchase_orders
Draft POs created by automation:
- `id` - Unique identifier
- `company_id` - Company isolation
- `po_number` - Auto-generated PO number
- `vendor_id` - Vendor reference
- `status` - Draft status initially
- `subtotal` - Line items total
- `tax_amount` - Tax
- `shipping_cost` - Shipping
- `total_cost` - Grand total
- `notes_to_vendor` - External notes
- `internal_notes` - Internal notes
- **`expected_delivery_date`** - Calculated delivery date
- `sent_at`, `confirmed_at`, `received_at`, `closed_at` - Workflow timestamps
- `created_by` - User who created (or system)
- `created_at`, `updated_at` - Timestamps

#### 5. purchase_order_line_items
Individual line items in PO:
- `id` - Unique identifier
- `company_id` - Company isolation
- `po_id` - Parent PO
- `line_number` - Sequential line number
- `sku` - Product SKU
- `style_number` - Style reference
- `product_name` - Product description
- `color` - Color
- `size` - Size (or "Mixed")
- `quantity_ordered` - Units ordered
- `quantity_received` - Units received (0 initially)
- `unit_cost` - Cost per unit
- `extended_cost` - Line total (qty × cost)
- `vendor_product_id` - Vendor's product ID
- `notes` - Line item notes

#### 6. purchase_order_activity_log
Audit trail for PO operations:
- `id` - Unique identifier
- `company_id` - Company isolation
- `po_id` - Parent PO
- `action` - Action type (po_auto_created, notification_sent, etc.)
- `performed_by` - User or system
- `performed_by_name` - Display name
- `notes` - Action details
- `meta` (jsonb) - Additional metadata
- `created_at` - Timestamp

---

## Automation Process

### Trigger Points

**1. Manual Trigger:**
- User clicks "Create POs" button in Auto-PO Dashboard
- Calls `auto_create_pos_from_requirements()`
- Processes all pending requirements immediately

**2. Scheduled Trigger (Future):**
- Cron job runs daily
- Calls `check_and_create_pos_for_upcoming_requirements()`
- Checks requirements approaching due date
- Creates POs based on threshold settings

### Workflow Steps

#### Step 1: Check Eligibility
```sql
-- Check if auto-PO is enabled
SELECT po_auto_create_enabled,
       po_auto_create_threshold_days,
       po_auto_group_by_vendor
FROM company_settings
WHERE id = company_id;

-- If disabled, return early
IF NOT po_auto_create_enabled THEN
  RETURN 'Auto-PO creation not enabled';
END IF;
```

#### Step 2: Group Requirements by Vendor
```sql
-- Group pending requirements by supplier
SELECT
  supplier_type,
  supplier_name,
  COUNT(*) as requirement_count,
  SUM(total_cost) as total_value
FROM garment_requirements_staging
WHERE company_id = company_id
  AND is_po_created = false
  AND supplier_type IS NOT NULL
GROUP BY supplier_type, supplier_name;
```

**Grouping Logic:**
- **SanMar** requirements → SanMar vendor
- **SSActivewear** requirements → SSActivewear vendor
- **Independent** requirements → Specific vendor by name

#### Step 3: Get or Create Vendor
```sql
-- Find existing vendor
SELECT id FROM vendors
WHERE company_id = company_id
  AND LOWER(vendor_type) = LOWER(supplier_type)
  AND LOWER(vendor_name) = LOWER(supplier_name)
LIMIT 1;

-- If not found, create new vendor
IF vendor_id IS NULL THEN
  INSERT INTO vendors (
    company_id,
    vendor_name,
    vendor_type,
    is_active,
    auto_po_enabled,
    default_lead_time_days,
    preferred_vendor
  ) VALUES (
    company_id,
    supplier_name,
    supplier_type,
    true,
    true,
    CASE
      WHEN supplier_type IN ('sanmar', 'ssactivewear') THEN 3
      ELSE 7
    END,
    supplier_type IN ('sanmar', 'ssactivewear')
  )
  RETURNING id INTO vendor_id;
END IF;
```

**Vendor Auto-Creation Rules:**
- SanMar: 3 day lead time, preferred vendor
- SSActivewear: 3 day lead time, preferred vendor
- Independent: 7 day lead time, not preferred
- Auto-PO enabled by default for all

#### Step 4: Check Vendor Settings
```sql
-- Verify vendor allows auto-PO
SELECT auto_po_enabled, is_active
FROM vendors
WHERE id = vendor_id;

-- Skip if disabled or inactive
IF NOT auto_po_enabled OR NOT is_active THEN
  CONTINUE; -- Skip to next vendor
END IF;
```

#### Step 5: Calculate Expected Delivery Date
```sql
-- Get vendor lead time
SELECT default_lead_time_days
FROM vendors
WHERE id = vendor_id;

-- Add processing days (2 days to prepare and send PO)
total_days := lead_time_days + 2;

-- Calculate business days (skip weekends)
expected_delivery_date := calculate_business_days(
  CURRENT_DATE,
  total_days
);
```

**Business Days Calculation:**
```sql
CREATE FUNCTION calculate_business_days(
  start_date date,
  days_to_add integer
) RETURNS date AS $$
DECLARE
  current_date date;
  days_added integer := 0;
  day_of_week integer;
BEGIN
  current_date := start_date;

  WHILE days_added < days_to_add LOOP
    current_date := current_date + 1;
    day_of_week := EXTRACT(DOW FROM current_date);

    -- Skip weekends (0 = Sunday, 6 = Saturday)
    IF day_of_week NOT IN (0, 6) THEN
      days_added := days_added + 1;
    END IF;
  END LOOP;

  RETURN current_date;
END;
$$ LANGUAGE plpgsql;
```

**Example Delivery Dates:**
- Monday order + 3 days lead time = Thursday delivery
- Thursday order + 3 days = Tuesday delivery (skips weekend)
- Friday order + 7 days = next Tuesday delivery

#### Step 6: Generate PO Number
```sql
-- Get next sequential number for company
SELECT generate_po_number();

-- Returns: PO-00001, PO-00002, etc.
-- Format configurable in company_settings.po_number_format
```

#### Step 7: Create Draft PO
```sql
INSERT INTO purchase_orders (
  company_id,
  po_number,
  vendor_id,
  status,
  expected_delivery_date,
  notes_to_vendor,
  internal_notes,
  created_by
) VALUES (
  company_id,
  po_number,
  vendor_id,
  'draft',  -- Always starts as draft
  expected_delivery_date,
  'Auto-generated purchase order from approved quotes',
  'Automatically created from garment requirements. Review before sending.',
  auth.uid()
)
RETURNING id INTO po_id;
```

#### Step 8: Create Line Items
```sql
-- For each requirement in this vendor group
FOR requirement IN
  SELECT * FROM garment_requirements_staging
  WHERE supplier_type = vendor_group.supplier_type
    AND supplier_name = vendor_group.supplier_name
    AND is_po_created = false
LOOP
  -- If sizes are specified, create one line per size
  IF requirement.sizes IS NOT NULL THEN
    FOR size_key, size_qty IN
      SELECT key, value::integer
      FROM jsonb_each_text(requirement.sizes)
      WHERE value::integer > 0
    LOOP
      INSERT INTO purchase_order_line_items (
        company_id,
        po_id,
        line_number,
        style_number,
        product_name,
        color,
        size,
        quantity_ordered,
        unit_cost,
        extended_cost
      ) VALUES (
        company_id,
        po_id,
        line_number,
        requirement.style_number,
        requirement.style_name,
        requirement.color,
        size_key,  -- e.g., "S", "M", "L"
        size_qty,
        requirement.unit_cost,
        requirement.unit_cost * size_qty
      );

      line_number := line_number + 1;
    END LOOP;
  ELSE
    -- No size breakdown, single line item
    INSERT INTO purchase_order_line_items (
      company_id,
      po_id,
      line_number,
      style_number,
      product_name,
      color,
      size,
      quantity_ordered,
      unit_cost,
      extended_cost
    ) VALUES (
      company_id,
      po_id,
      line_number,
      requirement.style_number,
      requirement.style_name,
      requirement.color,
      'Mixed',
      requirement.total_quantity,
      requirement.unit_cost,
      requirement.unit_cost * requirement.total_quantity
    );
  END IF;

  -- Mark requirement as processed
  UPDATE garment_requirements_staging
  SET
    is_po_created = true,
    po_id = po_id,
    updated_at = now()
  WHERE id = requirement.id;
END LOOP;
```

**Line Item Creation Rules:**
- If `sizes` jsonb exists: One line per size
  - Example: {"S": 10, "M": 20, "L": 15} → 3 lines
- If no sizes: Single line with total quantity
- Line numbers sequential: 1, 2, 3, ...
- Extended cost auto-calculated: qty × unit_cost

#### Step 9: Calculate PO Totals
```sql
-- Automatically triggered by trigger_update_po_totals

-- Sum all line items
SELECT COALESCE(SUM(extended_cost), 0)
INTO subtotal
FROM purchase_order_line_items
WHERE po_id = po_id;

-- Update PO
UPDATE purchase_orders
SET
  subtotal = subtotal,
  total_cost = subtotal + tax_amount + shipping_cost,
  updated_at = now()
WHERE id = po_id;
```

#### Step 10: Log Activity
```sql
INSERT INTO purchase_order_activity_log (
  company_id,
  po_id,
  action,
  performed_by,
  performed_by_name,
  notes,
  meta
) VALUES (
  company_id,
  po_id,
  'po_auto_created',
  auth.uid(),
  'Auto-PO System',
  'Purchase order automatically created from garment requirements',
  jsonb_build_object(
    'vendor_type', vendor_type,
    'vendor_name', vendor_name,
    'requirement_count', requirement_count,
    'line_items_count', line_item_count,
    'expected_delivery', expected_delivery_date
  )
);
```

#### Step 11: Send Notifications
```sql
-- If notifications enabled
IF po_auto_create_notify_enabled
   AND notify_users IS NOT NULL
   AND array_length(notify_users, 1) > 0 THEN

  PERFORM trigger_auto_po_notifications(
    company_id,
    po_ids_array,
    notify_users_array
  );
END IF;
```

**Notification System:**
- Logs notification in activity log
- Records notified user IDs
- Includes PO count and IDs
- Future: Email/SMS integration

---

## Complete Data Flow

```
Quote Approved
      ↓
[Garment Requirements Staged]
      ↓
garment_requirements_staging
• supplier_type: "sanmar"
• supplier_name: "SanMar"
• style_number: "PC54"
• color: "Navy"
• sizes: {"S": 10, "M": 20, "L": 15, "XL": 5}
• total_quantity: 50
• unit_cost: 5.50
• total_cost: 275.00
• is_po_created: false
      ↓
[User Clicks "Create POs"]
      ↓
auto_create_pos_from_requirements()
      ↓
[1. Check Settings]
• po_auto_create_enabled: true
• po_auto_group_by_vendor: true
      ↓
[2. Group Requirements]
• SanMar: 3 requirements, $825 total
• SSActivewear: 2 requirements, $450 total
      ↓
[3. For Each Vendor Group]
      ↓
[SanMar Group]
      ↓
[4. Get/Create Vendor]
• vendor_id: existing or new
• vendor_type: "sanmar"
• default_lead_time_days: 3
• auto_po_enabled: true
      ↓
[5. Calculate Delivery Date]
• Today: Monday, Feb 10
• Lead time: 3 business days
• Processing: 2 business days
• Total: 5 business days
• Expected Delivery: Monday, Feb 17
      ↓
[6. Generate PO Number]
• po_number: "PO-00123"
      ↓
[7. Create Draft PO]
INSERT INTO purchase_orders
• status: "draft"
• vendor_id: sanmar_vendor_id
• expected_delivery_date: "2026-02-17"
• notes_to_vendor: "Auto-generated..."
• internal_notes: "Review before sending..."
      ↓
[8. Create Line Items]
FOR requirement IN (3 SanMar requirements):
  • Requirement 1: PC54, Navy, sizes {"S":10, "M":20, "L":15, "XL":5}
    → Line 1: PC54-Navy-S, Qty 10, $5.50, $55.00
    → Line 2: PC54-Navy-M, Qty 20, $5.50, $110.00
    → Line 3: PC54-Navy-L, Qty 15, $5.50, $82.50
    → Line 4: PC54-Navy-XL, Qty 5, $5.50, $27.50

  • Requirement 2: PC61, Red, sizes {"M":25, "L":25}
    → Line 5: PC61-Red-M, Qty 25, $6.00, $150.00
    → Line 6: PC61-Red-L, Qty 25, $6.00, $150.00

  • Requirement 3: PC450, Black, no sizes, qty 100
    → Line 7: PC450-Black-Mixed, Qty 100, $4.00, $400.00
      ↓
[9. Calculate Totals]
• Subtotal: $975.00 (sum of all lines)
• Tax: $0.00 (not set)
• Shipping: $0.00 (not set)
• Total: $975.00
      ↓
[10. Mark Requirements as Processed]
UPDATE garment_requirements_staging
SET
  is_po_created = true,
  po_id = 'PO-00123-id'
WHERE id IN (requirement_ids);
      ↓
[11. Log Activity]
INSERT INTO purchase_order_activity_log
• action: "po_auto_created"
• meta: {
    "vendor_type": "sanmar",
    "requirement_count": 3,
    "line_items_count": 7,
    "expected_delivery": "2026-02-17"
  }
      ↓
[12. Repeat for SSActivewear]
• Creates PO-00124 with SSActivewear requirements
      ↓
[13. Return Result]
{
  "success": true,
  "message": "Created 2 draft PO(s)",
  "pos_created": 2,
  "po_ids": ["po-id-1", "po-id-2"],
  "company_id": "company-uuid"
}
      ↓
[14. Send Notifications]
• Notify purchasing_user_1
• Notify purchasing_user_2
• Log: "notification_sent"
      ↓
[Draft POs Ready for Review]
• Status: "draft"
• Visible in PO list
• Can be reviewed, edited, sent
      ↓
[Purchasing Team Reviews]
• View PO details
• Verify line items
• Adjust quantities if needed
• Add notes
• Update status to "sent"
      ↓
[PO Sent to Vendor]
• Status: "sent"
• sent_at timestamp recorded
• Vendor receives PO
• Awaiting confirmation
```

---

## Frontend Integration

### POAutoCreationService

**Location:** `src/services/po-auto-creation-service.ts`

**Key Methods:**
```typescript
// Get pending requirements
getPendingRequirements()
// Returns: All requirements where is_po_created = false

// Group requirements by vendor
getRequirementsByVendor()
// Returns: Grouped by supplier_type and supplier_name

// Auto-create POs
autoCreatePOs(companyId?: string)
// Triggers auto-creation process
// Returns: { success, message, pos_created, po_ids }

// Vendor management
getVendors(filters)
updateVendor(vendorId, updates)
createVendor(vendor)

// Settings
getAutoCreateSettings()
updateAutoCreateSettings(settings)

// Delivery dates
calculateExpectedDeliveryDate(vendorId, processingDays)

// Statistics
getVendorStats()
getPOStatsByStatus()
getRequirementsSummary()

// PO retrieval
getDraftPOs()
getPOById(poId)
```

### AutoPODashboard Component

**Location:** `src/components/purchase-orders/AutoPODashboard.tsx`

**Features:**
- Statistics dashboard
- Pending requirements summary
- Requirements grouped by vendor
- Settings modal
- One-click PO creation
- Real-time status updates

**Statistics Displayed:**
- Pending Requirements (count + value)
- POs Created (count)
- Active Vendors (total + auto-PO enabled)
- Draft POs (awaiting review)

**Requirements by Vendor:**
- Vendor name and type
- Requirement count
- Total value
- Detailed requirement list

**Settings:**
- Enable/disable auto-PO
- Creation threshold (days)
- Group by vendor
- Enable notifications
- Notify user selection

---

## Configuration

### Company Settings

**Enable Auto-PO Creation:**
```typescript
await POAutoCreationService.updateAutoCreateSettings({
  po_auto_create_enabled: true,
  po_auto_create_threshold_days: 14,
  po_auto_group_by_vendor: true,
  po_auto_create_notify_enabled: true,
  po_auto_create_notify_users: [user1_id, user2_id]
});
```

**Settings Explained:**
- `po_auto_create_enabled` - Master on/off switch
- `po_auto_create_threshold_days` - Days before due date (14 = 2 weeks)
- `po_auto_group_by_vendor` - One PO per vendor (recommended)
- `po_auto_split_by_vendor` - Separate POs even for same vendor
- `po_auto_create_notify_enabled` - Send notifications
- `po_auto_create_notify_users` - User IDs to notify

### Vendor Configuration

**Update Vendor Settings:**
```typescript
await POAutoCreationService.updateVendor(vendorId, {
  auto_po_enabled: true,
  default_lead_time_days: 5,
  preferred_vendor: true,
  minimum_order_quantity: 100,
  minimum_order_value: 500.00
});
```

**Vendor Settings Explained:**
- `auto_po_enabled` - Allow auto-PO for this vendor
- `default_lead_time_days` - Business days from order to delivery
- `preferred_vendor` - Preferred when multiple vendors available
- `minimum_order_quantity` - Minimum units per order
- `minimum_order_value` - Minimum dollar amount per order

**Recommended Lead Times:**
- SanMar: 3 days (quick fulfillment)
- SSActivewear: 3 days (quick fulfillment)
- Independent vendors: 7-14 days
- International vendors: 21-30 days

---

## Usage Examples

### Example 1: Manual PO Creation

**Scenario:** 3 approved quotes with garment requirements

**Action:**
```typescript
// User clicks "Create POs" button
const result = await POAutoCreationService.autoCreatePOs();

// Response:
{
  success: true,
  message: "Created 2 draft PO(s)",
  pos_created: 2,
  po_ids: ["uuid-1", "uuid-2"]
}
```

**Result:**
- PO-00045 created for SanMar (3 requirements, 7 line items)
- PO-00046 created for SSActivewear (2 requirements, 5 line items)
- All requirements marked as `is_po_created = true`
- Draft POs visible in purchase orders list
- Purchasing team notified

### Example 2: View Pending Requirements

```typescript
const { data: groups } = await POAutoCreationService.getRequirementsByVendor();

// Returns:
[
  {
    supplier_type: "sanmar",
    supplier_name: "SanMar",
    requirement_count: 3,
    total_value: 825.00,
    requirements: [
      {
        style_number: "PC54",
        color: "Navy",
        sizes: {"S": 10, "M": 20, "L": 15},
        total_quantity: 45,
        unit_cost: 5.50,
        total_cost: 247.50
      },
      // ... more requirements
    ]
  },
  {
    supplier_type: "ssactivewear",
    supplier_name: "SSActivewear",
    requirement_count: 2,
    total_value: 450.00,
    requirements: [...]
  }
]
```

### Example 3: Calculate Delivery Date

```typescript
const { data: deliveryDate } = await POAutoCreationService.calculateExpectedDeliveryDate(
  vendorId,
  2  // 2 days processing time
);

// Returns: "2026-02-17" (Monday, skipping weekend)
```

### Example 4: Configure Vendor

```typescript
// Set up new vendor
const { data: vendor } = await POAutoCreationService.createVendor({
  company_id: companyId,
  vendor_name: "Custom Apparel Co",
  vendor_type: "independent",
  contact_email: "orders@customapparel.com",
  default_lead_time_days: 10,
  auto_po_enabled: true,
  preferred_vendor: false,
  is_active: true
});
```

---

## Testing

### Test Scenario 1: Create PO from Single Requirement

**Setup:**
```sql
-- Create garment requirement
INSERT INTO garment_requirements_staging (
  company_id,
  quote_id,
  work_order_id,
  supplier_type,
  supplier_name,
  style_number,
  style_name,
  color,
  sizes,
  total_quantity,
  unit_cost,
  total_cost,
  is_po_created
) VALUES (
  'company-uuid',
  'quote-uuid',
  'wo-uuid',
  'sanmar',
  'SanMar',
  'PC54',
  'Port & Company Core Blend Tee',
  'Navy',
  '{"S": 10, "M": 20, "L": 15, "XL": 5}'::jsonb,
  50,
  5.50,
  275.00,
  false
);
```

**Execute:**
```sql
SELECT auto_create_pos_from_requirements('company-uuid');
```

**Verify:**
```sql
-- Check PO created
SELECT * FROM purchase_orders
WHERE company_id = 'company-uuid'
  AND status = 'draft'
ORDER BY created_at DESC
LIMIT 1;

-- Check line items (should be 4: S, M, L, XL)
SELECT * FROM purchase_order_line_items
WHERE po_id = 'po-uuid'
ORDER BY line_number;

-- Check requirement marked as processed
SELECT is_po_created, po_id
FROM garment_requirements_staging
WHERE id = 'requirement-uuid';

-- Check activity log
SELECT * FROM purchase_order_activity_log
WHERE po_id = 'po-uuid'
  AND action = 'po_auto_created';
```

**Expected Results:**
- 1 PO created with status "draft"
- 4 line items (one per size)
- Line 1: PC54-Navy-S, Qty 10, $55.00
- Line 2: PC54-Navy-M, Qty 20, $110.00
- Line 3: PC54-Navy-L, Qty 15, $82.50
- Line 4: PC54-Navy-XL, Qty 5, $27.50
- Subtotal: $275.00
- Requirement marked `is_po_created = true`
- Activity log entry created

### Test Scenario 2: Multiple Vendors

**Setup:**
```sql
-- SanMar requirement
INSERT INTO garment_requirements_staging (...) VALUES (
  ..., 'sanmar', 'SanMar', ...
);

-- SSActivewear requirement
INSERT INTO garment_requirements_staging (...) VALUES (
  ..., 'ssactivewear', 'SSActivewear', ...
);

-- Independent vendor requirement
INSERT INTO garment_requirements_staging (...) VALUES (
  ..., 'independent', 'Custom Co', ...
);
```

**Execute:**
```sql
SELECT auto_create_pos_from_requirements('company-uuid');
```

**Verify:**
```sql
-- Should create 3 POs (one per vendor)
SELECT
  po.po_number,
  v.vendor_name,
  v.vendor_type,
  COUNT(li.id) as line_item_count,
  SUM(li.extended_cost) as total_value
FROM purchase_orders po
JOIN vendors v ON po.vendor_id = v.id
LEFT JOIN purchase_order_line_items li ON po.id = li.po_id
WHERE po.company_id = 'company-uuid'
  AND po.created_at > NOW() - INTERVAL '1 minute'
GROUP BY po.id, po.po_number, v.vendor_name, v.vendor_type
ORDER BY po.po_number;
```

**Expected Results:**
- 3 POs created
- Each PO linked to correct vendor
- All requirements marked as processed
- Line items grouped correctly

### Test Scenario 3: Vendor Auto-Creation

**Setup:**
```sql
-- Requirement with new vendor
INSERT INTO garment_requirements_staging (...) VALUES (
  ..., 'independent', 'New Vendor LLC', ...
);
```

**Execute:**
```sql
SELECT auto_create_pos_from_requirements('company-uuid');
```

**Verify:**
```sql
-- Check vendor was created
SELECT * FROM vendors
WHERE company_id = 'company-uuid'
  AND vendor_name = 'New Vendor LLC'
  AND vendor_type = 'independent';

-- Verify auto settings
SELECT
  auto_po_enabled,
  default_lead_time_days,
  preferred_vendor
FROM vendors
WHERE vendor_name = 'New Vendor LLC';
```

**Expected Results:**
- New vendor created automatically
- `auto_po_enabled = true`
- `default_lead_time_days = 7` (independent default)
- `preferred_vendor = false`
- PO created and linked to new vendor

### Test Scenario 4: Delivery Date Calculation

**Test:**
```sql
-- Friday order with 3 day lead time
SELECT calculate_business_days('2026-02-13'::date, 5);
-- Should return: '2026-02-20' (next Friday, skipping weekend)

-- Monday order with 3 day lead time
SELECT calculate_business_days('2026-02-09'::date, 5);
-- Should return: '2026-02-16' (next Monday)
```

**Expected Results:**
- Weekends (Saturday/Sunday) skipped
- Only business days counted
- Dates calculated correctly

### Test Scenario 5: Notification System

**Setup:**
```sql
-- Enable notifications
UPDATE company_settings
SET
  po_auto_create_notify_enabled = true,
  po_auto_create_notify_users = ARRAY['user1-uuid', 'user2-uuid']
WHERE id = 'company-uuid';
```

**Execute:**
```sql
SELECT auto_create_pos_from_requirements('company-uuid');
```

**Verify:**
```sql
-- Check notification logs
SELECT *
FROM purchase_order_activity_log
WHERE action = 'notification_sent'
  AND created_at > NOW() - INTERVAL '1 minute'
ORDER BY created_at DESC;
```

**Expected Results:**
- Notification entries in activity log
- One entry per notified user
- Meta contains PO IDs and count

---

## Troubleshooting

### Issue: POs Not Being Created

**Checks:**
1. Verify auto-PO is enabled:
```sql
SELECT po_auto_create_enabled
FROM company_settings
WHERE id = company_id;
```

2. Check for pending requirements:
```sql
SELECT COUNT(*)
FROM garment_requirements_staging
WHERE company_id = company_id
  AND is_po_created = false;
```

3. Verify vendor has auto-PO enabled:
```sql
SELECT vendor_name, auto_po_enabled, is_active
FROM vendors
WHERE company_id = company_id;
```

**Solution:**
- Enable auto-PO in company settings
- Ensure vendors have `auto_po_enabled = true`
- Verify vendors are active

### Issue: Wrong Vendor Selected

**Check:**
```sql
-- Review vendor matching logic
SELECT
  grs.supplier_type,
  grs.supplier_name,
  v.vendor_name,
  v.vendor_type,
  v.preferred_vendor
FROM garment_requirements_staging grs
LEFT JOIN vendors v ON
  LOWER(v.vendor_type) = LOWER(grs.supplier_type)
  AND LOWER(v.vendor_name) = LOWER(COALESCE(grs.supplier_name, grs.supplier_type))
WHERE grs.company_id = company_id;
```

**Solution:**
- Ensure vendor names match exactly
- Use vendor_type consistently
- Set preferred_vendor flag correctly

### Issue: Incorrect Line Items

**Check:**
```sql
-- Review size breakdown
SELECT
  style_number,
  sizes,
  total_quantity
FROM garment_requirements_staging
WHERE is_po_created = false;
```

**Solution:**
- Verify sizes jsonb format: `{"S": 10, "M": 20}`
- Ensure total_quantity matches sum of sizes
- Check for null or empty sizes field

### Issue: Wrong Delivery Date

**Check:**
```sql
-- Test delivery date calculation
SELECT
  vendor_name,
  default_lead_time_days,
  calculate_expected_delivery_date(id, 2) as expected_delivery
FROM vendors
WHERE company_id = company_id;
```

**Solution:**
- Update vendor lead time: `UPDATE vendors SET default_lead_time_days = X`
- Verify business days calculation
- Check current date vs. expected date

---

## Best Practices

### Vendor Configuration
1. **Set Realistic Lead Times:** Use actual vendor fulfillment times
2. **Mark Preferred Vendors:** Set preferred_vendor for frequently used suppliers
3. **Enable Selectively:** Only enable auto-PO for reliable vendors
4. **Regular Review:** Update lead times based on actual performance

### Requirement Management
1. **Accurate Sizes:** Ensure size breakdowns are correct before approval
2. **Current Costs:** Keep unit costs updated for accurate PO totals
3. **Clear Notes:** Add special instructions to requirement notes
4. **Regular Processing:** Run auto-PO creation regularly to avoid backlogs

### PO Review Process
1. **Daily Review:** Check draft POs daily
2. **Verify Quantities:** Confirm quantities match production needs
3. **Check Delivery Dates:** Ensure dates align with production schedule
4. **Add Details:** Include notes, shipping instructions, payment terms
5. **Send Promptly:** Don't let drafts sit too long

### Notification Setup
1. **Select Right Users:** Notify purchasing managers, not everyone
2. **Test Notifications:** Verify notifications reach intended users
3. **Monitor Response:** Track how quickly POs are reviewed
4. **Adjust as Needed:** Add/remove users based on workflow

---

## Future Enhancements

Potential additions to the system:

1. **Email Integration:**
   - Send PO PDFs to vendors via email
   - Template-based email customization
   - Tracking email opens and responses

2. **Vendor Portal:**
   - Vendors can view POs online
   - Accept/reject orders
   - Update order status
   - Upload shipping documents

3. **Inventory Integration:**
   - Check current inventory before creating PO
   - Reduce quantities if inventory available
   - Track inventory levels automatically

4. **Cost Optimization:**
   - Suggest bulk orders for better pricing
   - Consolidate orders to reduce shipping
   - Alert when approaching minimum order values

5. **Approval Workflows:**
   - Multi-step approval for large POs
   - Budget checks before creation
   - Manager override capabilities

6. **Advanced Notifications:**
   - Email notifications with PO summary
   - SMS alerts for urgent POs
   - Slack/Teams integration

7. **Analytics:**
   - Vendor performance tracking
   - Lead time accuracy analysis
   - Cost trend analysis
   - Order frequency patterns

8. **Scheduled Auto-Creation:**
   - Daily cron job to check requirements
   - Auto-create based on threshold days
   - Weekly batch processing option

---

## Summary

The Auto-PO Creation System provides:

**Automatic Creation:**
- Groups requirements by vendor
- Creates draft POs instantly
- Calculates line items from size breakdowns
- Marks requirements as processed

**Intelligent Vendor Management:**
- Auto-creates vendors as needed
- Respects vendor preferences
- Uses vendor lead times
- Checks vendor settings

**Smart Delivery Dates:**
- Calculates business days
- Skips weekends
- Accounts for processing time
- Uses vendor-specific lead times

**Complete Tracking:**
- Activity logs all actions
- Audit trail for compliance
- Notification system
- Status monitoring

**User-Friendly Interface:**
- Visual dashboard
- One-click creation
- Settings configuration
- Real-time statistics

This automation eliminates manual PO creation, reduces errors, ensures timely ordering, and provides complete visibility into the purchasing process from quote approval to vendor fulfillment.
