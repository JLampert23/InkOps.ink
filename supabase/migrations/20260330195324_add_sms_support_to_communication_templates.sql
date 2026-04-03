/*
  # Add SMS Support to Communication Templates

  ## Overview
  This migration adds SMS/text messaging capabilities to the communication templates system,
  enabling businesses to send quote approvals and other communications via email, SMS, or both.

  ## Changes to Existing Tables

  ### 1. communication_templates
  - Add `channel` column (text) - Specifies delivery channel: 'email', 'sms', or 'both'
  - Add `sms_body_template` column (text) - SMS-specific message template (shorter format for SMS)

  ### 2. sms_logs
  - Add `quote_id` column (uuid) - Links SMS logs to quotes for quote approval SMS tracking
  - Add `company_id` column (uuid) - Company isolation for RLS

  ## Security
  - All existing RLS policies remain intact
  - SMS logs now have proper company isolation

  ## Notes
  - SMS templates should be kept under 160 characters for single SMS
  - The channel field allows flexibility in communication preferences
  - Default channel is 'email' for backward compatibility
*/

-- Add channel column to communication_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_templates' AND column_name = 'channel'
  ) THEN
    ALTER TABLE communication_templates ADD COLUMN channel text NOT NULL DEFAULT 'email';
  END IF;
END $$;

-- Add constraint for valid channel values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_channel'
  ) THEN
    ALTER TABLE communication_templates
    ADD CONSTRAINT valid_channel CHECK (channel IN ('email', 'sms', 'both'));
  END IF;
END $$;

-- Add sms_body_template column to communication_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_templates' AND column_name = 'sms_body_template'
  ) THEN
    ALTER TABLE communication_templates ADD COLUMN sms_body_template text DEFAULT '';
  END IF;
END $$;

-- Add quote_id column to sms_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_logs' AND column_name = 'quote_id'
  ) THEN
    ALTER TABLE sms_logs ADD COLUMN quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add company_id column to sms_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE sms_logs ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for quote_id lookup on sms_logs
CREATE INDEX IF NOT EXISTS idx_sms_logs_quote_id ON sms_logs(quote_id);

-- Create index for company_id lookup on sms_logs
CREATE INDEX IF NOT EXISTS idx_sms_logs_company_id ON sms_logs(company_id);

-- Update existing RLS policies for sms_logs to use company isolation
DROP POLICY IF EXISTS "Users can read SMS logs" ON sms_logs;
DROP POLICY IF EXISTS "Users can insert SMS logs" ON sms_logs;
DROP POLICY IF EXISTS "Users can update SMS logs" ON sms_logs;

-- Policy: Users can view their company's SMS logs
CREATE POLICY "Users can view company SMS logs"
  ON sms_logs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert SMS logs for their company
CREATE POLICY "Users can insert company SMS logs"
  ON sms_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update their company's SMS logs
CREATE POLICY "Users can update company SMS logs"
  ON sms_logs
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Update default quote email templates with SMS body
UPDATE communication_templates
SET sms_body_template = 'Hi {{customer_first_name}}, your quote {{quote_number}} for {{quote_total}} is ready. Review & approve: {{quote_link}} - {{company_name}}'
WHERE template_type = 'quote_email_default'
  AND (sms_body_template IS NULL OR sms_body_template = '');

-- Update default invoice email templates with SMS body
UPDATE communication_templates
SET sms_body_template = 'Hi {{customer_first_name}}, invoice {{invoice_number}} for {{invoice_total}} is ready. View: {{invoice_link}} - {{company_name}}'
WHERE template_type = 'invoice_email_default'
  AND (sms_body_template IS NULL OR sms_body_template = '');

-- Update invoice reminder templates with SMS body
UPDATE communication_templates
SET sms_body_template = 'Reminder: Invoice {{invoice_number}} for {{invoice_balance}} is due. Pay now: {{invoice_link}} - {{company_name}}'
WHERE template_type = 'invoice_reminder'
  AND (sms_body_template IS NULL OR sms_body_template = '');

-- Add comment to updated table
COMMENT ON COLUMN communication_templates.channel IS 'Communication channel: email, sms, or both';
COMMENT ON COLUMN communication_templates.sms_body_template IS 'SMS message template with shortcodes (keep under 160 chars for single SMS)';
COMMENT ON COLUMN sms_logs.quote_id IS 'Reference to quote for quote approval SMS tracking';
COMMENT ON COLUMN sms_logs.company_id IS 'Company ID for data isolation';
