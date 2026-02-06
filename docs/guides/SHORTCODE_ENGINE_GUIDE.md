# Short-Code Engine Guide

The short-code (merge tag) engine allows you to create reusable email templates with dynamic placeholders that get replaced with actual data at send time.

## Overview

Short codes are placeholders in the format `{{variable_name}}` that get replaced with real data when emails are sent. For example:
- `{{customer_first_name}}` → "John"
- `{{quote_number}}` → "Q-2024-001"
- `{{invoice_total}}` → "$1,250.00"

## Available Short Codes

### Customer Information
- `{{customer_first_name}}` - Customer's first name
- `{{customer_last_name}}` - Customer's last name
- `{{customer_full_name}}` - Customer's full name
- `{{customer_company}}` - Customer's company name
- `{{customer_email}}` - Customer's email address
- `{{customer_phone}}` - Customer's phone number
- `{{customer_address}}` - Customer's street address
- `{{customer_city}}` - Customer's city
- `{{customer_state}}` - Customer's state
- `{{customer_zip}}` - Customer's ZIP code

### Quote Information
- `{{quote_number}}` - Quote number (e.g., "Q-2024-001")
- `{{quote_total}}` - Total quote amount (formatted currency)
- `{{quote_subtotal}}` - Quote subtotal (formatted currency)
- `{{quote_tax}}` - Tax amount (formatted currency)
- `{{quote_discount}}` - Discount amount (formatted currency)
- `{{quote_date}}` - Quote creation date
- `{{quote_expiry_date}}` - Quote expiration date
- `{{quote_link}}` - Link to approve the quote
- `{{quote_status}}` - Current quote status

### Invoice Information
- `{{invoice_number}}` - Invoice number
- `{{invoice_total}}` - Total invoice amount (formatted currency)
- `{{invoice_subtotal}}` - Invoice subtotal (formatted currency)
- `{{invoice_tax}}` - Tax amount (formatted currency)
- `{{invoice_balance}}` - Outstanding balance (formatted currency)
- `{{invoice_date}}` - Invoice date
- `{{invoice_due_date}}` - Due date for payment
- `{{invoice_link}}` - Link to pay the invoice
- `{{invoice_status}}` - Current invoice status

### Company Information
- `{{company_name}}` - Your company name
- `{{company_address}}` - Company street address
- `{{company_city}}` - Company city
- `{{company_state}}` - Company state
- `{{company_zip}}` - Company ZIP code
- `{{company_phone}}` - Company phone number
- `{{company_email}}` - Company email address
- `{{company_website}}` - Company website

### User Information (Sender)
- `{{user_name}}` - Sender's full name
- `{{user_first_name}}` - Sender's first name
- `{{user_last_name}}` - Sender's last name
- `{{user_email}}` - Sender's email address
- `{{user_phone}}` - Sender's phone number

### Payment Information
- `{{payment_amount}}` - Payment amount (formatted currency)
- `{{payment_method}}` - Payment method used
- `{{payment_date}}` - Date of payment
- `{{payment_link}}` - Link to make a payment

### General Information
- `{{current_date}}` - Today's date
- `{{current_year}}` - Current year

## Usage Examples

### Example 1: Quote Email Template

**Subject:**
```
Quote {{quote_number}} - {{customer_company}}
```

**Body:**
```html
<p>Hi {{customer_first_name}},</p>

<p>Thank you for your interest! Please find your quote below:</p>

<p>
<strong>Quote Number:</strong> {{quote_number}}<br/>
<strong>Total:</strong> {{quote_total}}<br/>
<strong>Valid Until:</strong> {{quote_expiry_date}}
</p>

<p><a href="{{quote_link}}">Click here to review and approve your quote</a></p>

<p>If you have any questions, please don't hesitate to reach out.</p>

<p>
Best regards,<br/>
{{user_name}}<br/>
{{company_name}}<br/>
{{company_phone}}
</p>
```

### Example 2: Invoice Reminder

**Subject:**
```
Invoice Reminder - {{invoice_number}} Due {{invoice_due_date}}
```

**Body:**
```html
<p>Hello {{customer_first_name}},</p>

<p>This is a friendly reminder that invoice {{invoice_number}} is due on {{invoice_due_date}}.</p>

<p>
<strong>Amount Due:</strong> {{invoice_balance}}<br/>
<strong>Invoice Total:</strong> {{invoice_total}}
</p>

<p><a href="{{invoice_link}}">Click here to view and pay your invoice</a></p>

<p>Thank you for your business!</p>

<p>
{{company_name}}<br/>
{{company_email}}<br/>
{{company_phone}}
</p>
```

### Example 3: Payment Confirmation

**Subject:**
```
Payment Received - Invoice {{invoice_number}}
```

**Body:**
```html
<p>Dear {{customer_first_name}},</p>

<p>Thank you! We have received your payment of {{payment_amount}} on {{payment_date}}.</p>

<p>
<strong>Invoice:</strong> {{invoice_number}}<br/>
<strong>Payment Method:</strong> {{payment_method}}<br/>
<strong>Remaining Balance:</strong> {{invoice_balance}}
</p>

<p>We appreciate your prompt payment!</p>

<p>
Best regards,<br/>
{{user_name}}<br/>
{{company_name}}
</p>
```

## Using the Short-Code Engine in Code

### Client-Side (React)

```typescript
import { ShortCodeEngine } from './services/shortcode-service';
import { ShortCodeData } from './types/shortcode';

// Prepare your data
const data: ShortCodeData = {
  customer_first_name: 'John',
  customer_company: 'Acme Corp',
  quote_number: 'Q-2024-001',
  quote_total: '$1,250.00',
  quote_link: 'https://example.com/quotes/approve/abc123',
  user_name: 'Jane Smith',
  company_name: 'Your Company',
};

// Render a template
const template = '<p>Hi {{customer_first_name}}, your quote {{quote_number}} is ready!</p>';
const rendered = ShortCodeEngine.renderTemplate(template, data);
// Output: "<p>Hi John, your quote Q-2024-001 is ready!</p>"
```

### Server-Side (Edge Functions)

```typescript
import { renderTemplate, ShortCodeData } from '../_shared/shortcode-engine.ts';

const data: ShortCodeData = {
  customer_first_name: 'John',
  invoice_number: 'INV-2024-001',
  invoice_total: '$1,250.00',
};

const template = 'Invoice {{invoice_number}} for {{invoice_total}} is ready.';
const rendered = renderTemplate(template, data);
```

### Sending Emails with Short Codes

```typescript
import { EmailService } from './services/email-service';

// Send a quote email
await EmailService.sendQuoteEmail(
  'customer@example.com',
  'Quote {{quote_number}} - {{customer_company}}',
  '<p>Hi {{customer_first_name}}, your quote is ready!</p>',
  {
    quote: quoteRecord,
    customer: customerRecord,
    company: companyRecord,
    user: userRecord,
    approvalUrl: 'https://example.com/quotes/approve/abc123'
  }
);

// Send an invoice email
await EmailService.sendInvoiceEmail(
  'customer@example.com',
  'Invoice {{invoice_number}}',
  '<p>Your invoice {{invoice_number}} is ready for payment.</p>',
  {
    invoice: invoiceRecord,
    customer: customerRecord,
    company: companyRecord,
    user: userRecord,
    paymentUrl: 'https://example.com/invoices/pay/xyz789'
  }
);
```

## UI Components

### ShortCodePicker

A component that displays available short codes and allows users to insert them into templates:

```typescript
import ShortCodePicker from './components/email/ShortCodePicker';

<ShortCodePicker
  onInsert={(shortCode) => console.log('Inserted:', shortCode)}
  currentTemplate={templateText}
/>
```

### EmailTemplateEditor

A full-featured email template editor with short code support:

```typescript
import EmailTemplateEditor from './components/email/EmailTemplateEditor';

<EmailTemplateEditor
  initialSubject="Quote {{quote_number}}"
  initialBody="<p>Hi {{customer_first_name}},</p>"
  onSave={(subject, body) => console.log('Saved:', subject, body)}
  onSend={(subject, body) => console.log('Sending:', subject, body)}
/>
```

## Helper Functions

### Extract Short Codes
```typescript
const template = 'Hi {{customer_first_name}}, quote {{quote_number}} is ready';
const codes = ShortCodeEngine.extractShortCodes(template);
// Returns: ['customer_first_name', 'quote_number']
```

### Validate Template
```typescript
const validation = ShortCodeEngine.validateTemplate(template, data);
if (!validation.valid) {
  console.log('Missing codes:', validation.missingCodes);
}
```

### Generate Preview
```typescript
const preview = ShortCodeEngine.generatePreview(template);
// Returns template filled with sample data
```

## Security

- All rendered templates are automatically sanitized using DOMPurify
- XSS attacks are prevented by stripping dangerous HTML tags and attributes
- Safe HTML tags like `<p>`, `<strong>`, `<a>` are preserved
- Maximum iteration limit prevents infinite loops

## Performance

- Short code replacement runs in O(n) time where n is the number of unique short codes
- Templates are processed server-side to avoid client-side performance issues
- Large templates are handled efficiently with streaming where possible

## Best Practices

1. **Use descriptive short codes**: Choose codes that clearly indicate what data they represent
2. **Provide fallbacks**: Handle missing data gracefully by providing default values
3. **Test templates**: Use the preview function to verify templates before sending
4. **Keep templates simple**: Don't nest short codes or create complex logic
5. **Format data properly**: Use formatCurrency() and formatDate() for consistent formatting
6. **Validate before sending**: Check that all required short codes have data

## Troubleshooting

### Short code not being replaced
- Verify the short code name matches exactly (case-sensitive)
- Check that data is provided for that short code
- Ensure the short code format is correct: `{{code_name}}`

### Missing data in emails
- Use validateTemplate() to check for missing short codes
- Provide default values for optional fields
- Check that data is passed correctly to the email service

### Preview showing sample data
- Preview function intentionally shows sample data
- Real emails will use actual data from your database
- Test with a real send to verify actual data replacement
