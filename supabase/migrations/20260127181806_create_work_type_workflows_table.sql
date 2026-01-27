/*
  # Create Work Type Workflows Table

  1. New Tables
    - `work_type_workflows`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `work_type_id` (uuid, foreign key to type_of_work_settings)
      - `steps` (jsonb) - array of step objects with statuses
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `work_type_workflows` table
    - Add policies for authenticated users in same company

  3. Indexes
    - Index on work_type_id for fast lookups
    - Index on company_id for multi-tenant isolation

  4. Example steps JSON structure:
    [
      {
        "step_name": "Production",
        "statuses": [
          { "name": "Not Started", "color": "#CCCCCC" },
          { "name": "In Progress", "color": "#FFA500" },
          { "name": "Complete", "color": "#00CC66" }
        ]
      },
      {
        "step_name": "Shipping",
        "statuses": [
          { "name": "Packed", "color": "#3399FF" },
          { "name": "Shipped", "color": "#6666FF" }
        ]
      }
    ]
*/

CREATE TABLE IF NOT EXISTS work_type_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  work_type_id uuid NOT NULL REFERENCES type_of_work_settings(id) ON DELETE CASCADE,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(work_type_id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_work_type_workflows_work_type_id ON work_type_workflows(work_type_id);
CREATE INDEX IF NOT EXISTS idx_work_type_workflows_company_id ON work_type_workflows(company_id);

-- Enable RLS
ALTER TABLE work_type_workflows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view workflows in their company
CREATE POLICY "Users can view workflows in their company"
  ON work_type_workflows
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert workflows in their company
CREATE POLICY "Users can insert workflows in their company"
  ON work_type_workflows
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can update workflows in their company
CREATE POLICY "Users can update workflows in their company"
  ON work_type_workflows
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

-- Policy: Users can delete workflows in their company
CREATE POLICY "Users can delete workflows in their company"
  ON work_type_workflows
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_type_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_work_type_workflows_updated_at
  BEFORE UPDATE ON work_type_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_work_type_workflows_updated_at();