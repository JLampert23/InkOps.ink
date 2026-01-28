/*
  # Create Production Colors Table

  1. Purpose
    - Centralized table for managing company-wide ink and thread colors

  2. New Tables
    - `production_colors` with RLS policies

  3. Default Colors
    - Seed common ink and thread colors for all existing companies
*/

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

CREATE INDEX IF NOT EXISTS idx_production_colors_company_id ON production_colors(company_id);
CREATE INDEX IF NOT EXISTS idx_production_colors_type ON production_colors(type_of_work, is_active);

ALTER TABLE production_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read company production_colors"
  ON production_colors FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

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

-- Insert default colors for existing companies
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