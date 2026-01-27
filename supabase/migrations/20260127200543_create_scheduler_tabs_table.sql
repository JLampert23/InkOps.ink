/*
  # Create Scheduler Tabs Feature

  1. New Tables
    - `scheduler_tabs`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `user_id` (uuid, nullable, foreign key to user_profiles)
      - `type_of_work` (text)
      - `tab_name` (text)
      - `is_public` (boolean, default false)
      - `filters` (jsonb) - stores filter configuration
      - `sort_config` (jsonb) - stores sort order
      - `tab_order` (integer, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `scheduler_tabs` table
    - Add policy for users to read their own private tabs
    - Add policy for users to read all public tabs in their company
    - Add policy for users to create tabs
    - Add policy for users to update/delete their own tabs
    - Add policy for admins to manage all tabs

  3. Indexes
    - Index on company_id for fast lookups
    - Index on type_of_work for filtering
    - Composite index on company_id + type_of_work + tab_order for sorting
*/

-- Create scheduler_tabs table
CREATE TABLE IF NOT EXISTS scheduler_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  type_of_work text NOT NULL,
  tab_name text NOT NULL,
  is_public boolean DEFAULT false,
  filters jsonb DEFAULT '{}'::jsonb,
  sort_config jsonb DEFAULT '{}'::jsonb,
  tab_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduler_tabs_company_id ON scheduler_tabs(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_tabs_type_of_work ON scheduler_tabs(type_of_work);
CREATE INDEX IF NOT EXISTS idx_scheduler_tabs_company_work_order ON scheduler_tabs(company_id, type_of_work, tab_order);

-- Enable RLS
ALTER TABLE scheduler_tabs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own private tabs" ON scheduler_tabs;
DROP POLICY IF EXISTS "Users can read public tabs in company" ON scheduler_tabs;
DROP POLICY IF EXISTS "Users can create tabs" ON scheduler_tabs;
DROP POLICY IF EXISTS "Users can update own tabs" ON scheduler_tabs;
DROP POLICY IF EXISTS "Users can delete own tabs" ON scheduler_tabs;
DROP POLICY IF EXISTS "Admins can manage all tabs" ON scheduler_tabs;

-- Policy: Users can read their own private tabs
CREATE POLICY "Users can read own private tabs"
  ON scheduler_tabs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    AND is_public = false
  );

-- Policy: Users can read all public tabs in their company
CREATE POLICY "Users can read public tabs in company"
  ON scheduler_tabs
  FOR SELECT
  TO authenticated
  USING (
    is_public = true
    AND company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can create tabs for their company
CREATE POLICY "Users can create tabs"
  ON scheduler_tabs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy: Users can update their own tabs
CREATE POLICY "Users can update own tabs"
  ON scheduler_tabs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own tabs
CREATE POLICY "Users can delete own tabs"
  ON scheduler_tabs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Admins can manage all tabs in their company
CREATE POLICY "Admins can manage all tabs"
  ON scheduler_tabs
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_scheduler_tabs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_scheduler_tabs_updated_at ON scheduler_tabs;

CREATE TRIGGER update_scheduler_tabs_updated_at
  BEFORE UPDATE ON scheduler_tabs
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduler_tabs_updated_at();