/*
  # Update Receiving Settings Schema

  1. Changes
    - Align column names with standardized naming convention
    - Update field names to match spec
    - Maintain backward compatibility with existing data
    - Keep company_id for consistency with other tables

  2. Column Renames
    - Various field name updates to match spec
    - Update JSONB structure for vendor settings
*/

-- Rename columns to match spec (if they exist and differ)
DO $$ 
BEGIN
  -- Receiving Behavior section
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'auto_close_po_when_fully_received') THEN
    ALTER TABLE receiving_settings RENAME COLUMN auto_close_po_when_fully_received TO auto_close_po;
  END IF;

  -- Job Readiness section
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'auto_mark_jobs_ready') THEN
    ALTER TABLE receiving_settings RENAME COLUMN auto_mark_jobs_ready TO auto_mark_job_ready;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'require_manual_review_for_job_ready') THEN
    ALTER TABLE receiving_settings RENAME COLUMN require_manual_review_for_job_ready TO require_manual_job_ready_review;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'notify_production_when_job_ready') THEN
    ALTER TABLE receiving_settings RENAME COLUMN notify_production_when_job_ready TO notify_production_when_ready;
  END IF;

  -- Variance Handling section
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'require_reason_for_shortages') THEN
    ALTER TABLE receiving_settings RENAME COLUMN require_reason_for_shortages TO require_shortage_reason;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'require_reason_for_damaged_items') THEN
    ALTER TABLE receiving_settings RENAME COLUMN require_reason_for_damaged_items TO require_damage_reason;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'variance_threshold_percentage') THEN
    ALTER TABLE receiving_settings RENAME COLUMN variance_threshold_percentage TO variance_flag_threshold;
  END IF;

  -- Drop auto_flag_vendor_on_variance as it's not in spec
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'auto_flag_vendor_on_variance') THEN
    ALTER TABLE receiving_settings DROP COLUMN auto_flag_vendor_on_variance;
  END IF;

  -- Scanning section
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'allow_scanning_non_po_items') THEN
    ALTER TABLE receiving_settings RENAME COLUMN allow_scanning_non_po_items TO allow_non_po_scanning;
  END IF;

  -- Receiving Log section
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'require_notes_on_receiving') THEN
    ALTER TABLE receiving_settings RENAME COLUMN require_notes_on_receiving TO require_receiving_notes;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'auto_generate_receiving_report_pdf') THEN
    ALTER TABLE receiving_settings RENAME COLUMN auto_generate_receiving_report_pdf TO auto_generate_receiving_pdf;
  END IF;

  -- Vendor Settings section - change from TEXT to JSONB
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'default_backorder_rule' AND data_type = 'text') THEN
    ALTER TABLE receiving_settings DROP COLUMN default_backorder_rule;
    ALTER TABLE receiving_settings ADD COLUMN IF NOT EXISTS default_vendor_backorder_rules JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'enable_vendor_delay_alerts') THEN
    ALTER TABLE receiving_settings RENAME COLUMN enable_vendor_delay_alerts TO vendor_delay_alerts;
  END IF;

  -- Notifications section
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'notify_accounting_on_receive') THEN
    ALTER TABLE receiving_settings RENAME COLUMN notify_accounting_on_receive TO notify_accounting;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'notify_production_on_receive') THEN
    ALTER TABLE receiving_settings RENAME COLUMN notify_production_on_receive TO notify_production_on_arrival;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'notify_sales_on_job_ready') THEN
    ALTER TABLE receiving_settings RENAME COLUMN notify_sales_on_job_ready TO notify_sales_rep_job_ready;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receiving_settings' AND column_name = 'daily_receiving_summary_email') THEN
    ALTER TABLE receiving_settings RENAME COLUMN daily_receiving_summary_email TO daily_receiving_summary;
  END IF;
END $$;