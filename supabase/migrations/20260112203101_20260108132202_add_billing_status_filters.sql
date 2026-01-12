/*
  # Add Billing Status Filters

  1. Changes
    - Add `billing_selected_invoice_statuses` column to `company_settings` table
    - This allows separate status filtering for the Billing & Payments section
    - Defaults to empty array to maintain existing behavior

  2. Purpose
    - Enable independent filtering for Printavo Dashboard and Billing & Payments sections
    - Each section can now have its own set of visible invoice statuses
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'billing_selected_invoice_statuses'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN billing_selected_invoice_statuses text[] DEFAULT '{}';
  END IF;
END $$;