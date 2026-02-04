# Email Templates Database Schema Guide

## Overview

The `communication_templates` table stores customizable email templates with short code support for various communication scenarios including quotes, invoices, payment confirmations, and more.

## Database Schema

### Table: `communication_templates`

```sql
CREATE TABLE communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  template_name text NOT NULL,
  subject_template text NOT NULL DEFAULT '',
  body_template text NOT NULL DEFAULT '',
  auto_attach_quote_link boolean NOT NULL DEFAULT true,
  auto_attach_pdf boolean NOT NULL DEFAULT false,
  auto_attach_mockups boolean NOT NULL DEFAULT false,
  auto_attach_terms boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique template identifier |
| `company_id` | uuid | Links to companies table for data isolation |
| `template_type` | text | Type of template (see allowed values below) |
| `template_name` | text | User-friendly name for the template |
| `subject_template` | text | Email subject line with short codes |
| `body_template` | text | Email body content with short codes and HTML support |
| `auto_attach_quote_link` | boolean | Automatically include quote approval link |
| `auto_attach_pdf` | boolean | Automatically attach PDF document |
| `auto_attach_mockups` | boolean | Automatically attach mockup images |
| `auto_attach_terms` | boolean | Automatically include payment terms |
| `is_active` | boolean | Enable/disable template without deletion |
| `created_at` | timestamp | Record creation timestamp |
| `updated_at` | timestamp | Last modification timestamp (auto-updated) |
| `created_by` | uuid | User who created the template |
| `updated_by` | uuid | User who last updated the template |

### Allowed Template Types

```typescript
type TemplateType =
  | 'quote_email_default'          // Default quote approval emails
  | 'invoice_email_default'        // Default invoice emails
  | 'invoice_reminder'             // Payment reminder emails
  | 'payment_confirmation'         // Payment confirmation emails
  | 'approval_email'               // Approval request emails
  | 'internal_notification'        // Internal team notifications
  | 'ar_report'                    // Accounts receivable reports
  | 'custom';                      // Custom templates
```

## Constraints and Rules

### 1. Template Type Constraint
Only specific template types are allowed (enforced by CHECK constraint):
```sql
CONSTRAINT valid_template_type CHECK (
  template_type IN (
    'quote_email_default',
    'invoice_email_default',
    'invoice_reminder',
    'payment_confirmation',
    'approval_email',
    'internal_notification',
    'ar_report',
    'custom'
  )
)
```

### 2. One Active Template Per Type
Each company can have only ONE active template per template type (enforced by unique index):
```sql
CREATE UNIQUE INDEX communication_templates_company_type_unique
  ON communication_templates(company_id, template_type)
  WHERE is_active = true;
```

This means:
- ✅ Multiple inactive templates of same type allowed
- ✅ Different template types can all be active
- ❌ Cannot activate two templates of the same type

### 3. Automatic Timestamp Update
The `updated_at` field is automatically updated on every modification via trigger:
```sql
CREATE TRIGGER update_communication_templates_updated_at_trigger
  BEFORE UPDATE ON communication_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_communication_templates_updated_at();
```

## Indexes

### Performance Indexes
- `communication_templates_company_id_idx` - Fast company filtering
- `communication_templates_type_idx` - Quick template type lookups
- `communication_templates_active_idx` - Efficient active template queries

## Row Level Security (RLS)

### Security Policies

#### 1. View Templates (SELECT)
```sql
-- All authenticated users can view their company's templates
CREATE POLICY "Users can view their company's templates"
  ON communication_templates FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );
```

#### 2. Create Templates (INSERT)
```sql
-- Only admins and super admins can create templates
CREATE POLICY "Admins can insert templates for their company"
  ON communication_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );
```

#### 3. Update Templates (UPDATE)
```sql
-- Only admins and super admins can update templates
CREATE POLICY "Admins can update their company's templates"
  ON communication_templates FOR UPDATE
  TO authenticated
  USING (...) WITH CHECK (...);
```

#### 4. Delete Templates (DELETE)
```sql
-- Only admins and super admins can delete templates
CREATE POLICY "Admins can delete their company's templates"
  ON communication_templates FOR DELETE
  TO authenticated
  USING (...);
```

## Default Templates

Default templates are automatically created for all companies:

### 1. Quote Email Default
```typescript
{
  template_type: 'quote_email_default',
  template_name: 'Default Quote Email',
  subject_template: 'Quote {{quote_number}} for {{customer_company}}',
  body_template: `
    <p>Hi {{customer_first_name}},</p>
    <p>Your quote <strong>{{quote_number}}</strong> is ready for review.</p>
    <p>Total Amount: <strong>{{quote_total}}</strong></p>
    ...
  `,
  auto_attach_quote_link: true,
  auto_attach_terms: true
}
```

### 2. Invoice Email Default
```typescript
{
  template_type: 'invoice_email_default',
  template_name: 'Default Invoice Email',
  subject_template: 'Invoice {{invoice_number}} from {{company_name}}',
  body_template: `
    <p>Hi {{customer_first_name}},</p>
    <p>Your invoice <strong>{{invoice_number}}</strong> is now available.</p>
    ...
  `,
  auto_attach_quote_link: true,
  auto_attach_pdf: true,
  auto_attach_terms: true
}
```

## Short Code Support

Templates support dynamic placeholders (short codes) that are replaced with actual data when emails are sent.

### Available Short Codes

See `AVAILABLE_SHORT_CODES` in `/src/types/shortcode.ts` for the complete list of 47+ short codes across categories:
- Customer Fields (10 codes)
- Quote Fields (9 codes)
- Invoice Fields (9 codes)
- Company Fields (8 codes)
- User Fields (5 codes)
- Payment Fields (4 codes)
- General Fields (2 codes)

### Short Code Examples

```html
<!-- Subject -->
Quote {{quote_number}} for {{customer_company}}

<!-- Body -->
<p>Hi {{customer_first_name}},</p>
<p>Your quote <strong>{{quote_number}}</strong> totaling {{quote_total}} is ready.</p>
<p>Valid until: {{quote_expiry_date}}</p>
```

### Missing Short Codes
If a short code references missing data, it is replaced with an empty string (no error thrown). This ensures templates always render successfully.

## API Endpoints

### Edge Function: `communication-templates`

Base URL: `/functions/v1/communication-templates`

#### List Templates
```http
GET /communication-templates?type=quote_email_default&active_only=true
```

**Query Parameters:**
- `type` (optional) - Filter by template type
- `active_only` (optional) - Return only active templates

**Response:**
```json
[
  {
    "id": "uuid",
    "company_id": "uuid",
    "template_type": "quote_email_default",
    "template_name": "Default Quote Email",
    "subject_template": "Quote {{quote_number}}...",
    "body_template": "<p>Hi {{customer_first_name}}...</p>",
    "auto_attach_quote_link": true,
    "auto_attach_pdf": false,
    "auto_attach_mockups": false,
    "auto_attach_terms": true,
    "is_active": true,
    "created_at": "2024-02-04T...",
    "updated_at": "2024-02-04T...",
    "created_by": "uuid",
    "updated_by": "uuid"
  }
]
```

#### Get Single Template
```http
GET /communication-templates/{id}
```

#### Create Template
```http
POST /communication-templates
Content-Type: application/json

{
  "template_type": "invoice_reminder",
  "template_name": "7-Day Reminder",
  "subject_template": "Payment Due: Invoice {{invoice_number}}",
  "body_template": "<p>Hi {{customer_first_name}},...</p>",
  "auto_attach_quote_link": false,
  "auto_attach_pdf": true,
  "auto_attach_mockups": false,
  "auto_attach_terms": true,
  "is_active": true
}
```

**Permissions:** Admin or Super Admin only

#### Update Template
```http
PUT /communication-templates/{id}
Content-Type: application/json

{
  "template_name": "Updated Name",
  "subject_template": "New Subject...",
  "is_active": true
}
```

**Permissions:** Admin or Super Admin only

#### Delete Template
```http
DELETE /communication-templates/{id}
```

**Permissions:** Admin or Super Admin only

## Frontend Service Layer

### TypeScript Service

Location: `/src/services/communication-template-service.ts`

```typescript
import { CommunicationTemplateService } from './communication-template-service';

// List all templates
const templates = await CommunicationTemplateService.listTemplates();

// Get specific template
const template = await CommunicationTemplateService.getTemplate(id);

// Get by type
const quoteTemplate = await CommunicationTemplateService.getTemplateByType('quote_email_default');

// Create template
const newTemplate = await CommunicationTemplateService.createTemplate({
  template_type: 'invoice_reminder',
  template_name: 'My Reminder',
  subject_template: 'Payment Due...',
  body_template: '<p>...</p>'
});

// Update template
await CommunicationTemplateService.updateTemplate(id, {
  subject_template: 'New subject...'
});

// Activate template
await CommunicationTemplateService.activateTemplate(id);

// Render template with data
const rendered = CommunicationTemplateService.renderTemplate(template, {
  customer_first_name: 'John',
  quote_number: 'QTE-0001',
  quote_total: '$1,250.00'
});
```

## Usage Examples

### Example 1: Creating a Custom Invoice Reminder

```typescript
const reminderTemplate = await CommunicationTemplateService.createTemplate({
  template_type: 'invoice_reminder',
  template_name: 'Friendly 7-Day Reminder',
  subject_template: 'Friendly Reminder: Invoice {{invoice_number}} Due Soon',
  body_template: `
    <p>Hi {{customer_first_name}},</p>

    <p>This is a friendly reminder that invoice <strong>{{invoice_number}}</strong>
    for {{invoice_balance}} is due in 7 days.</p>

    <p>Due Date: {{invoice_due_date}}</p>

    <p>You can pay online using the link below.</p>

    <p>Thank you for your business!</p>

    <p>Best regards,<br/>
    {{user_name}}<br/>
    {{company_name}}</p>
  `,
  auto_attach_pdf: true,
  auto_attach_terms: true,
  is_active: false
});
```

### Example 2: Rendering a Template

```typescript
// Get the active quote template
const template = await CommunicationTemplateService.getTemplateByType('quote_email_default');

if (template) {
  // Prepare data
  const data = {
    customer_first_name: 'Jane',
    customer_company: 'Acme Corp',
    quote_number: 'QTE-0042',
    quote_total: '$2,500.00',
    quote_date: 'February 4, 2024',
    quote_expiry_date: 'March 4, 2024',
    quote_link: 'https://app.example.com/quotes/approve/abc123',
    user_name: 'John Smith',
    company_name: 'My Company',
    company_phone: '(555) 123-4567'
  };

  // Render
  const rendered = CommunicationTemplateService.renderTemplate(template, data);

  console.log(rendered.subject); // "Quote QTE-0042 for Acme Corp"
  console.log(rendered.body);    // Full HTML with all codes replaced
  console.log(rendered.attachments.quote_link); // "https://app.example.com/..."
}
```

### Example 3: Template Validation

```typescript
const validation = CommunicationTemplateService.validateTemplate(
  'Quote {{quote_number}} for {{customer_company',  // Missing closing brace
  '<p>Hi {{customer_first_name}},</p>'
);

console.log(validation.isValid);  // false
console.log(validation.errors);   // ["Template contains malformed short codes"]
console.log(validation.warnings); // []
```

### Example 4: Template Preview

```typescript
const template = await CommunicationTemplateService.getTemplate(templateId);
const preview = CommunicationTemplateService.previewTemplate(template);

// Shows how the template will look with sample data
console.log(preview.subject); // "Quote QTE-0001 for Sample Company"
console.log(preview.body);    // Rendered with sample values
```

## Best Practices

### 1. Template Design
- ✅ Use clear, descriptive template names
- ✅ Keep subject lines under 100 characters
- ✅ Use short codes for all dynamic data
- ✅ Test templates with sample data before activating
- ✅ Include company branding and contact info
- ❌ Don't hardcode customer-specific data
- ❌ Don't nest short codes `{{{{code}}}}`
- ❌ Don't use complex HTML that may break email rendering

### 2. Short Code Usage
- ✅ Use descriptive short codes
- ✅ Handle missing data gracefully (templates use empty strings)
- ✅ Format currency and dates in code, not in template
- ❌ Don't assume all short codes will have values
- ❌ Don't create custom short codes (not supported)

### 3. Template Management
- ✅ Keep one active template per type
- ✅ Use descriptive names for multiple inactive templates
- ✅ Clone templates before making major changes
- ✅ Test in inactive state before activating
- ❌ Don't delete templates that may be referenced
- ❌ Don't activate untested templates

### 4. Security
- ✅ Templates are automatically scoped to company
- ✅ RLS ensures data isolation
- ✅ Only admins can modify templates
- ❌ Don't include sensitive data in templates
- ❌ Don't use templates to bypass business logic

## Troubleshooting

### Issue: Cannot activate template
**Error:** "Another active template of type 'X' already exists"

**Solution:** Only one template per type can be active. Deactivate the existing one first:
```typescript
await CommunicationTemplateService.deactivateTemplate(existingTemplateId);
await CommunicationTemplateService.activateTemplate(newTemplateId);
```

### Issue: Short codes not rendering
**Problem:** Short codes appear as `{{code}}` in output

**Causes:**
1. Template not being rendered through service
2. Missing data in ShortCodeData object
3. Typo in short code name

**Solution:** Use `renderTemplate()` and provide complete data:
```typescript
const rendered = CommunicationTemplateService.renderTemplate(template, completeData);
```

### Issue: Template creation fails
**Error:** "Missing required fields"

**Solution:** Ensure all required fields are provided:
```typescript
{
  template_type: 'valid_type',  // Required
  template_name: 'Name',        // Required
  subject_template: 'Subject',  // Required
  body_template: 'Body'         // Required
}
```

### Issue: Unauthorized to create/update
**Error:** "Insufficient permissions"

**Solution:** Template management requires Admin or Super Admin role. Check user role:
```typescript
const { data: profile } = await supabase
  .from('user_profiles')
  .select('role')
  .eq('id', userId)
  .single();

if (profile.role === 'admin' || profile.role === 'super_admin') {
  // Can manage templates
}
```

## Migration Information

**Migration File:** `20260204170000_create_communication_templates_table.sql`

**Applied:** February 4, 2024

**What it does:**
1. Creates `communication_templates` table
2. Sets up indexes for performance
3. Enables RLS with company-scoped policies
4. Creates trigger for automatic timestamp updates
5. Seeds default templates for all existing companies

## Related Documentation

- [Short Code Engine Guide](./SHORTCODE_ENGINE_GUIDE.md) - Complete short code documentation
- [Email Short Code UI Guide](./EMAIL_SHORTCODE_UI_GUIDE.md) - User interface guide
- [Short Code Reference Panel](./SHORTCODE_UI_IMPLEMENTATION_SUMMARY.md) - UI implementation

## Support

For issues or questions:
1. Check this guide first
2. Review RLS policies for permission issues
3. Validate template syntax with `validateTemplate()`
4. Check browser console for error messages
5. Verify company_id matches between user and templates
