/*
  # Add Notification Email Forwarding Settings
  
  1. Purpose
    - Enable forwarding of in-app notifications to an external email address
    - Allow companies to receive real-time email alerts for important events
  
  2. Changes
    - Add `notification_forwarding_email` (text) - Email address to forward notifications to
    - Add `notification_forwarding_enabled` (boolean) - Master toggle for email forwarding
  
  3. Security
    - Only admin users can modify these settings
    - Email validation should be performed at application level
    - No PII exposure - uses existing company_settings RLS policies
  
  4. Notes
    - Email forwarding respects existing notification type preferences
    - Failed email delivery will not block notification creation
    - Provides audit trail for notification delivery
*/

-- Add email forwarding columns to company_settings
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS notification_forwarding_email text,
ADD COLUMN IF NOT EXISTS notification_forwarding_enabled boolean DEFAULT false;

-- Add helpful comments
COMMENT ON COLUMN company_settings.notification_forwarding_email IS 'Email address to forward in-app notifications to (e.g., manager@company.com)';
COMMENT ON COLUMN company_settings.notification_forwarding_enabled IS 'Enable/disable email forwarding for all notifications';

-- Create index for quick lookups when processing notifications
CREATE INDEX IF NOT EXISTS idx_company_settings_notification_forwarding 
ON company_settings(id) 
WHERE notification_forwarding_enabled = true;
