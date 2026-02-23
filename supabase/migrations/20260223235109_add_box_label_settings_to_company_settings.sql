/*
  # Add Box Label Settings to Company Settings

  1. New Columns
    - `box_label_logo_choice` (text) - 'primary' or 'secondary', defaults to 'primary'
    - `box_label_show_work_order_number` (boolean) - Show WO number on label, default true
    - `box_label_show_customer_name` (boolean) - Show customer name on label, default true
    - `box_label_show_due_date` (boolean) - Show due date on label, default true
    - `box_label_show_type_of_work` (boolean) - Show type of work on label, default true
    - `box_label_show_imprint_types` (boolean) - Show imprint types list on label, default true
    - `box_label_show_job_nickname` (boolean) - Show job nickname on label, default true

  2. Notes
    - All settings default to true for backwards compatibility
    - Logo choice defaults to 'primary' to use the primary company logo
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'box_label_logo_choice'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN box_label_logo_choice text DEFAULT 'primary';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'box_label_show_work_order_number'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN box_label_show_work_order_number boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'box_label_show_customer_name'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN box_label_show_customer_name boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'box_label_show_due_date'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN box_label_show_due_date boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'box_label_show_type_of_work'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN box_label_show_type_of_work boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'box_label_show_imprint_types'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN box_label_show_imprint_types boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'box_label_show_job_nickname'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN box_label_show_job_nickname boolean DEFAULT true;
  END IF;
END $$;
