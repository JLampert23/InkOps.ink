# Receiving Settings Implementation Guide

## Overview
The Receiving Settings module provides comprehensive configuration for the Manage Goods system, controlling receiving behavior, variance handling, job readiness rules, scanning operations, logs, vendor management, and notifications.

## Database Schema

### Table: `receiving_settings`
Located at: `supabase/migrations/20260206123214_create_receiving_settings_table.sql`

**Key Fields:**

#### 1. Receiving Behavior
- `allow_partial_receiving` (BOOLEAN, default: true) - Allow receiving partial quantities
- `allow_over_receiving` (BOOLEAN, default: false) - Allow receiving more than ordered
- `require_vendor_confirmation` (BOOLEAN, default: false) - Require vendor confirmation before receiving
- `auto_close_po` (BOOLEAN, default: true) - Auto-close PO when fully received

#### 2. Job Readiness Rules
- `auto_mark_job_ready` (BOOLEAN, default: true) - Automatically mark jobs ready when garments received
- `require_manual_job_ready_review` (BOOLEAN, default: false) - Require manual approval for job readiness
- `notify_production_when_ready` (BOOLEAN, default: true) - Notify production team when job ready

#### 3. Variance Handling
- `require_shortage_reason` (BOOLEAN, default: true) - Require reason for shortages
- `require_damage_reason` (BOOLEAN, default: true) - Require reason for damaged items
- `variance_flag_threshold` (NUMERIC, default: 5.0) - Percentage threshold for flagging variances
- `variance_approval_required` (BOOLEAN, default: false) - Require manager approval for variances

#### 4. Barcode/Scanning Settings
- `enable_barcode_scanning` (BOOLEAN, default: false) - Enable barcode scanning functionality
- `scan_mode` (TEXT, default: 'increment') - Options: 'increment', 'replace', 'prompt'
- `allow_non_po_scanning` (BOOLEAN, default: false) - Allow scanning items not on PO

#### 5. Receiving Log Settings
- `track_receiving_user` (BOOLEAN, default: true) - Track which user performed receiving
- `track_receiving_timestamp` (BOOLEAN, default: true) - Track exact timestamp of receiving
- `require_receiving_notes` (BOOLEAN, default: false) - Require notes on every receiving session
- `auto_generate_receiving_pdf` (BOOLEAN, default: false) - Auto-generate PDF reports

#### 6. Vendor Settings
- `default_vendor_lead_times` (JSONB, default: {}) - Per-vendor lead times in days
- `default_vendor_backorder_rules` (JSONB, default: {}) - Per-vendor backorder handling rules
- `vendor_delay_alerts` (BOOLEAN, default: true) - Enable vendor delay notifications

#### 7. Notifications
- `notify_accounting` (BOOLEAN, default: false) - Notify accounting on goods receipt
- `notify_production_on_arrival` (BOOLEAN, default: true) - Notify production on item arrival
- `notify_sales_rep_job_ready` (BOOLEAN, default: false) - Notify sales rep when job ready
- `daily_receiving_summary` (BOOLEAN, default: false) - Send daily receiving summary email

### Security (RLS Policies)
- **SELECT**: All authenticated users can view settings for their company
- **INSERT**: Only admin/super_admin roles can create settings
- **UPDATE**: Only admin/super_admin roles can modify settings

### Constraints
- **Unique**: One settings record per company (company_id unique constraint)
- **Foreign Key**: company_id references companies(id) with CASCADE delete

## UI Component

### Location
`src/components/settings/ReceivingSettings.tsx`

### Access Path
Account Settings → Production Settings → Receiving Settings

### Features
- **7 organized sections** with color-coded icons
- **Toggle switches** for all boolean settings
- **Dropdown selectors** for scan mode
- **Number input** for variance threshold
- **Real-time save** with success/error notifications
- **Responsive design** with comprehensive dark mode support
- **Auto-loading** of existing settings
- **Validation** before save
- **Dark mode styling** throughout all components, inputs, and sections

### UI Sections
1. **Receiving Behavior** (Package icon, blue)
2. **Job Readiness Rules** (Clipboard icon, green)
3. **Variance Handling** (AlertCircle icon, amber)
4. **Barcode/Scanning Settings** (ScanBarcode icon, purple)
5. **Receiving Log Settings** (FileText icon, teal)
6. **Vendor Settings** (Truck icon, orange)
7. **Notifications** (Bell icon, red)

## Service Layer

### Location
`src/services/receiving-settings-service.ts`

### Class: `ReceivingSettingsService`

#### CRUD Operations
```typescript
// Get settings for a company
getSettingsForCompany(companyId: string): Promise<ReceivingSettings | null>

// Create new settings
createSettings(settings: ReceivingSettings): Promise<ReceivingSettings>

// Update existing settings
updateSettings(id: string, settings: Partial<ReceivingSettings>): Promise<ReceivingSettings>

// Upsert (create or update)
upsertSettings(settings: ReceivingSettings): Promise<ReceivingSettings>
```

#### Helper Methods
```typescript
// Receiving Behavior
shouldAllowPartialReceiving(settings): boolean
shouldAllowOverReceiving(settings): boolean
shouldRequireVendorConfirmation(settings): boolean
shouldAutoClosePO(settings): boolean

// Job Readiness
shouldAutoMarkJobReady(settings): boolean
shouldRequireManualJobReadyReview(settings): boolean
shouldNotifyProductionWhenReady(settings): boolean

// Variance Handling
shouldRequireShortageReason(settings): boolean
shouldRequireDamageReason(settings): boolean
getVarianceThreshold(settings): number
shouldRequireVarianceApproval(settings): boolean
isVarianceAboveThreshold(orderedQty, receivedQty, settings): boolean

// Barcode/Scanning
isBarcodeScanningEnabled(settings): boolean
getScanMode(settings): 'increment' | 'replace' | 'prompt'
shouldAllowNonPOScanning(settings): boolean

// Receiving Logs
shouldTrackReceivingUser(settings): boolean
shouldTrackReceivingTimestamp(settings): boolean
shouldRequireReceivingNotes(settings): boolean
shouldAutoGenerateReceivingPDF(settings): boolean

// Vendor Settings
getVendorLeadTime(vendorName, settings): number | null
getVendorBackorderRule(vendorName, settings): string | null
shouldSendVendorDelayAlerts(settings): boolean

// Notifications
shouldNotifyAccounting(settings): boolean
shouldNotifyProductionOnArrival(settings): boolean
shouldNotifySalesRepJobReady(settings): boolean
shouldSendDailyReceivingSummary(settings): boolean
```

## Integration with Manage Goods Module

### Usage Example
```typescript
import { receivingSettingsService } from '../services/receiving-settings-service';

// Load settings for current company
const settings = await receivingSettingsService.getSettingsForCompany(companyId);

// Check if partial receiving is allowed
if (receivingSettingsService.shouldAllowPartialReceiving(settings)) {
  // Allow user to receive partial quantities
}

// Check variance threshold
if (receivingSettingsService.isVarianceAboveThreshold(100, 95, settings)) {
  // Flag this receiving session for review
  if (receivingSettingsService.shouldRequireVarianceApproval(settings)) {
    // Require manager approval
  }
}

// Check if shortage reason is required
if (receivedQty < orderedQty && receivingSettingsService.shouldRequireShortageReason(settings)) {
  // Show reason input field
}

// After receiving is complete
if (receivingSettingsService.shouldNotifyProductionOnArrival(settings)) {
  // Send notification to production team
}

if (receivingSettingsService.shouldAutoGenerateReceivingPDF(settings)) {
  // Generate PDF report
}
```

## Workflow Integration Points

### 1. Purchase Order Creation
- Check `require_vendor_confirmation` before allowing receiving

### 2. Receiving Process
- Validate against `allow_partial_receiving` and `allow_over_receiving`
- Enforce `require_shortage_reason` and `require_damage_reason`
- Calculate variance and check against `variance_flag_threshold`
- Track user and timestamp based on `track_receiving_user` and `track_receiving_timestamp`

### 3. Job Status Updates
- Use `auto_mark_job_ready` to automatically update job status
- Check `require_manual_job_ready_review` before final approval
- Send notifications based on `notify_production_when_ready`

### 4. PO Completion
- Auto-close PO if `auto_close_po` is enabled and all items received

### 5. Barcode Scanning
- Enable/disable scanning based on `enable_barcode_scanning`
- Apply scan mode logic: increment, replace, or prompt
- Check `allow_non_po_scanning` for off-PO items

### 6. Notifications
- Send accounting notification if `notify_accounting` enabled
- Send production notification if `notify_production_on_arrival` enabled
- Send sales notification if `notify_sales_rep_job_ready` enabled
- Schedule daily summary if `daily_receiving_summary` enabled

## Migration History
1. `20260206123214_create_receiving_settings_table.sql` - Initial table creation
2. `20260206_update_receiving_settings_schema_alignment.sql` - Schema alignment with spec

## Testing Checklist

### Database
- [ ] Settings can be created for a company
- [ ] Settings can be retrieved by company_id
- [ ] Settings can be updated
- [ ] RLS policies prevent unauthorized access
- [ ] Unique constraint prevents duplicate settings per company

### UI
- [ ] Settings load correctly on page load
- [ ] All toggle switches work
- [ ] Number input validates properly
- [ ] Dropdown selections save correctly
- [ ] Save button updates settings
- [ ] Success/error messages display
- [ ] Dark mode styling works

### Service Layer
- [ ] All CRUD operations work
- [ ] Helper methods return correct values
- [ ] Variance calculation is accurate
- [ ] Vendor settings lookup works

### Integration
- [ ] Settings control receiving behavior
- [ ] Job readiness rules apply correctly
- [ ] Variance handling enforces thresholds
- [ ] Notifications trigger appropriately

## Future Enhancements
1. **Vendor Management UI**: Add interface to configure per-vendor lead times and backorder rules
2. **Barcode Scanner Integration**: Connect physical barcode scanners
3. **Receiving Templates**: Create templates for common receiving scenarios
4. **Advanced Analytics**: Track receiving performance metrics
5. **Mobile App**: Create mobile receiving interface
6. **Multi-location**: Support different settings per warehouse location
7. **Approval Workflows**: Build variance approval workflow system
8. **Email Templates**: Customize notification email templates
9. **Audit Trail**: Detailed logging of settings changes
10. **Receiving Dashboard**: Real-time receiving status visualization

## Related Documentation
- [Manage Goods Module](./MANAGE_GOODS_MODULE.md)
- [Purchase Orders](./PURCHASE_ORDERS_GUIDE.md)
- [Receiving Dashboard](./RECEIVING_DASHBOARD.md)
- [Production Settings](./PRODUCTION_SETTINGS.md)
