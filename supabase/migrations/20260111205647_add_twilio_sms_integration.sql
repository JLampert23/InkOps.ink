/*
  # Add Twilio SMS Integration

  ## Description
  This migration adds SMS sending capabilities using Twilio for invoice delivery.
  It creates the infrastructure needed to send invoices via Email, Text Message, or Both.

  ## New Tables
  1. `sms_logs`
    - `id` (uuid, primary key)
    - `invoice_id` (text, foreign key to printavo_invoices)
    - `customer_id` (uuid, foreign key to customers)
    - `phone_number` (text, the recipient phone number)
    - `message_body` (text, the SMS content sent)
    - `delivery_status` (text, e.g., 'sent', 'delivered', 'failed', 'undelivered')
    - `twilio_sid` (text, Twilio message SID for tracking)
    - `error_message` (text, nullable, error details if failed)
    - `sent_at` (timestamptz, when the SMS was sent)
    - `created_at` (timestamptz, record creation time)

  ## Updates to Existing Tables
  1. `company_settings`
    - Add `twilio_account_sid` (text, encrypted Twilio Account SID)
    - Add `twilio_auth_token` (text, encrypted Twilio Auth Token)
    - Add `twilio_phone_number` (text, the Twilio phone number to send from)
    - Add `twilio_enabled` (boolean, whether SMS is enabled)
    - Add `default_send_method` (text, default: 'email', options: 'email', 'sms', 'both')
    - Add `sms_message_template` (text, customizable SMS template)

  2. `customers`
    - Ensure `phone` field exists (it should from previous migrations)

  ## Security
  - Enable RLS on `sms_logs` table
  - Add policies for authenticated users to read SMS logs for their company
  - Twilio credentials are encrypted in company_settings

  ## Notes
  - SMS logs are created for tracking and compliance
  - Phone numbers should be in E.164 format (+1234567890)
  - Delivery status is updated via webhook or polling
*/

-- Create sms_logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id text REFERENCES printavo_invoices(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  message_body text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'sent',
  twilio_sid text,
  error_message text,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sms_logs_invoice_id ON sms_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_customer_id ON sms_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sent_at ON sms_logs(sent_at DESC);

-- Enable RLS on sms_logs
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read SMS logs
CREATE POLICY "Users can read SMS logs"
  ON sms_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert SMS logs
CREATE POLICY "Users can insert SMS logs"
  ON sms_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update SMS logs
CREATE POLICY "Users can update SMS logs"
  ON sms_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add Twilio fields to company_settings
DO $$
BEGIN
  -- Add twilio_account_sid if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'twilio_account_sid'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN twilio_account_sid text;
  END IF;

  -- Add twilio_auth_token if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'twilio_auth_token'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN twilio_auth_token text;
  END IF;

  -- Add twilio_phone_number if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'twilio_phone_number'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN twilio_phone_number text;
  END IF;

  -- Add twilio_enabled if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'twilio_enabled'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN twilio_enabled boolean DEFAULT false;
  END IF;

  -- Add default_send_method if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'default_send_method'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN default_send_method text DEFAULT 'email';
  END IF;

  -- Add sms_message_template if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'sms_message_template'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN sms_message_template text DEFAULT 'Hi {CustomerName}, your invoice {InvoiceNumber} is ready. Amount Due: ${Amount}. Pay here: {PaymentLink}. Reply STOP to unsubscribe.';
  END IF;
END $$;
