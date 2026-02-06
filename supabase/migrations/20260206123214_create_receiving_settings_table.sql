/*
  # Create Receiving Settings Table

  1. New Tables
    - `receiving_settings`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - Receiving Behavior fields
      - Job Readiness Rules fields
      - Variance Handling fields
      - Barcode/Scanning Settings fields
      - Receiving Log Settings fields
      - Vendor Settings fields
      - Notifications fields
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `receiving_settings` table
    - Add policies for authenticated users in same company
*/

CREATE TABLE IF NOT EXISTS receiving_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- SECTION 1: RECEIVING BEHAVIOR
  allow_partial_receiving boolean DEFAULT true,
  allow_over_receiving boolean DEFAULT false,
  require_vendor_confirmation boolean DEFAULT false,
  auto_close_po_when_fully_received boolean DEFAULT true,
  
  -- SECTION 2: JOB READINESS RULES
  auto_mark_jobs_ready boolean DEFAULT true,
  require_manual_review_for_job_ready boolean DEFAULT false,
  notify_production_when_job_ready boolean DEFAULT true,
  
  -- SECTION 3: VARIANCE HANDLING
  require_reason_for_shortages boolean DEFAULT true,
  require_reason_for_damaged_items boolean DEFAULT true,
  variance_threshold_percentage numeric(5,2) DEFAULT 5.00,
  auto_flag_vendor_on_variance boolean DEFAULT true,
  variance_approval_required boolean DEFAULT false,
  
  -- SECTION 4: BARCODE/SCANNING SETTINGS
  enable_barcode_scanning boolean DEFAULT false,
  scan_mode text DEFAULT 'increment' CHECK (scan_mode IN ('increment', 'replace', 'prompt')),
  allow_scanning_non_po_items boolean DEFAULT false,
  
  -- SECTION 5: RECEIVING LOG SETTINGS
  track_receiving_user boolean DEFAULT true,
  track_receiving_timestamp boolean DEFAULT true,
  require_notes_on_receiving boolean DEFAULT false,
  auto_generate_receiving_report_pdf boolean DEFAULT false,
  
  -- SECTION 6: VENDOR SETTINGS (RECEIVING-SPECIFIC)
  default_vendor_lead_times jsonb DEFAULT '{}'::jsonb,
  default_backorder_rule text DEFAULT 'hold' CHECK (default_backorder_rule IN ('auto_split', 'hold', 'auto_cancel')),
  enable_vendor_delay_alerts boolean DEFAULT true,
  
  -- SECTION 7: NOTIFICATIONS
  notify_accounting_on_receive boolean DEFAULT true,
  notify_production_on_receive boolean DEFAULT true,
  notify_sales_on_job_ready boolean DEFAULT false,
  daily_receiving_summary_email boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one settings record per company
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE receiving_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view receiving settings for their company
CREATE POLICY "Users can view receiving settings for their company"
  ON receiving_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users with admin or super_admin role can update receiving settings
CREATE POLICY "Admins can update receiving settings for their company"
  ON receiving_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Admins can insert receiving settings for their company
CREATE POLICY "Admins can insert receiving settings for their company"
  ON receiving_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_receiving_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receiving_settings_updated_at
  BEFORE UPDATE ON receiving_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_receiving_settings_updated_at();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_receiving_settings_company_id ON receiving_settings(company_id);