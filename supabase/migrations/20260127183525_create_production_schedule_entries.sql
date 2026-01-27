/*
  # Create Production Schedule Entries Table

  1. New Tables
    - `production_schedule_entries`
      - `id` (uuid, primary key) - Unique identifier
      - `company_id` (uuid) - Company isolation
      - `quote_id` (uuid) - Reference to original quote
      - `line_item_id` (uuid) - Reference to quote line item
      - `imprint_id` (uuid) - Reference to quote imprint
      - `type_of_work` (text) - Type of work (e.g., "Screen Printing", "Embroidery")
      - `imprint_number` (text) - Display number for the imprint
      - `artwork_thumb_url` (text) - URL to artwork thumbnail
      - `production_due_date` (date) - Scheduled production date
      - `station` (text) - Assigned production station
      - `quantity` (int) - Number of items for this decoration
      - `step_statuses` (jsonb) - Current status for each workflow step
      - `priority_order` (int) - Order within the same day/station
      - `customer_name` (text) - Cached customer name for filtering
      - `quote_number` (text) - Cached quote number for filtering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `production_schedule_entries` table
    - Add policies for company-isolated access
    - Production users can view and update their company's schedule
*/

CREATE TABLE IF NOT EXISTS production_schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  line_item_id uuid REFERENCES quote_line_items(id) ON DELETE CASCADE,
  imprint_id uuid REFERENCES quote_imprints(id) ON DELETE CASCADE,
  type_of_work text NOT NULL,
  imprint_number text,
  artwork_thumb_url text,
  production_due_date date NOT NULL,
  station text,
  quantity int NOT NULL DEFAULT 0,
  step_statuses jsonb DEFAULT '{}'::jsonb,
  priority_order int DEFAULT 0,
  customer_name text,
  quote_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedule_entries_company_id ON production_schedule_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_type_of_work ON production_schedule_entries(company_id, type_of_work);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_due_date ON production_schedule_entries(company_id, production_due_date);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_station ON production_schedule_entries(company_id, station);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_quote_id ON production_schedule_entries(quote_id);

-- Enable RLS
ALTER TABLE production_schedule_entries ENABLE ROW LEVEL SECURITY;

-- Policy for viewing schedule entries
CREATE POLICY "Users can view their company schedule entries"
  ON production_schedule_entries
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for creating schedule entries
CREATE POLICY "Users can create schedule entries for their company"
  ON production_schedule_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy for updating schedule entries
CREATE POLICY "Users can update their company schedule entries"
  ON production_schedule_entries
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

-- Policy for deleting schedule entries
CREATE POLICY "Users can delete their company schedule entries"
  ON production_schedule_entries
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_schedule_entry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schedule_entry_timestamp
  BEFORE UPDATE ON production_schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_schedule_entry_updated_at();