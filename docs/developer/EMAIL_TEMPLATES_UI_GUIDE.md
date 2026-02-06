# Email Templates UI Guide

## Where to Find It

The **Email Templates** feature is now available in the main navigation sidebar:

```
Production Dashboard
├── Production Management
└── (separator)

Accounting
├── Billing Queue
├── Accounts Receivable
├── Paid Invoices
├── Customers
└── Payments
(separator)

Square Dashboard
└── Square Dashboard
(separator)

✉️ Email Templates  ← NEW!
└── Email Templates Manager
(separator)

Settings
```

## Accessing Email Templates

1. **Log in** to your account
2. Look for **"Email Templates"** in the left sidebar (purple/blue icon)
3. Click to open the Email Templates Manager

## What You'll See

### Main Interface

**Template List View:**
- Shows all existing email templates
- Active/Inactive status badges
- Template type labels
- Quick actions (Edit, Activate/Deactivate, Clone, Delete)

**Action Buttons:**
- **"New Template"** - Create a new email template
- **"Short Code Reference"** - View all available short codes

## Creating a Template

### Step 1: Click "New Template"

### Step 2: Fill Out the Form

**Template Type** (dropdown)
- Quote Email Default
- Invoice Email Default
- Invoice Reminder
- Payment Confirmation
- Approval Email
- Internal Notification
- AR Report
- Custom

⚠️ **Required Short Codes Alert**
If your template type requires specific short codes, you'll see an orange warning box showing which codes MUST be included.

Example for "Quote Email Default":
```
⚠️ Required Short Codes
{{quote_link}} - Required for customers to access and approve their quote
{{quote_number}} - Required for quote identification and tracking
{{customer_first_name}} - Required for personalized communication
```

**Template Name**
- Give your template a descriptive name
- Example: "Professional Quote Email"

**Subject Template**
- Enter the email subject line
- Use short codes: `{{quote_number}}`, `{{customer_company}}`, etc.

**Body Template (HTML)**
- Full HTML editor
- Use short codes for dynamic content
- HTML tags supported

### Step 3: Insert Short Codes

Click the **"Short Codes"** button to open the short code picker sidebar.

**How to use:**
1. Click in the Subject or Body field where you want to insert a code
2. Click on a short code in the picker
3. The code is automatically inserted at cursor position

**Available Short Codes:**
- Customer Info: `{{customer_first_name}}`, `{{customer_company}}`, etc.
- Quote Info: `{{quote_number}}`, `{{quote_total}}`, `{{quote_link}}`, etc.
- Invoice Info: `{{invoice_number}}`, `{{invoice_total}}`, `{{invoice_link}}`, etc.
- Company Info: `{{company_name}}`, `{{company_phone}}`, etc.
- User Info: `{{user_name}}`, `{{user_email}}`, etc.

### Step 4: Real-Time Validation

As you type, the system validates your template:

✅ **Valid Template** (Green)
```
✓ Template is valid
All required short codes are present and syntax is correct.
```

⚠️ **Missing Required Codes** (Orange)
```
⚠️ Missing required short codes

{{quote_link}}
Required for customers to access and approve their quote

These short codes must be added before the template can be used to send emails.
```

❌ **Syntax Errors** (Red)
```
✗ Errors found
• Template contains malformed short codes (unclosed brackets)
• Subject template cannot be empty
```

### Step 5: Configure Attachments

Check the boxes for what to auto-attach:
- ☑ Quote/Invoice Link
- ☐ PDF
- ☐ Mockups
- ☐ Terms & Conditions

(Options vary by template type)

### Step 6: Activate Template

☑ **Set as active template**

Note: Only one template of each type can be active at a time.

### Step 7: Save

Click **"Create Template"** or **"Update Template"**

## Validation Warning Modal

If you try to save a template with missing required codes, you'll see a modal:

```
⚠️ Missing Required Short Codes

Your template is missing required short codes:

┌──────────────────────────────────────┐
│ {{quote_link}}                       │
│ Required for customers to access and │
│ approve their quote                  │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ {{quote_number}}                     │
│ Required for quote identification    │
│ and tracking                         │
└──────────────────────────────────────┘

[Fix Template]  [Save as Inactive]
            [Save Anyway] (Admin Only)
```

**Your Options:**

1. **Fix Template** - Returns you to the editor to add missing codes
2. **Save as Inactive** - Saves the template but doesn't activate it (you can finish it later)
3. **Save Anyway** (Admin Only) - Override validation and save despite missing codes

## Managing Existing Templates

### Viewing Templates

Templates are displayed as cards showing:
- Template name
- Active/Inactive status (green/gray badge)
- Template type
- Subject line preview
- Required short codes (if any)

### Template Actions

**Activate/Deactivate** (Power icon)
- Toggle template active status
- Only one template per type can be active

**Edit** (Pencil icon)
- Open template in editor
- Modify and save changes

**Clone** (Copy icon)
- Create a duplicate of the template
- Useful for creating variations

**Delete** (Trash icon)
- Permanently delete template
- Confirmation required

## Short Code Reference

Click **"Short Code Reference"** button to view:
- Complete list of all available short codes
- Organized by category
- Descriptions of what each code does
- Copy-paste ready

## Admin Features

### Override Validation

**Admins can:**
- Save templates with missing required codes
- Use "Save Anyway" button in warning modal
- Activate incomplete templates

⚠️ **Warning:** Override usage is logged for audit purposes

**Use cases for override:**
- Testing templates during development
- Creating draft templates for later completion
- Special use cases where certain codes aren't needed

### View Validation Logs

Admins can query validation logs to see:
- All validation events
- Who used overrides and when
- Templates with frequent issues

Query in Supabase:
```sql
SELECT * FROM template_validation_logs
WHERE company_id = 'your-company-id'
ORDER BY created_at DESC;
```

## Tips & Best Practices

### ✅ Do:
- Use descriptive template names
- Include all required short codes
- Test templates with preview data
- Use the short code picker (prevents typos)
- Keep subject lines under 100 characters
- Save drafts as inactive until complete

### ❌ Don't:
- Activate templates with missing required codes (unless absolutely necessary)
- Forget to test email rendering
- Use malformed short codes like `{{code` (missing closing bracket)
- Nest short codes like `{{{{code}}}}`
- Remove required codes from active templates

## Common Scenarios

### Scenario 1: Creating Your First Quote Email

1. Click "New Template"
2. Select "Quote Email Default"
3. See required codes warning (quote_link, quote_number, customer_first_name)
4. Enter template name: "Standard Quote Email"
5. Use "Quick Start Template" → "Quote Template"
6. Review - all required codes are present ✓
7. Check "Set as active template"
8. Click "Create Template"
9. Success!

### Scenario 2: Missing a Required Code

1. Editing invoice email template
2. Remove `{{invoice_link}}` by accident
3. Try to save
4. Validation warning modal appears
5. Click "Fix Template"
6. Add `{{invoice_link}}` back to body
7. Validation shows green ✓
8. Save successfully

### Scenario 3: Admin Override

1. Creating custom quote email for special case
2. Don't need customer_first_name (sending to generic email)
3. Try to save - warning appears
4. Click "Save Anyway" (admin only)
5. Template saved with override logged
6. Can use template, but know it's non-standard

## Troubleshooting

### "Template is missing required short codes"

**Cause:** Required codes not in subject or body

**Solution:**
1. Check which codes are required (see orange box)
2. Use short code picker to insert them
3. Can be in subject OR body (both are checked)

### "Template contains malformed short codes"

**Cause:** Syntax error in short code

**Examples:**
- `{{code` - missing `}}`
- `{{  code  }}` - extra spaces
- `{{{{code}}}}` - nested brackets

**Solution:**
- Use short code picker instead of typing manually
- Check all `{{` have matching `}}`

### "Another active template of this type already exists"

**Cause:** Trying to activate when another is already active

**Solution:**
1. Go back to template list
2. Find the currently active template of same type
3. Deactivate it first (power icon)
4. Then activate your new template

### "Permission Denied"

**Cause:** Only admins can create/edit templates

**Solution:**
- Contact your admin for permission
- Or ask admin to create template for you

## Quick Reference

| Feature | Location | Access Level |
|---------|----------|--------------|
| View Templates | Email Templates tab | All Users |
| Create Template | "New Template" button | Admin Only |
| Edit Template | Edit icon on template card | Admin Only |
| Delete Template | Trash icon on template card | Admin Only |
| Clone Template | Copy icon on template card | Admin Only |
| Activate/Deactivate | Power icon on template card | Admin Only |
| Short Code Reference | "Short Code Reference" button | All Users |
| Override Validation | "Save Anyway" in modal | Admin Only |

## Support

For questions or issues with email templates:
1. Check this guide first
2. View the Short Code Reference
3. Check validation feedback messages
4. Contact your system administrator

## Related Documentation

- **TEMPLATE_VALIDATION_SYSTEM_GUIDE.md** - Complete technical documentation
- **TEMPLATE_VALIDATION_IMPLEMENTATION_SUMMARY.md** - Implementation details
- **SHORTCODE_ENGINE_GUIDE.md** - Short code system documentation
- **EMAIL_GUIDE.md** - Email functionality overview
