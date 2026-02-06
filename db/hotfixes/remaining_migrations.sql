/*
  # Create Production Colors Table

  1. Purpose
    - Centralized table for managing company-wide ink and thread colors
    - Used by both Production Settings (InkThreadColorsManager) and Proof Builder (ColorSelectionPanel)
    - Replaces the misuse of color_stitch_options for individual colors

  2. New Tables
    - `production_colors`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `name` (text) - Color name (e.g., "Black", "Navy Blue")
      - `color_code` (text) - Hex color code (e.g., "#000000")
      - `type_of_work` (text) - "screen_printing" or "embroidery"
      - `is_active` (boolean) - Whether this color is available
      - `sort_order` (integer) - For custom ordering
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Security
    - Enable RLS on `production_colors` table
    - Add policy for authenticated users to read their company's colors
    - Add policy for admins to manage colors

  4. Default Colors
    - Seed common ink and thread colors for all existing companies
*/

-- Create the production_colors table
CREATE TABLE IF NOT EXISTS production_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  name text NOT NULL,
  color_code text NOT NULL DEFAULT '#000000',
  type_of_work text NOT NULL CHECK (type_of_work IN ('screen_printing', 'embroidery')),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_production_colors_company_id ON production_colors(company_id);
CREATE INDEX IF NOT EXISTS idx_production_colors_type ON production_colors(type_of_work, is_active);

-- Enable RLS
ALTER TABLE production_colors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read colors from their company
CREATE POLICY "Users can read company production_colors"
  ON production_colors FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Admins can insert colors for their company
CREATE POLICY "Admins can insert production_colors"
  ON production_colors FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins can update colors for their company
CREATE POLICY "Admins can update production_colors"
  ON production_colors FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins can delete colors for their company
CREATE POLICY "Admins can delete production_colors"
  ON production_colors FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Insert default ink colors for all existing companies
INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
SELECT 
  cs.id as company_id,
  color_data.name,
  color_data.code,
  'screen_printing',
  color_data.sort_order
FROM company_settings cs
CROSS JOIN (
  VALUES 
    ('Black', '#000000', 1),
    ('White', '#FFFFFF', 2),
    ('Red', '#FF0000', 3),
    ('Navy', '#000080', 4),
    ('Royal Blue', '#4169E1', 5),
    ('Light Blue', '#ADD8E6', 6),
    ('Dark Green', '#006400', 7),
    ('Kelly Green', '#4CBB17', 8),
    ('Yellow', '#FFFF00', 9),
    ('Orange', '#FFA500', 10),
    ('Purple', '#800080', 11),
    ('Maroon', '#800000', 12),
    ('Gray', '#808080', 13)
) AS color_data(name, code, sort_order)
ON CONFLICT DO NOTHING;

-- Insert default thread colors for all existing companies
INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
SELECT 
  cs.id as company_id,
  color_data.name,
  color_data.code,
  'embroidery',
  color_data.sort_order
FROM company_settings cs
CROSS JOIN (
  VALUES 
    ('Black', '#000000', 1),
    ('White', '#FFFFFF', 2),
    ('Red', '#FF0000', 3),
    ('Navy', '#000080', 4),
    ('Royal Blue', '#4169E1', 5),
    ('Light Blue', '#ADD8E6', 6),
    ('Dark Green', '#006400', 7),
    ('Kelly Green', '#4CBB17', 8),
    ('Yellow', '#FFFF00', 9),
    ('Orange', '#FFA500', 10),
    ('Purple', '#800080', 11),
    ('Maroon', '#800000', 12),
    ('Gray', '#808080', 13)
) AS color_data(name, code, sort_order)
ON CONFLICT DO NOTHING;

-- Create trigger to auto-create default colors when a new company is created
CREATE OR REPLACE FUNCTION create_default_production_colors()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default ink colors
  INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
  VALUES 
    (NEW.id, 'Black', '#000000', 'screen_printing', 1),
    (NEW.id, 'White', '#FFFFFF', 'screen_printing', 2),
    (NEW.id, 'Red', '#FF0000', 'screen_printing', 3),
    (NEW.id, 'Navy', '#000080', 'screen_printing', 4),
    (NEW.id, 'Royal Blue', '#4169E1', 'screen_printing', 5),
    (NEW.id, 'Light Blue', '#ADD8E6', 'screen_printing', 6),
    (NEW.id, 'Dark Green', '#006400', 'screen_printing', 7),
    (NEW.id, 'Kelly Green', '#4CBB17', 'screen_printing', 8),
    (NEW.id, 'Yellow', '#FFFF00', 'screen_printing', 9),
    (NEW.id, 'Orange', '#FFA500', 'screen_printing', 10),
    (NEW.id, 'Purple', '#800080', 'screen_printing', 11),
    (NEW.id, 'Maroon', '#800000', 'screen_printing', 12),
    (NEW.id, 'Gray', '#808080', 'screen_printing', 13);
  
  -- Insert default thread colors
  INSERT INTO production_colors (company_id, name, color_code, type_of_work, sort_order)
  VALUES 
    (NEW.id, 'Black', '#000000', 'embroidery', 1),
    (NEW.id, 'White', '#FFFFFF', 'embroidery', 2),
    (NEW.id, 'Red', '#FF0000', 'embroidery', 3),
    (NEW.id, 'Navy', '#000080', 'embroidery', 4),
    (NEW.id, 'Royal Blue', '#4169E1', 'embroidery', 5),
    (NEW.id, 'Light Blue', '#ADD8E6', 'embroidery', 6),
    (NEW.id, 'Dark Green', '#006400', 'embroidery', 7),
    (NEW.id, 'Kelly Green', '#4CBB17', 'embroidery', 8),
    (NEW.id, 'Yellow', '#FFFF00', 'embroidery', 9),
    (NEW.id, 'Orange', '#FFA500', 'embroidery', 10),
    (NEW.id, 'Purple', '#800080', 'embroidery', 11),
    (NEW.id, 'Maroon', '#800000', 'embroidery', 12),
    (NEW.id, 'Gray', '#808080', 'embroidery', 13);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_production_colors
  AFTER INSERT ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION create_default_production_colors();/*
  # Rename customer_locations to decoration_locations

  1. Changes
    - Rename `customer_locations` table to `decoration_locations`
    - Rename `location_name` to `decoration_name`
    - Update description to reflect garment decoration locations (e.g., "Left Front", "Full Back")
  
  2. Security
    - Maintain all existing RLS policies with updated table name
*/

-- Rename the table
ALTER TABLE IF EXISTS customer_locations RENAME TO decoration_locations;

-- Rename the column
ALTER TABLE IF EXISTS decoration_locations RENAME COLUMN location_name TO decoration_name;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their company's locations" ON decoration_locations;
DROP POLICY IF EXISTS "Users can insert their company's locations" ON decoration_locations;
DROP POLICY IF EXISTS "Users can update their company's locations" ON decoration_locations;
DROP POLICY IF EXISTS "Users can delete their company's locations" ON decoration_locations;

-- Create new policies with updated names
CREATE POLICY "Users can view their company's decoration locations"
  ON decoration_locations
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their company's decoration locations"
  ON decoration_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's decoration locations"
  ON decoration_locations
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

CREATE POLICY "Users can delete their company's decoration locations"
  ON decoration_locations
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Rename indexes
DROP INDEX IF EXISTS idx_customer_locations_company_id;
DROP INDEX IF EXISTS idx_customer_locations_is_active;

CREATE INDEX IF NOT EXISTS idx_decoration_locations_company_id ON decoration_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_decoration_locations_is_active ON decoration_locations(company_id, is_active);

-- Rename the trigger
DROP TRIGGER IF EXISTS update_customer_locations_updated_at ON decoration_locations;

CREATE TRIGGER update_decoration_locations_updated_at
  BEFORE UPDATE ON decoration_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
/*
  # Customer Artwork Library

  1. New Tables
    - `customer_artwork`
      - Stores all artwork files uploaded for customers
      - Includes file metadata, dimensions, and tags
      - Associated with customer_id for reusable artwork library
  
  2. Changes to existing tables
    - Add fields to `proof_artwork` for print location and dimensions
    - Add artwork_id reference (nullable for backwards compatibility)
  
  3. Security
    - Enable RLS on customer_artwork table
    - Policies restrict access to company_id
*/

-- Create customer_artwork table
CREATE TABLE IF NOT EXISTS customer_artwork (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  width_inches numeric,
  height_inches numeric,
  tags text[] DEFAULT '{}',
  notes text,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Add new columns to proof_artwork if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'customer_artwork_id'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN customer_artwork_id uuid REFERENCES customer_artwork(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'print_location'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN print_location text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'width_inches'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN width_inches numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'height_inches'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN height_inches numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proof_artwork' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE proof_artwork ADD COLUMN sort_order int DEFAULT 0;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_artwork_customer_id ON customer_artwork(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_artwork_company_id ON customer_artwork(company_id);
CREATE INDEX IF NOT EXISTS idx_proof_artwork_customer_artwork_id ON proof_artwork(customer_artwork_id);

-- Enable RLS on customer_artwork
ALTER TABLE customer_artwork ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_artwork
CREATE POLICY "Users can view their company's customer artwork"
  ON customer_artwork FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert customer artwork for their company"
  ON customer_artwork FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update their company's customer artwork"
  ON customer_artwork FOR UPDATE
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

CREATE POLICY "Users can delete their company's customer artwork"
  ON customer_artwork FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );/*
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
  EXECUTE FUNCTION update_work_type_workflows_updated_at();/*
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