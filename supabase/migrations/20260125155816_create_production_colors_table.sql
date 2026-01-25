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
  EXECUTE FUNCTION create_default_production_colors();