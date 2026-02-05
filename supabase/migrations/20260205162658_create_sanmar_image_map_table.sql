/*
  # Create SanMar Image Mapping Table

  1. New Tables
    - `sanmar_image_map`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `style` (text) - Product style number
      - `color_code` (text) - Color identifier
      - `image_type` (text) - Type of image (front_model, back_model, front_flat, back_flat, color_swatch, thumbnail, brand_logo)
      - `original_filename` (text) - Original FTP filename
      - `cdn_url` (text) - Full CDN URL
      - `file_size` (bigint) - File size in bytes
      - `last_synced_at` (timestamptz) - Last sync timestamp
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Composite index on (company_id, style, color_code, image_type) for fast lookups
    - Index on last_synced_at for cleanup queries

  3. Security
    - Enable RLS
    - Add policies for company-isolated access
*/

-- Create the sanmar_image_map table
CREATE TABLE IF NOT EXISTS sanmar_image_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  style text NOT NULL,
  color_code text,
  image_type text NOT NULL CHECK (image_type IN (
    'front_model',
    'back_model',
    'front_flat',
    'back_flat',
    'color_swatch',
    'thumbnail',
    'brand_logo'
  )),
  original_filename text NOT NULL,
  cdn_url text NOT NULL,
  file_size bigint,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sanmar_image_map_lookup 
  ON sanmar_image_map(company_id, style, color_code, image_type);

CREATE INDEX IF NOT EXISTS idx_sanmar_image_map_style 
  ON sanmar_image_map(company_id, style);

CREATE INDEX IF NOT EXISTS idx_sanmar_image_map_sync 
  ON sanmar_image_map(last_synced_at);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_sanmar_image_map_unique 
  ON sanmar_image_map(company_id, style, COALESCE(color_code, ''), image_type, original_filename);

-- Enable RLS
ALTER TABLE sanmar_image_map ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their company's image mappings
CREATE POLICY "Users can read company image mappings"
  ON sanmar_image_map
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy: Service role can manage all image mappings
CREATE POLICY "Service role can manage image mappings"
  ON sanmar_image_map
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_sanmar_image_map_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sanmar_image_map_updated_at
  BEFORE UPDATE ON sanmar_image_map
  FOR EACH ROW
  EXECUTE FUNCTION update_sanmar_image_map_updated_at();
