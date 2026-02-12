/*
  # Create Custom Invoice Statuses System

  1. New Tables
    - `custom_invoice_statuses`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `name` (text, status name)
      - `color` (text, hex color code)
      - `category` (text, optional category for grouping)
      - `sort_order` (integer, for drag-and-drop ordering)
      - `is_active` (boolean, soft delete)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `custom_invoice_statuses` table
    - Add policies for authenticated users to read
    - Add policies for company members to manage their statuses
*/

-- Create custom_invoice_statuses table
CREATE TABLE IF NOT EXISTS custom_invoice_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for company_id and sort_order
CREATE INDEX IF NOT EXISTS idx_custom_invoice_statuses_company_id
  ON custom_invoice_statuses(company_id);
CREATE INDEX IF NOT EXISTS idx_custom_invoice_statuses_sort_order
  ON custom_invoice_statuses(company_id, sort_order);

-- Enable RLS
ALTER TABLE custom_invoice_statuses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view statuses from their company
CREATE POLICY "Users can view own company statuses"
  ON custom_invoice_statuses
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert statuses for their company
CREATE POLICY "Users can create own company statuses"
  ON custom_invoice_statuses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can update statuses for their company
CREATE POLICY "Users can update own company statuses"
  ON custom_invoice_statuses
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete statuses for their company
CREATE POLICY "Users can delete own company statuses"
  ON custom_invoice_statuses
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_custom_invoice_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_custom_invoice_statuses_updated_at
  BEFORE UPDATE ON custom_invoice_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_invoice_statuses_updated_at();
