# Purchase Order Settings Integration Guide

## Overview

The Purchase Order Settings system provides centralized control over PO behavior, numbering, approval workflows, and communication preferences. All PO operations now respect global settings configured in **Account Settings → Manage Goods → PO Settings**.

---

## Components Created

### 1. **PO Settings Service** (`/src/services/po-settings-service.ts`)

Central service for fetching and applying PO settings with caching for performance.

#### Key Methods:

- `getPOSettings()` - Fetches all PO settings with 5-minute cache
- `generatePONumber()` - Generates formatted PO numbers based on custom format
- `canSendPO()` - Validates if a PO can be sent
- `canEditPO()` - Validates if a PO can be edited
- `canDeletePO()` - Validates if a PO can be deleted
- `canReceiveGoods()` - Validates if goods can be received
- `getDefaultVendorId()` - Returns default vendor
- `getDefaultNotes()` - Returns default PO notes
- `getDefaultFooter()` - Returns default PDF footer
- `getEmailSettings()` - Returns email template and CC preferences

### 2. **PO Validation Modal** (`/src/components/purchase-orders/POValidationModal.tsx`)

Reusable modal for displaying validation errors and collecting justifications.

**Features:**
- Display blocking messages
- Collect edit justifications
- Clean, user-friendly UI
- Dark mode support

### 3. **Database Functions**

#### `generate_formatted_po_number(format_string, starting_seq)`

Generates PO numbers with token replacement:
- `{PO}` → "PO" prefix
- `{YYYY}` → 4-digit year (e.g., 2026)
- `{MM}` → 2-digit month (e.g., 02)
- `{DD}` → 2-digit day (e.g., 06)
- `{SEQ}` → Sequential 5-digit number (e.g., 01234)

**Example:** `PO-{YYYY}-{SEQ}` → `PO-2026-01234`

---

## Integration Points

### ✅ **INTEGRATION POINT 1: PO Creation**

**Component:** `/src/components/purchase-orders/CreatePurchaseOrder.tsx`

**Applied Settings:**
- ✅ `po_number_format` - Custom PO number format with tokens
- ✅ `po_starting_sequence` - Starting sequence number
- ✅ `po_default_vendor_id` - Pre-selected vendor from Garment Supplier tab
- ✅ `po_default_notes` - Pre-filled notes to vendor
- ✅ `po_require_approval_before_sending` - Blocks sending if approval required
- ✅ `po_require_pdf_before_sending` - Blocks sending without PDF

**Workflow:**
1. Component loads → Fetches default vendor & notes
2. Generates PO number using custom format
3. Pre-fills vendor dropdown and notes textarea
4. When sending → Validates approval & PDF requirements
5. Shows validation modal if requirements not met

**Code Example:**
```typescript
// Load defaults on mount
const loadPODefaults = async () => {
  const defaultVendorId = await POSettingsService.getDefaultVendorId();
  const defaultNotes = await POSettingsService.getDefaultNotes();
  if (defaultVendorId) setSelectedVendor(defaultVendorId);
  if (defaultNotes) setNotesToVendor(defaultNotes);
};

// Generate custom PO number
const generatePONumber = async () => {
  const number = await POSettingsService.generatePONumber();
  setPoNumber(number);
};

// Validate before sending
if (status === 'sent') {
  const validation = await POSettingsService.canSendPO({
    status: 'draft',
    approved_by: null,
    has_pdf: attachments.some((f) => f.type === 'application/pdf'),
  });
  if (!validation.allowed) {
    // Show validation modal
    return;
  }
}
```

---

### ✅ **INTEGRATION POINT 2: PO Editing**

**Component:** `/src/components/purchase-orders/PurchaseOrderDetail.tsx`

**Applied Settings:**
- ✅ `po_allow_editing_after_sending` - Blocks editing if disabled
- ✅ `po_require_reason_for_edits` - Requires justification modal

**Workflow:**
1. User clicks Edit button
2. System validates `canEditPO()`
3. If editing blocked → Show error modal
4. If justification required → Show justification modal
5. Log justification to activity log
6. Enable edit mode

**Code Example:**
```typescript
const handleEditClick = async () => {
  const validation = await POSettingsService.canEditPO({
    status: po.status,
    sent_at: po.sent_at,
  });

  if (!validation.allowed) {
    setValidationModal({
      isOpen: true,
      title: 'Cannot Edit PO',
      message: validation.reason || 'This PO cannot be edited.',
    });
    return;
  }

  if (validation.requiresJustification) {
    setValidationModal({
      isOpen: true,
      title: 'Edit Justification Required',
      message: 'Please provide a justification for editing this PO.',
      requiresJustification: true,
      onConfirm: async (justification) => {
        // Log to activity log
        await supabase.from('purchase_order_activity_log').insert([{
          po_id: poId,
          action: 'po_edited_after_sending',
          notes: justification,
        }]);
        setIsEditing(true);
      },
    });
  } else {
    setIsEditing(true);
  }
};
```

---

### ✅ **INTEGRATION POINT 3: PO Sending**

**Component:** `/src/components/purchase-orders/PurchaseOrderDetail.tsx`

**Applied Settings:**
- ✅ `po_require_approval_before_sending` - Blocks sending without approval
- ✅ `po_require_pdf_before_sending` - Blocks sending without PDF
- ✅ `po_auto_attach_pdf` - Auto-attaches PDF to email
- ✅ `po_default_email_template_id` - Uses default email template
- ✅ `po_cc_accounting` - CCs accounting team
- ✅ `po_cc_sales_rep` - CCs sales representative

**Workflow:**
1. User clicks "Send PO"
2. System validates approval status
3. System validates PDF attachment
4. If validation fails → Show error modal
5. If validation passes → Prepare email with settings
6. Auto-attach PDF if enabled
7. Add CC recipients based on settings
8. Mark PO as sent with timestamp

**Code Example:**
```typescript
const updateStatus = async (newStatus: string) => {
  if (newStatus === 'sent') {
    const hasPdf = attachments.some((a) => a.file_type === 'application/pdf');
    const validation = await POSettingsService.canSendPO({
      status: po.status,
      approved_by: po.approved_by,
      has_pdf: hasPdf,
    });

    if (!validation.allowed) {
      setValidationModal({
        isOpen: true,
        title: 'Cannot Send PO',
        message: validation.reason,
      });
      return;
    }
  }
  // Continue with status update
};
```

---

### ✅ **INTEGRATION POINT 4: Receiving Workflow**

**Components:**
- `/src/components/purchase-orders/PurchaseOrderDetail.tsx`
- `/src/components/purchase-orders/ReceiveGoods.tsx`

**Applied Settings:**
- ✅ `po_vendor_confirmation_required` - Blocks receiving without vendor confirmation

**Workflow:**
1. User attempts to receive goods
2. System checks if vendor confirmation required
3. If required and not confirmed → Show error modal
4. If confirmed or not required → Allow receiving
5. Display validation error prominently in UI

**Code Example:**
```typescript
const handleReceiveGoods = async () => {
  const validation = await POSettingsService.canReceiveGoods({
    status: po.status,
    confirmed_at: po.confirmed_at,
  });

  if (!validation.allowed) {
    setValidationModal({
      isOpen: true,
      title: 'Cannot Receive Goods',
      message: validation.reason,
    });
    return;
  }
  // Continue with receiving process
};
```

**ReceiveGoods Component:**
```typescript
// Load and validate on mount
const loadPOData = async () => {
  const poData = await fetchPO();

  const validation = await POSettingsService.canReceiveGoods({
    status: poData.status,
    confirmed_at: poData.confirmed_at,
  });

  if (!validation.allowed) {
    setValidationError(validation.reason);
  }
};

// Display validation error
{validationError && (
  <div className="bg-red-50 p-6">
    <AlertCircle /> Cannot Receive Goods
    <p>{validationError}</p>
  </div>
)}
```

---

### ✅ **INTEGRATION POINT 5: PO PDF Generation**

**Applied Settings:**
- ✅ `po_default_footer` - Appears at bottom of PDF
- ✅ `po_default_notes` - Pre-filled in notes section

**Implementation Notes:**

When generating PO PDFs, retrieve and inject:

```typescript
const generatePOPDF = async () => {
  const footer = await POSettingsService.getDefaultFooter();
  const notes = await POSettingsService.getDefaultNotes();

  // Generate PDF with footer and notes
  pdf.addFooter(footer);
  pdf.addNotes(notes);
};
```

---

## Database Schema

### Company Settings Table (Extended)

```sql
ALTER TABLE company_settings ADD COLUMN:
  -- Numbering
  po_number_format text DEFAULT 'PO-{YYYY}-{SEQ}'
  po_starting_sequence integer DEFAULT 1000
  po_default_vendor_id uuid REFERENCES vendors(id)
  po_default_notes text

  -- Approval Rules
  po_require_approval_before_sending boolean DEFAULT false
  po_allow_editing_after_sending boolean DEFAULT true
  po_require_reason_for_edits boolean DEFAULT false

  -- Email & Communication
  po_default_email_template_id uuid REFERENCES communication_templates(id)
  po_auto_attach_pdf boolean DEFAULT true
  po_cc_accounting boolean DEFAULT false
  po_cc_sales_rep boolean DEFAULT false
  po_vendor_confirmation_required boolean DEFAULT false

  -- Attachments
  po_require_pdf_before_sending boolean DEFAULT false
  po_allow_additional_attachments boolean DEFAULT true
  po_default_footer text

  -- Advanced
  po_auto_group_by_vendor boolean DEFAULT false
  po_auto_split_by_vendor boolean DEFAULT false
  po_allow_without_linked_jobs boolean DEFAULT true
  po_allow_deleting_drafts boolean DEFAULT true
```

---

## Configuration Examples

### Example 1: Strict PO Control
```typescript
{
  po_number_format: "PO-{YYYY}-{MM}-{SEQ}",
  po_starting_sequence: 10000,
  po_require_approval_before_sending: true,
  po_allow_editing_after_sending: false,
  po_require_pdf_before_sending: true,
  po_vendor_confirmation_required: true
}
```
**Result:** POs require approval, cannot be edited after sending, require PDF, and vendor must confirm before receiving.

### Example 2: Flexible PO Workflow
```typescript
{
  po_number_format: "PO-{SEQ}",
  po_starting_sequence: 1,
  po_require_approval_before_sending: false,
  po_allow_editing_after_sending: true,
  po_require_reason_for_edits: true,
  po_vendor_confirmation_required: false
}
```
**Result:** Simple numbering, no approval required, editing allowed with justification, receiving without confirmation.

### Example 3: Automated Workflow
```typescript
{
  po_number_format: "PO-{YYYY}-{SEQ}",
  po_auto_attach_pdf: true,
  po_cc_accounting: true,
  po_cc_sales_rep: true,
  po_auto_group_by_vendor: true,
  po_default_vendor_id: "vendor-uuid-123"
}
```
**Result:** Automated email with PDF, CCs accounting and sales, groups items by vendor, pre-selects default vendor.

---

## Validation Messages

### User-Facing Error Messages

| Setting | Condition | Message |
|---------|-----------|---------|
| `po_require_approval_before_sending` | No approval | "This PO requires approval before it can be sent. Please have a manager approve it first." |
| `po_require_pdf_before_sending` | No PDF attached | "A PDF must be generated and attached before sending this PO." |
| `po_allow_editing_after_sending` | PO already sent | "This PO cannot be edited after it has been sent." |
| `po_vendor_confirmation_required` | Not confirmed | "Vendor confirmation is required before goods can be received. Please mark the PO as 'Vendor Confirmed' first." |
| `po_allow_deleting_drafts` | Non-draft PO | "Only draft POs can be deleted." |

---

## Testing Checklist

### PO Creation
- [ ] Default vendor is pre-selected if configured
- [ ] Default notes are pre-filled
- [ ] PO number follows custom format
- [ ] Sending blocked if approval required and not approved
- [ ] Sending blocked if PDF required and not attached
- [ ] Validation modal displays correct message

### PO Editing
- [ ] Editing blocked when `po_allow_editing_after_sending` is false
- [ ] Justification modal appears when `po_require_reason_for_edits` is true
- [ ] Justification is logged to activity log
- [ ] Edit mode enabled after validation

### PO Sending
- [ ] Approval validation works
- [ ] PDF validation works
- [ ] Email template is used if configured
- [ ] PDF auto-attaches if enabled
- [ ] Accounting is CC'd if enabled
- [ ] Sales rep is CC'd if enabled

### Receiving Workflow
- [ ] Receiving blocked when vendor confirmation required but not confirmed
- [ ] Error message displays prominently
- [ ] Receiving allowed after confirmation
- [ ] Validation error prevents saving

### PO Numbering
- [ ] Sequential numbers increment correctly
- [ ] Tokens are replaced properly
- [ ] Format respects custom template
- [ ] Starting sequence is respected

---

## Performance Considerations

### Caching
- Settings are cached for 5 minutes to reduce database queries
- Cache is cleared when settings are updated
- Each validation check uses cached settings

### Optimization Tips
1. Settings are fetched once per component mount
2. Validation functions return early on success
3. Database queries include only necessary fields
4. Function results are cached in component state

---

## Future Enhancements

### Potential Additions
1. **Approval Workflows** - Multi-level approval chains based on PO amount
2. **Notification Rules** - Auto-notify stakeholders on status changes
3. **Budget Controls** - Block POs exceeding budget thresholds
4. **Vendor-Specific Rules** - Override global settings per vendor
5. **Custom Validation Rules** - User-defined validation logic
6. **PO Templates** - Reusable PO configurations
7. **Auto-Split Logic** - Automatic vendor-based PO splitting

---

## Troubleshooting

### Common Issues

**Issue:** PO numbers not generating
- **Check:** Database function exists and has correct permissions
- **Fix:** Rerun migration `create_po_number_generation_function`

**Issue:** Settings not applying
- **Check:** User's company_id is set correctly
- **Fix:** Verify `user_profiles.company_id` is populated

**Issue:** Validation modal not appearing
- **Check:** Modal state is managed correctly
- **Fix:** Ensure `POValidationModal` component is included in JSX

**Issue:** Default vendor not loading
- **Check:** Vendor exists and is active
- **Fix:** Verify `vendors.is_active = true` and ID matches

---

## Support

For issues or questions:
1. Check validation messages for specific guidance
2. Review activity logs for audit trail
3. Verify settings in Account Settings → Manage Goods → PO Settings
4. Check browser console for error messages

---

**Last Updated:** 2026-02-06
**Version:** 1.0.0
