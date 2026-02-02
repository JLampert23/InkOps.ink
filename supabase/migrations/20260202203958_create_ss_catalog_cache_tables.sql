/*
  # Create S&S Catalog Cache Tables

  ## Overview
  Creates four tables to store a complete cached S&S Activewear catalog for faster lookups
  and reduced API calls. Includes proper multi-tenant isolation and indexing.

  ## New Tables

  ### 1. styles
  Stores high-level style information (products)
  - `id` (uuid, primary key)
  - `company_id` (uuid, for multi-tenant isolation)
  - `style_number` (text, indexed) - S&S style identifier
  - `brand` (text) - Brand name
  - `name` (text) - Product name
  - `description` (text) - Product description
  - `category` (text) - Product category
  - `primary_image` (text) - URL to primary product image
  - `last_synced` (timestamptz) - When this style was last updated
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. parts
  Stores individual SKUs/variants (color + size combinations)
  - `id` (uuid, primary key)
  - `company_id` (uuid, for multi-tenant isolation)
  - `style_id` (uuid, FK → styles.id)
  - `part_id` (text, indexed) - S&S part identifier
  - `color_name` (text) - Color name
  - `hex` (text) - Hex color code
  - `size` (text) - Size (S, M, L, XL, etc.)
  - `weight` (numeric) - Weight in ounces
  - `gtin` (text) - GTIN/UPC code
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. inventory
  Stores real-time inventory quantities per warehouse
  - `id` (uuid, primary key)
  - `company_id` (uuid, for multi-tenant isolation)
  - `part_id` (uuid, FK → parts.id)
  - `warehouse` (text) - Warehouse identifier
  - `quantity` (integer) - Available quantity
  - `updated_at` (timestamptz) - Last inventory update

  ### 4. images
  Stores all product images (front, back, side, lifestyle, etc.)
  - `id` (uuid, primary key)
  - `company_id` (uuid, for multi-tenant isolation)
  - `part_id` (uuid, FK → parts.id)
  - `class_type` (text) - Image type (Front, Rear, Side, Lifestyle)
  - `url` (text) - Image URL
  - `size` (text) - Image size code (fs=small, fm=medium, fl=large)
  - `color` (text) - Color identifier
  - `single_part` (boolean) - Whether image is for single part or all
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - All tables isolated by company_id
  - Authenticated users can read/write their company's catalog data

  ## Indexes
  - styles: style_number, company_id
  - parts: part_id, style_id, company_id
  - inventory: part_id, warehouse, company_id
  - images: part_id, class_type, company_id
*/

-- Create styles table
CREATE TABLE IF NOT EXISTS styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  style_number text NOT NULL,
  brand text,
  name text,
  description text,
  category text,
  primary_image text,
  last_synced timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_styles_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE
);

-- Create parts table
CREATE TABLE IF NOT EXISTS parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  style_id uuid NOT NULL,
  part_id text NOT NULL,
  color_name text,
  hex text,
  size text,
  weight numeric,
  gtin text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_parts_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_parts_style FOREIGN KEY (style_id) 
    REFERENCES styles(id) ON DELETE CASCADE
);

-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  part_id uuid NOT NULL,
  warehouse text,
  quantity integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT fk_inventory_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_part FOREIGN KEY (part_id) 
    REFERENCES parts(id) ON DELETE CASCADE
);

-- Create images table
CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  part_id uuid NOT NULL,
  class_type text,
  url text,
  size text,
  color text,
  single_part boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_images_company FOREIGN KEY (company_id) 
    REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_images_part FOREIGN KEY (part_id) 
    REFERENCES parts(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_styles_style_number ON styles(style_number);
CREATE INDEX IF NOT EXISTS idx_styles_company_id ON styles(company_id);
CREATE INDEX IF NOT EXISTS idx_styles_category ON styles(category);

CREATE INDEX IF NOT EXISTS idx_parts_part_id ON parts(part_id);
CREATE INDEX IF NOT EXISTS idx_parts_style_id ON parts(style_id);
CREATE INDEX IF NOT EXISTS idx_parts_company_id ON parts(company_id);

CREATE INDEX IF NOT EXISTS idx_inventory_part_id ON inventory(part_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory(warehouse);
CREATE INDEX IF NOT EXISTS idx_inventory_company_id ON inventory(company_id);

CREATE INDEX IF NOT EXISTS idx_images_part_id ON images(part_id);
CREATE INDEX IF NOT EXISTS idx_images_class_type ON images(class_type);
CREATE INDEX IF NOT EXISTS idx_images_company_id ON images(company_id);

-- Enable Row Level Security
ALTER TABLE styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- RLS Policies for styles table
CREATE POLICY "Users can view their company's styles"
  ON styles FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert their company's styles"
  ON styles FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their company's styles"
  ON styles FOR UPDATE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete their company's styles"
  ON styles FOR DELETE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- RLS Policies for parts table
CREATE POLICY "Users can view their company's parts"
  ON parts FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert their company's parts"
  ON parts FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their company's parts"
  ON parts FOR UPDATE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete their company's parts"
  ON parts FOR DELETE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- RLS Policies for inventory table
CREATE POLICY "Users can view their company's inventory"
  ON inventory FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert their company's inventory"
  ON inventory FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their company's inventory"
  ON inventory FOR UPDATE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete their company's inventory"
  ON inventory FOR DELETE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- RLS Policies for images table
CREATE POLICY "Users can view their company's images"
  ON images FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert their company's images"
  ON images FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their company's images"
  ON images FOR UPDATE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete their company's images"
  ON images FOR DELETE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_styles_updated_at
  BEFORE UPDATE ON styles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parts_updated_at
  BEFORE UPDATE ON parts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
