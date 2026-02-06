# Email Short Code UI Reference Guide

## Overview

A comprehensive short-code reference panel has been added to Company Settings to help you easily use dynamic placeholders in your email templates.

## Accessing the Short Code Reference

**Location:** Company Settings → Quote/Invoice Settings → Available Short Codes

**Path to Access:**
1. Click on the Settings icon in the navigation
2. Expand "Company Settings" in the left sidebar
3. Click "Quote/Invoice Settings"
4. Scroll to the bottom to find the "Available Short Codes" panel

## Features

### 1. Organized by Category

Short codes are grouped into 7 categories for easy browsing:
- 👤 **Customer Fields** - Customer name, company, contact info
- 📄 **Quote Fields** - Quote number, totals, dates, approval links
- 🧾 **Invoice Fields** - Invoice number, amounts, payment links
- 🏢 **Company Fields** - Your company information
- 👨‍💼 **User (Sender) Fields** - Logged-in user's information
- 💳 **Payment Fields** - Payment amounts, methods, dates
- 📅 **General Fields** - Current date, year

### 2. Collapsible Sections

- Click on any category header to expand/collapse it
- Categories show the number of available short codes
- Customer and Quote categories are expanded by default

### 3. Copy to Clipboard

Each short code has a "Copy" button:
- Click to instantly copy the short code (e.g., `{{customer_first_name}}`)
- Button turns green and shows "Copied!" for confirmation
- Paste directly into your email templates

### 4. Live Preview

Toggle the preview to see:
- **Template with Short Codes** - Raw template with placeholders
- **Rendered with Sample Data** - How it looks when sent
- Side-by-side comparison for easy verification

### 5. Detailed Information

Each short code displays:
- **Short Code** - The exact placeholder text (in blue monospace font)
- **Description** - What data it represents
- **Category Tag** - Quick category identification

## Using Short Codes

### Basic Usage

1. **Find the short code** you need in the reference panel
2. **Click "Copy"** to copy it to your clipboard
3. **Paste it** into your email template (subject or body)
4. The short code will be **automatically replaced** with real data when the email is sent

### Example Template

```
Subject: Quote {{quote_number}} for {{customer_company}}

Hi {{customer_first_name}},

Thank you for your interest! Your quote {{quote_number}} is ready for review.

Total Amount: {{quote_total}}
Valid Until: {{quote_expiry_date}}

Click here to approve: {{quote_link}}

Best regards,
{{user_name}}
{{company_name}}
{{company_phone}}
```

### When Sent, It Becomes

```
Subject: Quote QTE-0001 for Acme Corporation

Hi John,

Thank you for your interest! Your quote QTE-0001 is ready for review.

Total Amount: $1,250.00
Valid Until: February 15, 2024

Click here to approve: https://yourapp.com/quotes/approve/abc123

Best regards,
Jane Smith
Your Company Name
(555) 123-4567
```

## Short Code Categories

### Customer Fields
- `{{customer_first_name}}` - John
- `{{customer_last_name}}` - Doe
- `{{customer_full_name}}` - John Doe
- `{{customer_company}}` - Acme Corporation
- `{{customer_email}}` - john@acme.com
- `{{customer_phone}}` - (555) 123-4567
- `{{customer_address}}` - 123 Main St
- `{{customer_city}}` - Springfield
- `{{customer_state}}` - IL
- `{{customer_zip}}` - 62701

### Quote Fields
- `{{quote_number}}` - QTE-0001
- `{{quote_total}}` - $1,250.00
- `{{quote_subtotal}}` - $1,000.00
- `{{quote_tax}}` - $62.50
- `{{quote_discount}}` - $50.00
- `{{quote_date}}` - January 15, 2024
- `{{quote_expiry_date}}` - February 15, 2024
- `{{quote_link}}` - Approval URL
- `{{quote_status}}` - Sent

### Invoice Fields
- `{{invoice_number}}` - INV-0001
- `{{invoice_total}}` - $1,250.00
- `{{invoice_subtotal}}` - $1,000.00
- `{{invoice_tax}}` - $62.50
- `{{invoice_balance}}` - $625.00 (outstanding)
- `{{invoice_date}}` - January 15, 2024
- `{{invoice_due_date}}` - February 15, 2024
- `{{invoice_link}}` - Payment URL
- `{{invoice_status}}` - Unpaid

### Company Fields
- `{{company_name}}` - Your Company Name
- `{{company_address}}` - 456 Business Blvd
- `{{company_city}}` - Chicago
- `{{company_state}}` - IL
- `{{company_zip}}` - 60601
- `{{company_phone}}` - (555) 987-6543
- `{{company_email}}` - info@yourcompany.com
- `{{company_website}}` - www.yourcompany.com

### User (Sender) Fields
- `{{user_name}}` - Jane Smith
- `{{user_first_name}}` - Jane
- `{{user_last_name}}` - Smith
- `{{user_email}}` - jane@yourcompany.com
- `{{user_phone}}` - (555) 555-5555

### Payment Fields
- `{{payment_amount}}` - $625.00
- `{{payment_method}}` - Credit Card
- `{{payment_date}}` - January 20, 2024
- `{{payment_link}}` - Payment URL

### General Fields
- `{{current_date}}` - February 4, 2024
- `{{current_year}}` - 2024

## Tips & Best Practices

### ✅ Do

1. **Use preview** before sending to verify templates look correct
2. **Test with real data** by sending a test email to yourself
3. **Keep it simple** - Use clear, easy-to-read formats
4. **Be consistent** - Use the same style across all templates
5. **Include context** - Add descriptive text around short codes

### ❌ Don't

1. **Don't nest short codes** - `{{{{quote_number}}}}` won't work
2. **Don't modify spelling** - Use exact short code names
3. **Don't assume data** - Not all fields may have values for every customer
4. **Don't overuse** - Too many short codes can make templates hard to maintain

## Automatic Formatting

Short codes are automatically formatted:
- **Currency** - Always shown as $1,250.00 (USD format)
- **Dates** - Shown as "January 15, 2024" (full month name)
- **Missing Data** - Replaced with empty string (no error shown)

## Integration Points

Short codes work in:
- ✅ Quote approval emails
- ✅ Invoice reminder emails
- ✅ Payment confirmation emails
- ✅ Custom email templates
- ✅ Automated report emails
- ✅ Email subject lines
- ✅ Email body (HTML supported)

## Troubleshooting

### Short code not being replaced?
- Check spelling (case-sensitive)
- Verify the format: `{{code_name}}`
- Make sure data exists for that field

### Preview not working?
- Try collapsing and re-expanding the section
- Check browser console for errors
- Refresh the page

### Copy button not working?
- Enable clipboard permissions in your browser
- Try manually selecting and copying the text
- Use keyboard shortcuts (Ctrl+C / Cmd+C)

## Advanced Usage

### HTML in Templates

Short codes work with HTML formatting:

```html
<p>Hi {{customer_first_name}},</p>

<div style="background: #f0f0f0; padding: 20px;">
  <h2>Quote {{quote_number}}</h2>
  <p><strong>Total:</strong> {{quote_total}}</p>
</div>

<a href="{{quote_link}}" style="color: blue;">
  Click to Approve
</a>
```

### Conditional Content

While short codes don't support if/else logic, you can structure templates to handle missing data gracefully:

```
Customer: {{customer_company}} {{customer_first_name}} {{customer_last_name}}
```

If `customer_company` is empty, it will show:
```
Customer:  John Doe
```

## Need Help?

- Hover over any short code for a tooltip
- Use the preview to test before sending
- Check the full documentation at SHORTCODE_ENGINE_GUIDE.md
- Contact support if you need additional short codes

---

**Version:** 1.0
**Last Updated:** February 2024
**Location:** Company Settings → Quote/Invoice Settings
