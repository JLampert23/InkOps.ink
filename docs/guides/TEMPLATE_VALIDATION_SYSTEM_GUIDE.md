# Template Validation System Guide

## Overview

The template validation system ensures that email templates contain required short codes before being saved, activated, or used to send emails. This prevents critical information from being omitted in customer communications.

## Required Short Codes by Template Type

### Quote Email Templates (`quote_email_default`, `approval_email`)
```typescript
Required Codes:
- {{quote_link}} - Required for customers to access and approve their quote
- {{quote_number}} - Required for quote identification and tracking
- {{customer_first_name}} - Required for personalized communication
```

### Invoice Email Templates (`invoice_email_default`, `invoice_reminder`)
```typescript
Required Codes:
- {{invoice_link}} - Required for customers to view and pay their invoice online
- {{invoice_number}} - Required for invoice identification and payment reference

Additional for invoice_reminder:
- {{invoice_balance}} - Required to show the amount due
```

### Payment Confirmation Templates (`payment_confirmation`)
```typescript
Required Codes:
- {{payment_amount}} - Required to show the amount paid
- {{invoice_number}} - Required for payment reference
```

### AR Report Templates (`ar_report`)
```typescript
Required Codes:
- {{current_date}} - Required for report identification
```

### Other Templates
- `internal_notification` - No required codes
- `custom` - No required codes

## Validation Levels

### 1. Syntax Validation (Always Enforced)
- Empty templates not allowed
- Malformed short codes (`{{code`) rejected
- Nested short codes (`{{{{code}}}}`) rejected

### 2. Required Code Validation (Template Type Specific)
- Missing required codes generate warnings
- Active templates cannot be saved without required codes (unless override)
- Inactive templates can be saved for later completion

### 3. Best Practice Validation (Warnings Only)
- Subject lines over 100 characters
- Templates with no short codes at all

## Validation Flow

### Frontend Validation

```typescript
import { CommunicationTemplateService } from './services/communication-template-service';
import { getRequiredShortCodes } from './types/communication-template';

// Validate template before saving
const validation = CommunicationTemplateService.validateTemplate(
  subjectTemplate,
  bodyTemplate,
  templateType
);

// Check results
if (!validation.isValid) {
  // Has syntax errors - cannot save
  console.error('Errors:', validation.errors);
}

if (validation.hasRequiredCodeViolations) {
  // Missing required codes - show warning modal
  console.warn('Missing required codes:', validation.missingRequiredCodes);
}

// For sending emails
const { canSend, validation } = CommunicationTemplateService.validateTemplateForSending(
  template,
  allowOverride
);

if (!canSend) {
  // Cannot send - show warning
}
```

### Backend Validation

```typescript
// Automatic validation in edge function
POST /communication-templates
{
  "template_type": "quote_email_default",
  "subject_template": "Quote {{quote_number}}",
  "body_template": "<p>Hi there...</p>",
  "is_active": true
}

// Response if missing required codes:
{
  "error": "Template is missing required short codes and cannot be activated",
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": ["Missing required short code: {{quote_link}}..."],
    "missingRequiredCodes": [
      {
        "code": "quote_link",
        "reason": "Required for customers to access and approve their quote"
      },
      {
        "code": "customer_first_name",
        "reason": "Required for personalized communication"
      }
    ],
    "hasRequiredCodeViolations": true
  },
  "message": "Add the required short codes or save as inactive template"
}
```

## UI Components

### 1. Missing Short Codes Warning Modal

**Component:** `MissingShortCodesWarningModal`

**Usage:**
```typescript
import { MissingShortCodesWarningModal } from './components/email/MissingShortCodesWarningModal';

<MissingShortCodesWarningModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  validation={validation}
  onFixTemplate={() => {
    setShowModal(false);
    // Keep user in editor
  }}
  onSaveAnyway={() => {
    // Admin override - save despite missing codes
    saveTemplate({ override_required_validation: true });
  }}
  canOverride={isAdmin}
  actionType="save" // or "send"
/>
```

**Features:**
- Shows missing required codes with explanations
- "Fix Template" button returns to editor
- "Save Anyway" button (admin only) for override
- Cannot override syntax errors
- Clear visual hierarchy (errors vs warnings)

### 2. Template Validation Feedback

**Component:** `TemplateValidationFeedback`

**Usage:**
```typescript
import { TemplateValidationFeedback } from './components/email/TemplateValidationFeedback';

<TemplateValidationFeedback
  validation={validation}
  show={true}
/>
```

**Features:**
- Inline validation feedback below editor
- Color-coded status (red=error, orange=missing required, yellow=warning, green=valid)
- Real-time validation as user types
- Detailed explanation of each issue

### 3. Required Short Code Tooltip

**Component:** `RequiredShortCodeTooltip`

**Usage:**
```typescript
import { RequiredShortCodeTooltip } from './components/email/TemplateValidationFeedback';

<RequiredShortCodeTooltip
  code="quote_link"
  reason="Required for customers to access and approve their quote"
>
  <button>{{quote_link}}</button>
</RequiredShortCodeTooltip>
```

**Features:**
- Hover tooltip explaining why code is required
- Visual indicator (warning icon)
- Context-sensitive help

## Admin Override System

### When Override is Allowed

1. **User Role:** Admin or Super Admin only
2. **Validation State:** Syntax must be valid (no errors)
3. **Use Case:** Missing required codes only

### How to Override

**Frontend:**
```typescript
// Save with override flag
await CommunicationTemplateService.createTemplate({
  template_type: 'quote_email_default',
  template_name: 'Incomplete Quote Email',
  subject_template: 'Quote {{quote_number}}',
  body_template: '<p>...</p>',
  is_active: false, // Can save as inactive without override
  // OR
  override_required_validation: true // Admin override for active
});
```

**Backend:**
```typescript
// Send override_required_validation flag
POST /communication-templates
{
  ...template,
  "override_required_validation": true
}
```

### Override Logging

All overrides are logged to `template_validation_logs` table:

```sql
SELECT
  template_name,
  action,
  missing_codes,
  user_id,
  user_role,
  created_at
FROM template_validation_logs
WHERE override_used = true
ORDER BY created_at DESC;
```

## Validation Logging

### Log Table Structure

```sql
template_validation_logs
├── id (uuid)
├── company_id (uuid)
├── template_id (uuid)
├── template_type (text)
├── template_name (text)
├── action (text) - created, updated, activated, sent, validated
├── validation_status (text) - passed, failed, warning, override
├── has_errors (boolean)
├── has_missing_required_codes (boolean)
├── missing_codes (jsonb)
├── errors (jsonb)
├── warnings (jsonb)
├── override_used (boolean)
├── user_id (uuid)
├── user_role (text)
└── created_at (timestamptz)
```

### Viewing Validation Logs

**Query Recent Overrides:**
```sql
SELECT
  template_name,
  template_type,
  missing_codes->0->>'code' as first_missing_code,
  user_role,
  created_at
FROM template_validation_logs
WHERE override_used = true
  AND company_id = 'your-company-id'
ORDER BY created_at DESC
LIMIT 10;
```

**Query Failed Validations:**
```sql
SELECT
  template_name,
  action,
  errors,
  warnings,
  created_at
FROM template_validation_logs
WHERE validation_status = 'failed'
  AND company_id = 'your-company-id'
ORDER BY created_at DESC;
```

**Query Templates with Most Issues:**
```sql
SELECT
  template_name,
  COUNT(*) as issue_count,
  COUNT(*) FILTER (WHERE has_missing_required_codes) as missing_code_count,
  COUNT(*) FILTER (WHERE override_used) as override_count
FROM template_validation_logs
WHERE company_id = 'your-company-id'
  AND validation_status != 'passed'
GROUP BY template_name
ORDER BY issue_count DESC;
```

## User Experience Flow

### Scenario 1: Creating Template with Missing Required Codes

1. User fills out template form
2. User clicks "Save Template"
3. Frontend validates immediately
4. If missing required codes:
   - Show warning modal
   - List missing codes with reasons
   - Offer "Fix Template" or "Save as Inactive"
5. If user is admin:
   - Show "Save Anyway" button
   - Warn about compliance
6. Log validation event to database

### Scenario 2: Activating Inactive Template

1. User clicks "Activate" on inactive template
2. System validates template
3. If missing required codes:
   - Prevent activation
   - Show modal explaining what's missing
   - Redirect to editor
4. If admin overrides:
   - Log override event
   - Allow activation with warning

### Scenario 3: Sending Email with Template

1. System retrieves active template
2. Validates template before sending
3. If missing required codes:
   - Block send operation
   - Log failed send attempt
   - Notify admin of issue
4. Only send if validation passes or override flag set

## Error Messages

### User-Facing Messages

**Missing Required Codes:**
```
Your template is missing required short codes:

{{quote_link}} - Required for customers to access and approve their quote
{{quote_number}} - Required for quote identification and tracking

Add these short codes to your subject or body template.
```

**Syntax Errors:**
```
Template validation failed:
• Template contains malformed short codes (unclosed brackets)
• Subject template cannot be empty

Please fix these errors before saving.
```

**Override Warning (Admin):**
```
Warning: This template is missing required short codes.

Templates with missing required codes may not function correctly when sending emails.
As an admin, you can save anyway, but this is not recommended for production use.
```

### API Error Responses

**400 Bad Request - Validation Failed:**
```json
{
  "error": "Template validation failed",
  "validation": {
    "isValid": false,
    "errors": ["Subject template cannot be empty"],
    "warnings": [],
    "hasRequiredCodeViolations": false
  }
}
```

**400 Bad Request - Missing Required Codes:**
```json
{
  "error": "Template is missing required short codes and cannot be activated",
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": ["Missing required short code: {{quote_link}}..."],
    "missingRequiredCodes": [
      { "code": "quote_link", "reason": "..." }
    ],
    "hasRequiredCodeViolations": true
  },
  "message": "Add the required short codes or save as inactive template"
}
```

## Best Practices

### For Developers

1. **Always validate before saving:**
   ```typescript
   const validation = validateTemplate(subject, body, type);
   if (!validation.isValid) {
     // Show errors, don't save
   }
   ```

2. **Provide clear feedback:**
   - Use inline validation components
   - Show warnings in real-time
   - Explain why codes are required

3. **Log all validation events:**
   - Track override usage
   - Monitor validation failures
   - Audit compliance

4. **Test with incomplete templates:**
   - Missing required codes
   - Malformed syntax
   - Edge cases

### For Administrators

1. **Avoid overrides when possible:**
   - Add required codes instead
   - Save as inactive if incomplete
   - Only override for testing

2. **Review validation logs regularly:**
   - Check for frequent overrides
   - Identify problematic templates
   - Train users on requirements

3. **Maintain template standards:**
   - Document required codes
   - Provide template examples
   - Enforce validation policies

### For Template Editors

1. **Include all required codes:**
   - Check template type requirements
   - Use shortcode picker
   - Preview before saving

2. **Test templates:**
   - Use preview function
   - Check with sample data
   - Verify links work

3. **Save incomplete work as inactive:**
   - Don't activate until complete
   - Add all required codes first
   - Test thoroughly

## Troubleshooting

### Issue: "Template is missing required short codes"

**Cause:** Template doesn't contain codes marked as required for its type

**Solution:**
1. Check template type requirements above
2. Add missing codes to subject or body
3. Use shortcode picker to insert correctly
4. Save and validate again

**Workaround (Admin only):**
- Save as inactive template
- OR use override flag (not recommended)

### Issue: "Template contains malformed short codes"

**Cause:** Short code syntax error (e.g., `{{code` without closing)

**Solution:**
1. Check all `{{code}}` pairs are closed
2. No nested codes `{{{{code}}}}`
3. No spaces inside braces `{{ code }}`

### Issue: Cannot activate template

**Cause:** Template has validation errors or missing required codes

**Solution:**
1. Review validation feedback
2. Fix all syntax errors first
3. Add missing required codes
4. Try activation again

### Issue: Admin override not working

**Possible causes:**
- Not logged in as admin/super admin
- Template has syntax errors (not overrideable)
- Override flag not set correctly

**Solution:**
1. Check user role: `SELECT role FROM user_profiles WHERE id = auth.uid()`
2. Fix syntax errors first
3. Set `override_required_validation: true` flag
4. Check server logs for details

## Security Considerations

### Data Protection

- Validation logs contain template content
- RLS policies restrict access to admins only
- Logs automatically scoped to company

### Audit Trail

- All validation events logged
- Override usage tracked with user ID
- Timestamps for compliance

### Permission Checks

- Only admins can override validation
- Regular users cannot bypass required codes
- Service role for automated logging

## API Reference

### Validation Functions

**validateTemplate(subject, body, type)**
```typescript
function validateTemplate(
  subjectTemplate: string,
  bodyTemplate: string,
  templateType?: TemplateType
): TemplateValidation
```

**validateTemplateForSending(template, allowOverride)**
```typescript
function validateTemplateForSending(
  template: CommunicationTemplate,
  allowOverride?: boolean
): { canSend: boolean; validation: TemplateValidation }
```

**getRequiredShortCodes(type)**
```typescript
function getRequiredShortCodes(
  type: TemplateType
): { code: string; reason: string }[]
```

### Edge Function Endpoints

**POST /communication-templates**
- Validates on create
- Checks required codes
- Logs validation event

**PUT /communication-templates/:id**
- Validates on update
- Checks if activating
- Logs validation event

**Query Parameters:**
- `override_required_validation=true` - Admin override flag

## Migration Reference

**Migration:** `create_template_validation_logs`
**Applied:** February 4, 2024

**What it creates:**
- `template_validation_logs` table
- Indexes for performance
- RLS policies for security
- `log_template_validation()` helper function

## Summary

The template validation system ensures email quality by:

1. ✅ Enforcing required short codes
2. ✅ Preventing syntax errors
3. ✅ Providing clear feedback
4. ✅ Allowing admin overrides
5. ✅ Logging all validation events
6. ✅ Maintaining audit trail

All validation happens at both frontend and backend levels, with comprehensive logging for compliance and debugging.
