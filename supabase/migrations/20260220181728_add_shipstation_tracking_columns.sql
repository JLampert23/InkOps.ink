/*
  # Add ShipStation Tracking Columns to Invoices

  1. Changes
    - Add `tracking_number` column to printavo_invoices
    - Add `carrier` column to printavo_invoices
    - Add `service` column to printavo_invoices
    - Add `shipped_at` timestamp column
    - Add `delivered_at` timestamp column
    - Add indexes for tracking lookups

  2. Purpose
    - Store shipment tracking information from ShipStation webhooks
    - Support customer shipment tracking queries
    - Enable delivery status monitoring

  3. Security
    - No RLS changes needed (inherits existing printavo_invoices policies)
*/

-- Add tracking columns to printavo_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN tracking_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'carrier'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN carrier text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'service'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN service text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipped_at'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN shipped_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN delivered_at timestamptz;
  END IF;
END $$;

-- Add indexes for tracking lookups
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_tracking_number 
  ON printavo_invoices(tracking_number) 
  WHERE tracking_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_printavo_invoices_carrier 
  ON printavo_invoices(carrier) 
  WHERE carrier IS NOT NULL;

-- Add comments
COMMENT ON COLUMN printavo_invoices.tracking_number IS 'Shipment tracking number from carrier';
COMMENT ON COLUMN printavo_invoices.carrier IS 'Shipping carrier code (e.g., fedex, ups, usps)';
COMMENT ON COLUMN printavo_invoices.service IS 'Shipping service level (e.g., ground, express, priority)';
COMMENT ON COLUMN printavo_invoices.shipped_at IS 'Timestamp when shipment was dispatched';
COMMENT ON COLUMN printavo_invoices.delivered_at IS 'Timestamp when shipment was delivered';
