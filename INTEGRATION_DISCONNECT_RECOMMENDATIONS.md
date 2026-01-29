# Integration Disconnect Feature - Implementation Recommendations

## Executive Summary

This document outlines recommendations for adding a "Disconnect" feature to each integration in the Account Settings. Based on comprehensive data dependency analysis, integrations are categorized by risk level and appropriate disconnect strategies are proposed.

---

## Integration Risk Categories

### 🟢 LOW RISK - Safe to Disconnect (No Data Loss)

**Integrations:**
- Square
- SanMar
- SSActivewear

**Characteristics:**
- No local data storage
- Proxy/lookup only operations
- Metadata preserved in quotes even after disconnect

**Recommended Action:**
- ✅ **SAFE TO IMPLEMENT** full disconnect with credential removal
- Simple confirmation dialog sufficient
- Can reconnect at any time without data loss

---

### 🟡 MODERATE RISK - Credential Only Removal

**Integrations:**
- Resend (Email)
- Twilio (SMS)

**Characteristics:**
- Communication logs stored locally
- Logs preserved after disconnect
- Future communications disabled

**Recommended Action:**
- ✅ **SAFE TO IMPLEMENT** credential removal
- Keep historical `communication_logs` and `sms_logs` tables intact
- Warning: "Future emails/SMS will be disabled, but history preserved"
- Can reconnect and resume functionality

---

### 🔴 HIGH RISK - Critical Data (NOT RECOMMENDED)

**Integrations:**
- Printavo
- Stripe

**Characteristics:**
- Core business data (invoices, payments)
- Cascade delete relationships
- Complete audit trail loss
- Irreversible damage to business records

**Recommended Action:**
- ❌ **DO NOT IMPLEMENT** full disconnect
- Alternative: "Disable Sync" or "Pause Integration" feature
- Keep credentials and all data intact
- Only allow admin-level account closure (separate process)

---

## Detailed Implementation Plan

### Phase 1: Safe Disconnects (Square, SanMar, SSActivewear)

#### Database Operations Required:
```sql
-- For each integration, remove credentials only
UPDATE company_settings
SET
  square_access_token = NULL,
  square_application_id = NULL,
  square_location_id = NULL,
  square_environment = NULL
WHERE id = $company_id;

UPDATE company_settings
SET
  sanmar_username = NULL,
  sanmar_api_key_encrypted = NULL,
  sanmar_enabled = false
WHERE id = $company_id;

UPDATE company_settings
SET
  ssactivewear_username = NULL,
  ssactivewear_api_key_encrypted = NULL,
  ssactivewear_enabled = false
WHERE id = $company_id;

-- Also clear integration_settings if exists
DELETE FROM integration_settings WHERE company_id = $company_id;
```

#### UI Flow:
1. **Disconnect Button** - Red outline button next to credentials
2. **Confirmation Modal**:
   ```
   Title: "Disconnect [Integration Name]?"
   Message: "This will remove your API credentials. You can reconnect anytime without losing data."
   Buttons: [Cancel] [Disconnect]
   ```
3. **Success Toast**: "Successfully disconnected from [Integration]"
4. **UI State**: Show red dot, hide credentials section, show reconnect prompt

---

### Phase 2: Moderate Risk Disconnects (Resend, Twilio)

#### Database Operations Required:
```sql
-- Remove credentials but preserve logs
UPDATE company_settings
SET
  resend_api_key = NULL,
  email_from_address = NULL
WHERE id = $company_id;

-- communication_logs table remains untouched

UPDATE company_settings
SET
  twilio_account_sid = NULL,
  twilio_auth_token = NULL,
  twilio_phone_number = NULL,
  twilio_enabled = false,
  default_send_method = 'email'
WHERE id = $company_id;

-- sms_logs table remains untouched
```

#### UI Flow:
1. **Disconnect Button** - Red outline button
2. **Warning Modal**:
   ```
   Title: "Disconnect [Resend/Twilio]?"
   Warning Icon
   Message:
   "⚠️ This will disable future email/SMS sending.

   Your communication history will be preserved for audit purposes.

   You will not be able to:
   • Send automated payment reminders
   • Email invoices to customers
   • Trigger workflow notifications

   You can reconnect anytime to resume functionality."

   Checkbox: "I understand that email/SMS will be disabled"
   Buttons: [Cancel] [Disconnect]
   ```
3. **Post-Disconnect Banner**:
   ```
   "📧 Email disabled. Historical logs preserved. Reconnect to resume sending."
   ```

---

### Phase 3: Critical Integrations (Printavo, Stripe) - Alternative Approach

#### ❌ DO NOT OFFER FULL DISCONNECT

Instead, implement:

#### Option A: "Pause Sync" (Printavo)
```sql
-- Add new column for pause functionality
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS printavo_sync_paused boolean DEFAULT false;

-- Pause sync (keeps credentials and data)
UPDATE company_settings
SET printavo_sync_paused = true
WHERE id = $company_id;
```

**UI Flow:**
- Replace "Disconnect" with "Pause Sync" toggle
- Warning: "This will stop automatic invoice syncing but preserve all data and credentials"
- Can resume anytime without data loss

#### Option B: "Disable New Payments" (Stripe)
```sql
-- Add column for disabling new charges
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS stripe_payments_paused boolean DEFAULT false;

-- Pause new payments (keeps credentials and history)
UPDATE company_settings
SET stripe_payments_paused = true
WHERE id = $company_id;
```

**UI Flow:**
- Replace "Disconnect" with "Disable New Payments" toggle
- Warning: "This will prevent new payment requests. Existing payment links remain active. All payment history preserved."
- Webhooks still process for existing transactions

#### Option C: "Account Closure" (Separate Admin Process)
For true data deletion, require:
1. Super Admin role verification
2. Multi-step confirmation process
3. 30-day grace period before irreversible deletion
4. Export all data to CSV/PDF before deletion
5. Email confirmation code verification
6. Manual review by account manager

---

## UI/UX Components Required

### 1. Disconnect Button Component
```tsx
interface DisconnectButtonProps {
  integrationName: string;
  riskLevel: 'low' | 'moderate' | 'high';
  onDisconnect: () => Promise<void>;
  hasCredentials: boolean;
}
```

**Styling:**
- Low Risk: Red outline button, simple design
- Moderate Risk: Red outline with warning icon
- High Risk: Not shown (replaced with Pause toggle)

### 2. Confirmation Modal Component
```tsx
interface DisconnectModalProps {
  integration: Integration;
  riskLevel: 'low' | 'moderate' | 'high';
  warningMessage: string;
  requiresAcknowledgment?: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}
```

**Features:**
- Risk-appropriate messaging
- Optional acknowledgment checkbox
- Loading state during disconnect
- Error handling and retry

### 3. Integration Status Indicator
**Current:**
- 🟢 Green dot = Credentials saved
- 🔴 Red dot = Credentials missing

**Enhanced:**
- 🟢 Green dot = Active
- 🟡 Yellow dot = Paused/Disabled
- 🔴 Red dot = Not connected
- 🔵 Blue dot = Syncing...

---

## Database Migration Required

### New Table: integration_disconnect_log
```sql
CREATE TABLE integration_disconnect_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  integration_name text NOT NULL,
  action text NOT NULL, -- 'disconnect', 'pause', 'resume'
  disconnected_by uuid REFERENCES auth.users(id),
  reason text,
  credentials_removed boolean DEFAULT true,
  data_deleted boolean DEFAULT false,
  can_reconnect boolean DEFAULT true,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_disconnect_log_company ON integration_disconnect_log(company_id);
CREATE INDEX idx_disconnect_log_created ON integration_disconnect_log(created_at DESC);
```

**Purpose:**
- Audit trail for all disconnect actions
- Track who disconnected and when
- Record whether data was deleted
- Support compliance and accountability

---

## Edge Function Required

### New Function: `/functions/disconnect-integration/index.ts`

```typescript
interface DisconnectRequest {
  integration: 'square' | 'sanmar' | 'ssactivewear' | 'resend' | 'twilio';
  reason?: string;
}

// Validates permissions, removes credentials, logs action
```

**Features:**
- RBAC enforcement (admin/super_admin only)
- Credential removal
- Audit log creation
- Notification to affected users
- Success/error responses

---

## Implementation Priority

### ✅ Phase 1 (Immediate - Low Risk)
1. Square disconnect
2. SanMar disconnect
3. SSActivewear disconnect
4. Basic disconnect modal
5. Audit logging

### ⏳ Phase 2 (2-3 weeks - Moderate Risk)
1. Resend disconnect with preserved logs
2. Twilio disconnect with preserved logs
3. Enhanced warning modals
4. Reconnect flows

### ⚠️ Phase 3 (Future - Critical)
1. Printavo "Pause Sync" feature
2. Stripe "Disable New Payments" feature
3. Admin account closure workflow
4. 30-day grace period system
5. Data export before deletion

---

## Security Considerations

### 1. Role-Based Access Control
```typescript
// Only allow disconnect for specific roles
const canDisconnect = ['admin', 'super_admin'].includes(userRole);
```

### 2. Confirmation Requirements
- Low Risk: Single confirmation
- Moderate Risk: Acknowledgment checkbox
- High Risk: Multi-factor confirmation (not implemented)

### 3. Audit Logging
- Log every disconnect attempt (success/failure)
- Record user ID, timestamp, reason
- Store in `integration_disconnect_log` table

### 4. Rate Limiting
- Prevent rapid connect/disconnect abuse
- Max 5 disconnect actions per integration per day

---

## User Communication Strategy

### In-App Notifications

**Post-Disconnect:**
- Success toast notification
- Integration status indicator update (red dot)
- Help text: "Reconnect anytime by entering credentials"

**For Paused Integrations:**
- Warning banner in relevant sections
- "Printavo Sync Paused - Resume to get latest invoices"
- "Stripe Payments Disabled - Enable to accept new payments"

### Email Notifications (Optional)

Send email to all company admins when:
- Critical integration disconnected (Printavo/Stripe paused)
- Include: Who disconnected, when, and how to reconnect
- Warning about functionality limitations

---

## Reconnection Flow

### Simple Reconnect (Low/Moderate Risk)
1. User enters new credentials
2. System validates via test API call
3. Credentials saved (encrypted)
4. Status updated to active (green dot)
5. Success notification

### Gradual Reconnect (High Risk)
1. User enables sync/payments
2. Initial sync runs in background
3. Progress indicator shown
4. Completion notification
5. Full functionality restored

---

## Testing Requirements

### Unit Tests
- Credential removal functions
- Permission checks
- Audit log creation

### Integration Tests
- End-to-end disconnect flow
- Reconnect flow
- Data preservation verification

### Manual Testing Checklist
- [ ] Low risk disconnect (Square)
- [ ] Moderate risk disconnect (Resend)
- [ ] Reconnect after disconnect
- [ ] Permissions enforcement
- [ ] Audit logs created
- [ ] UI state updates correctly
- [ ] No data loss for moderate risk
- [ ] Warning modals display correctly

---

## Estimated Development Time

| Phase | Component | Time Estimate |
|-------|-----------|---------------|
| Phase 1 | Database migration + audit log | 2 hours |
| Phase 1 | Edge function (disconnect-integration) | 3 hours |
| Phase 1 | UI components (button, modal) | 4 hours |
| Phase 1 | Square/SanMar/SSActivewear integration | 3 hours |
| Phase 1 | Testing + bug fixes | 2 hours |
| **Phase 1 Total** | | **14 hours** |
| Phase 2 | Resend/Twilio disconnect logic | 3 hours |
| Phase 2 | Enhanced warning modals | 2 hours |
| Phase 2 | Communication log preservation | 2 hours |
| Phase 2 | Reconnect flows | 3 hours |
| Phase 2 | Testing | 2 hours |
| **Phase 2 Total** | | **12 hours** |
| Phase 3 | Pause sync/payments features | 6 hours |
| Phase 3 | Account closure workflow | 8 hours |
| Phase 3 | Grace period system | 4 hours |
| Phase 3 | Data export | 4 hours |
| **Phase 3 Total** | | **22 hours** |
| **Grand Total** | | **48 hours (6 days)** |

---

## Recommended Implementation Strategy

### ✅ START WITH: Phase 1 Only

**Why:**
1. **Provides Immediate Value**: Users can disconnect non-critical integrations
2. **Low Risk**: No data loss scenarios
3. **Proof of Concept**: Test UI/UX patterns before tackling complex cases
4. **Fast to Ship**: 14 hours of work, can be done in 2 days

**What Users Get:**
- Disconnect Square (retail POS data)
- Disconnect SanMar (garment supplier)
- Disconnect SSActivewear (garment supplier)
- Clean UI with proper warnings
- Audit trail for compliance

### ⏸️ DEFER: Phase 2 & 3

**Why:**
- Phase 2 requires careful handling of communication logs
- Phase 3 requires extensive business process design
- Can gather user feedback from Phase 1 first
- Allows time to design proper "pause" vs "disconnect" UX

---

## Alternative: "Disable" Instead of "Disconnect"

### Simplified Approach
Instead of removing credentials, add a global "enabled" flag:

```sql
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS
  square_integration_enabled boolean DEFAULT true,
  resend_integration_enabled boolean DEFAULT true,
  twilio_integration_enabled boolean DEFAULT true,
  sanmar_integration_enabled boolean DEFAULT true,
  ssactivewear_integration_enabled boolean DEFAULT true;
```

**Advantages:**
- No credential removal
- Instant enable/re-enable
- No data loss risk
- Simpler UI (toggle switch instead of disconnect button)

**Disadvantages:**
- Credentials remain in database (potential security concern)
- Users may want true credential removal for compliance
- Doesn't address "I want to change providers" use case

---

## Final Recommendation

### ✅ IMPLEMENT PHASE 1 WITH HYBRID APPROACH

1. **For Low Risk Integrations (Square, SanMar, SSActivewear):**
   - Implement full disconnect with credential removal
   - Simple confirmation modal
   - Can reconnect anytime

2. **For All Other Integrations:**
   - Show "Disable" toggle instead of "Disconnect"
   - Keep credentials but disable functionality
   - Much safer and faster to implement

3. **UI Changes:**
   - Add "Disconnect" button to Square/SanMar/SSActivewear sections
   - Add "Enable/Disable" toggle to Resend/Twilio/Stripe/Printavo sections
   - Update status dots to show disabled state (yellow)

4. **Defer Account Closure:**
   - Create separate "Close Account" feature in settings
   - Requires super admin
   - Handles Printavo/Stripe data deletion properly
   - Not part of integration disconnect flow

### Estimated Time for Hybrid Approach: 8-10 hours

This provides 80% of user value with 20% of the complexity.

---

## Questions for Product Decision

Before implementing, clarify:

1. **User Intent**: Why do users want to disconnect?
   - Switching providers? → Full credential removal needed
   - Temporary disable? → Enable/disable toggle sufficient
   - Security compliance? → Full credential removal needed

2. **Reconnection Frequency**: How often do users disconnect and reconnect?
   - Rarely → Full disconnect acceptable
   - Frequently → Disable toggle better UX

3. **Compliance Requirements**: Any regulations requiring credential removal?
   - Yes → Implement full disconnect with audit trail
   - No → Enable/disable toggle acceptable

4. **Support Burden**: How much support can handle?
   - Low → Simple disconnect with clear warnings
   - High → Implement robust undo/recovery features

---

**Last Updated:** January 29, 2026
**Author:** InkOps Development Team
**Status:** Recommendations - Pending Approval
