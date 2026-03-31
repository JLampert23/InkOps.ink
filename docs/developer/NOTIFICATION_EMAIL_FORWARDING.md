# Notification Email Forwarding

## Overview

The Notification Email Forwarding feature allows companies to receive real-time email copies of all in-app notifications. This is particularly useful for managers or team leads who want to stay informed without constantly checking the application.

## Architecture

### Components

1. **Database Schema**
   - `company_settings.notification_forwarding_email` - Email address to forward notifications to
   - `company_settings.notification_forwarding_enabled` - Master toggle for email forwarding

2. **Edge Function: `forward-notification-email`**
   - Receives notification payloads from database trigger
   - Fetches company settings and validates configuration
   - Decrypts Resend API key using crypto-service
   - Sends formatted email via Resend API
   - Handles errors gracefully without blocking notification creation

3. **Database Trigger: `trigger_forward_notification_email`**
   - Fires AFTER INSERT on notifications table
   - Makes async HTTP call to Edge Function using pg_net
   - Never blocks notification creation (even on failure)

4. **UI Component: NotificationSettings**
   - Located in Settings > Notification Settings
   - Admin-only section for email forwarding configuration
   - Email validation and test email functionality
   - Real-time toggle for enabling/disabling forwarding

## Flow Diagram

```
User Action (e.g., Quote Approved)
    ↓
Notification Created in Database
    ↓
Trigger: trigger_forward_notification_email (async)
    ↓
Edge Function: forward-notification-email
    ↓
Check: Is forwarding enabled?
    ↓ (Yes)
Check: Is forwarding email configured?
    ↓ (Yes)
Decrypt Resend API Key
    ↓
Send Email via Resend API
    ↓
Email Delivered to Configured Address
```

## Configuration

### Step 1: Configure Resend API Key

Email forwarding requires a Resend API key to be configured:

1. Navigate to Settings > Integrations > Resend Integration
2. Enter your Resend API key
3. Configure your from email address
4. Save the settings

### Step 2: Enable Email Forwarding

1. Navigate to Settings > Notification Settings
2. Scroll to "Email Forwarding (Admin)" section
3. Enter the email address to forward notifications to
4. Click "Send Test Email" to verify configuration
5. Enable email forwarding using the toggle
6. Click "Save Email Forwarding"

## Security Features

1. **Email Validation**
   - Validates email format before saving
   - Prevents invalid email addresses

2. **Test Email Feature**
   - Allows testing configuration before enabling
   - Verifies Resend API key and email settings
   - Does not require enabling forwarding first

3. **Encrypted API Keys**
   - Resend API keys are encrypted at rest
   - Decrypted only when sending emails
   - Uses crypto-service Edge Function

4. **RLS Policies**
   - Only authenticated users can access settings
   - Company isolation prevents cross-company access
   - Admin-level feature (UI enforced)

5. **Graceful Failure Handling**
   - Email failures never block notification creation
   - Errors logged but don't affect user experience
   - Async processing prevents performance impact

## API Reference

### Edge Function: `forward-notification-email`

**Endpoint:** `/functions/v1/forward-notification-email`

**Method:** POST

**Authentication:** Service Role (internal use only)

**Request Body:**
```json
{
  "notification_id": "uuid",
  "company_id": "uuid",
  "notification_type": "quote_approved",
  "title": "Quote Approved",
  "message": "Quote #QTE-001 has been approved by the customer.",
  "reference_type": "quote",
  "reference_id": "uuid"
}
```

**Response (Success):**
```json
{
  "success": true,
  "email_id": "resend-email-id",
  "message": "Notification email sent successfully"
}
```

**Response (Disabled/Not Configured):**
```json
{
  "success": true,
  "message": "Email forwarding is disabled"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Database Schema

### Table: company_settings

```sql
-- Email forwarding columns
notification_forwarding_email text,
notification_forwarding_enabled boolean DEFAULT false
```

### Trigger Function

```sql
CREATE OR REPLACE FUNCTION forward_notification_to_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- Async HTTP request to Edge Function
-- Never blocks notification creation
$$;
```

## Email Template

Forwarded notification emails include:

1. **Subject:** `[InkOps Notification] {Title}`
2. **Body:**
   - Notification title
   - Notification message
   - Reference information (type and ID)
   - Notification type label

Example:
```
Subject: [InkOps Notification] Quote Approved

Quote Approved
Quote #QTE-001 has been approved by the customer.

---
Reference: quote (ID: 123e4567-e89b-12d3-a456-426614174000)
Type: quote_approved
```

## Important Notes

1. **Notification Type Preferences**
   - Email forwarding respects individual user notification preferences
   - Only enabled notification types will be forwarded
   - Users can control which notifications they receive

2. **Requirements**
   - Resend API key must be configured
   - From email address must be set
   - Forwarding email must be valid
   - pg_net extension must be enabled

3. **Performance**
   - Uses async HTTP requests (pg_net)
   - Does not impact notification creation speed
   - No blocking operations in the trigger

4. **Error Handling**
   - Failed emails are logged but don't alert users
   - Notifications always appear in-app regardless of email status
   - Test email feature helps identify configuration issues

## Troubleshooting

### Email Not Received

1. Check if email forwarding is enabled
2. Verify the forwarding email address is correct
3. Send a test email to verify configuration
4. Check Resend API key is valid and not expired
5. Verify from email address is configured
6. Check spam/junk folder

### Test Email Fails

1. Verify Resend API key is configured correctly
2. Check from email address is set
3. Ensure forwarding email is valid format
4. Review Edge Function logs for errors

### Notifications Not Triggering Emails

1. Confirm notification type is enabled in preferences
2. Verify email forwarding is enabled
3. Check that notifications are being created in-app
4. Review database trigger logs

## Future Enhancements

Potential improvements for future versions:

1. **Email Digest Mode**
   - Option to batch notifications and send daily/weekly digests
   - Reduces email volume for high-activity companies

2. **Multiple Recipients**
   - Support for forwarding to multiple email addresses
   - Role-based forwarding (different emails for different notification types)

3. **Email Templates**
   - Customizable email templates
   - Company branding in forwarded emails
   - HTML formatting options

4. **Notification Filtering**
   - Granular control over which notifications to forward
   - Exclude certain notification types from forwarding
   - Priority-based forwarding

5. **Delivery Reports**
   - Track email delivery status
   - View bounce/failure rates
   - Resend failed notifications

## Migration Files

- `add_notification_email_forwarding.sql` - Adds columns to company_settings
- `add_notification_email_forwarding_trigger.sql` - Creates trigger and function

## Related Documentation

- [Email Service Guide](./EMAIL_GUIDE.md)
- [Notification System](./NOTIFICATIONS.md)
- [Company Settings](./COMPANY_SETTINGS.md)
- [Edge Functions](./EDGE_FUNCTIONS.md)
