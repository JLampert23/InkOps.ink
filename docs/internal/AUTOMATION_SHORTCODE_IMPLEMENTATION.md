# Automation Short Code Implementation

## Overview
Added comprehensive short code support to the Automation Builder, making it easy for users to insert dynamic data placeholders in their automation messages.

## What Was Implemented

### 1. New ShortCodeReference Component
**File**: `src/components/automations/ShortCodeReference.tsx`

Features:
- Collapsible panel showing all available short codes
- Search functionality to quickly find specific codes
- Category filtering (Customer, Quote, Invoice, Company, User, Payment, General)
- Color-coded categories for easy visual identification
- Copy to clipboard functionality
- Compact, scrollable list perfect for the automation builder

### 2. Updated ActionBuilder Component
**File**: `src/components/automations/ActionBuilder.tsx`

Enhancements:
- Added info helper text for message and subject fields
- Displays the ShortCodeReference component for "Send Message" and "Request Approval" actions
- Applied monospace font to message fields for better code visibility
- Added visual hints about short code usage

## User Experience

### When Creating Send Message Actions:

1. **Visual Hint**: Users see a blue info box below message/subject fields explaining short codes
2. **Short Code Panel**: A collapsible panel appears at the bottom showing all available codes
3. **Search & Filter**: Users can search by name or filter by category
4. **Easy Copy**: Click the copy icon to copy any short code to clipboard
5. **Color Coding**: Each category has a distinct color for quick identification

### Available Short Code Categories:

- **Customer** (Blue): `{{customer_name}}`, `{{customer_email}}`, etc.
- **Quote** (Green): `{{quote_number}}`, `{{quote_total}}`, etc.
- **Invoice** (Amber): `{{invoice_number}}`, `{{invoice_balance}}`, etc.
- **Company** (Purple): `{{company_name}}`, `{{company_email}}`, etc.
- **User** (Pink): `{{user_name}}`, `{{user_email}}`, etc.
- **Payment** (Teal): `{{payment_amount}}`, `{{payment_date}}`, etc.
- **General** (Gray): `{{current_date}}`, `{{current_year}}`, etc.

## Usage Example

When creating an automation to send a payment reminder:

1. Select "Send an email and/or text message" action
2. Type your message: "Hi {{customer_first_name}}, your invoice {{invoice_number}} has a balance of {{invoice_balance}} due."
3. Expand the short code panel to verify available codes
4. Search for additional codes if needed
5. Copy and paste any additional codes into your message

## Technical Details

- Short codes use the format `{{code_name}}`
- The ShortCodeEngine service processes these codes server-side
- All codes are listed in `src/types/shortcode.ts`
- The reference component shares the same data source as the email template editor

## Benefits

1. **Discoverability**: Users can easily see what data is available
2. **Accuracy**: No more guessing short code names
3. **Efficiency**: Quick search and copy functionality
4. **Consistency**: Same short codes work across automations and email templates
5. **Professional**: Color-coded, organized interface
