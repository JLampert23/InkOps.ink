/*
  # Create Color/Stitch Options Table

  1. New Tables
    - `color_stitch_options`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to company_settings)
      - `option_label` (text) - Display label (e.g., "1 Color", "5000 Stitches")
      - `option_value` (text) - Stored value (e.g., "1", "5000")
      - `option_type` (text) - "color" or "stitch"
      - `sort_order` (integer) - For custom ordering
      - `is_active` (boolean) - Whether this option is available
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `color_stitch_options` table
    - Add policy for authenticated users to read their company's options
    - Add policy for admins to manage options

  3. Default Data
    - Insert common color options (1-10 colors)
    - Insert common stitch count options (1000-30000 stitches)
*/

CREATE TABLE IF NOT EXISTS color_stitch_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  option_label text NOT NULL,
  option_value text NOT NULL,
  option_type text NOT NULL CHECK (option_type IN ('color', 'stitch', 'other')),
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_color_stitch_options_company_id ON color_stitch_options(company_id);
CREATE INDEX IF NOT EXISTS idx_color_stitch_options_type ON color_stitch_options(option_type, is_active);

-- Enable RLS
ALTER TABLE color_stitch_options ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read options from their company
CREATE POLICY "Users can read company color_stitch_options"
  ON color_stitch_options FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Policy: Admins can insert options for their company
CREATE POLICY "Admins can insert color_stitch_options"
  ON color_stitch_options FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins can update options for their company
CREATE POLICY "Admins can update color_stitch_options"
  ON color_stitch_options FOR UPDATE
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

-- Policy: Admins can delete options for their company
CREATE POLICY "Admins can delete color_stitch_options"
  ON color_stitch_options FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Insert default color options for all existing companies
INSERT INTO color_stitch_options (company_id, option_label, option_value, option_type, sort_order)
SELECT 
  id,
  label,
  value,
  'color',
  sort_order
FROM company_settings
CROSS JOIN (
  VALUES 
    ('1 Color', '1', 1),
    ('2 Colors', '2', 2),
    ('3 Colors', '3', 3),
    ('4 Colors', '4', 4),
    ('5 Colors', '5', 5),
    ('6 Colors', '6', 6),
    ('7 Colors', '7', 7),
    ('8 Colors', '8', 8),
    ('9 Colors', '9', 9),
    ('10 Colors', '10', 10)
) AS colors(label, value, sort_order)
ON CONFLICT DO NOTHING;

-- Insert default stitch count options for all existing companies
INSERT INTO color_stitch_options (company_id, option_label, option_value, option_type, sort_order)
SELECT 
  id,
  label,
  value,
  'stitch',
  sort_order
FROM company_settings
CROSS JOIN (
  VALUES 
    ('1,000 Stitches', '1000', 101),
    ('2,500 Stitches', '2500', 102),
    ('5,000 Stitches', '5000', 103),
    ('7,500 Stitches', '7500', 104),
    ('10,000 Stitches', '10000', 105),
    ('12,500 Stitches', '12500', 106),
    ('15,000 Stitches', '15000', 107),
    ('20,000 Stitches', '20000', 108),
    ('25,000 Stitches', '25000', 109),
    ('30,000 Stitches', '30000', 110)
) AS stitches(label, value, sort_order)
ON CONFLICT DO NOTHING;

-- Create trigger to auto-create default options when a new company is created
CREATE OR REPLACE FUNCTION create_default_color_stitch_options()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default color options
  INSERT INTO color_stitch_options (company_id, option_label, option_value, option_type, sort_order)
  VALUES 
    (NEW.id, '1 Color', '1', 'color', 1),
    (NEW.id, '2 Colors', '2', 'color', 2),
    (NEW.id, '3 Colors', '3', 'color', 3),
    (NEW.id, '4 Colors', '4', 'color', 4),
    (NEW.id, '5 Colors', '5', 'color', 5),
    (NEW.id, '6 Colors', '6', 'color', 6),
    (NEW.id, '7 Colors', '7', 'color', 7),
    (NEW.id, '8 Colors', '8', 'color', 8),
    (NEW.id, '9 Colors', '9', 'color', 9),
    (NEW.id, '10 Colors', '10', 'color', 10);
  
  -- Insert default stitch count options
  INSERT INTO color_stitch_options (company_id, option_label, option_value, option_type, sort_order)
  VALUES 
    (NEW.id, '1,000 Stitches', '1000', 'stitch', 101),
    (NEW.id, '2,500 Stitches', '2500', 'stitch', 102),
    (NEW.id, '5,000 Stitches', '5000', 'stitch', 103),
    (NEW.id, '7,500 Stitches', '7500', 'stitch', 104),
    (NEW.id, '10,000 Stitches', '10000', 'stitch', 105),
    (NEW.id, '12,500 Stitches', '12500', 'stitch', 106),
    (NEW.id, '15,000 Stitches', '15000', 'stitch', 107),
    (NEW.id, '20,000 Stitches', '20000', 'stitch', 108),
    (NEW.id, '25,000 Stitches', '25000', 'stitch', 109),
    (NEW.id, '30,000 Stitches', '30000', 'stitch', 110);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_color_stitch_options
  AFTER INSERT ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION create_default_color_stitch_options();