/*
  # Add Multi-Package Shipping Labels Support

  1. Changes
    - Adds `shipping_labels` JSONB column to `printavo_invoices` table
    - Default value is an empty JSON array
    - Each entry stores: label_url, tracking_number, carrier, service, shipment_id, cost

  2. Notes
    - Existing single-label fields are NOT modified
    - This is additive only - no destructive changes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'shipping_labels'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN shipping_labels JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN printavo_invoices.shipping_labels IS 'Array of shipping labels for multi-package shipments. Each entry: {label_url, tracking_number, carrier, service, shipment_id, cost}';