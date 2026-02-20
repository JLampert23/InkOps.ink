/*
  # Add ShipStation Order Tracking to Invoices

  1. Changes
    - Add `shipping_status` column to printavo_invoices table
    - Add `shipstation_order_id` column to printavo_invoices table
    - Add `shipstation_order_key` column to printavo_invoices table
    - Add `shipstation_sent_at` timestamp column
    - Add index on shipstation_order_id for fast lookups

  2. Purpose
    - Track ShipStation order creation status
    - Store ShipStation order identifiers
    - Enable order sync and status updates
    - Support shipping workflow automation

  3. Security
    - No RLS changes needed (inherits existing printavo_invoices policies)
*/

-- Add ShipStation tracking columns to printavo_invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_status'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN shipping_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipstation_order_id'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN shipstation_order_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipstation_order_key'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN shipstation_order_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipstation_sent_at'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN shipstation_sent_at timestamptz;
  END IF;
END $$;

-- Add index for ShipStation order lookups
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_shipstation_order_id 
  ON printavo_invoices(shipstation_order_id) 
  WHERE shipstation_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_printavo_invoices_shipping_status 
  ON printavo_invoices(shipping_status) 
  WHERE shipping_status IS NOT NULL;

-- Add comments
COMMENT ON COLUMN printavo_invoices.shipping_status IS 'Current shipping status: pending, sent_to_shipstation, shipped, delivered, cancelled';
COMMENT ON COLUMN printavo_invoices.shipstation_order_id IS 'ShipStation order ID returned from API';
COMMENT ON COLUMN printavo_invoices.shipstation_order_key IS 'ShipStation order key (usually invoice UUID)';
COMMENT ON COLUMN printavo_invoices.shipstation_sent_at IS 'Timestamp when order was sent to ShipStation';