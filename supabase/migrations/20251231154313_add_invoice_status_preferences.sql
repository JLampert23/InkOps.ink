/*
  # Add Invoice Status Preferences

  1. Changes
    - Add `available_invoice_statuses` field to track all statuses from Printavo
    - Add `selected_invoice_statuses` field to track which statuses users want to report on
    
  2. Purpose
    - Allow users to select which Printavo invoice statuses to include in AR reports
    - Provide filtering capability for exports and reporting
    
  3. Fields
    - `available_invoice_statuses`: jsonb array of all statuses available in Printavo account
    - `selected_invoice_statuses`: jsonb array of user-selected statuses for reporting
*/

-- Add columns to company_settings if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' 
    AND column_name = 'available_invoice_statuses'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN available_invoice_statuses jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' 
    AND column_name = 'selected_invoice_statuses'
  ) THEN
    ALTER TABLE company_settings 
    ADD COLUMN selected_invoice_statuses jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;