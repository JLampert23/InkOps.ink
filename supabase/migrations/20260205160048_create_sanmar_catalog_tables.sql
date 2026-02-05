/*
  # Create SanMar Catalog Cache Tables

  1. New Tables
    - `sanmar_catalog_styles`
      - Stores master product data from SDL (Style Data Library)
      - One row per style number
    - `sanmar_catalog_products`
      - Stores individual SKUs/parts from EPDD (Enhanced Product Data Download)
      - One row per unique_key (style + color + size)
    - `sanmar_catalog_inventory`
      - Stores warehouse inventory from DIP (Daily Inventory and Pricing)
      - One row per SKU per warehouse
    - `sanmar_catalog_pricing`
      - Stores pricing tiers from DIP
      - One row per SKU per quantity break

  2. Security
    - Enable RLS on all tables
    - Allow authenticated users with company_id access

  3. Indexes
    - Add indexes on frequently queried columns
    - Add composite indexes for joins
*/

-- Create sanmar_catalog_styles table (SDL data)
CREATE TABLE IF NOT EXISTS sanmar_catalog_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  style_number text NOT NULL,
  style_name text,
  brand_name text,
  category text,
  product_description text,
  fabric_content text,
  construction text,
  weight text,
  gender text,
  fit text,
  country_of_origin text,

  is_closeout boolean DEFAULT false,
  is_new boolean DEFAULT false,
  is_active boolean DEFAULT true,

  raw_data jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(company_id, style_number)
);

-- Create sanmar_catalog_products table (EPDD data)
CREATE TABLE IF NOT EXISTS sanmar_catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  unique_key text NOT NULL,
  style_id uuid REFERENCES sanmar_catalog_styles(id) ON DELETE CASCADE,

  style_number text NOT NULL,
  color_name text,
  color_code text,
  size_name text,

  sku text,
  upc text,
  gtin text,

  piece_weight decimal(10,2),
  case_weight decimal(10,2),
  case_quantity integer,

  image_front text,
  image_back text,
  image_side text,
  image_lifestyle text,

  raw_data jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(company_id, unique_key)
);

-- Create sanmar_catalog_inventory table (DIP inventory data)
CREATE TABLE IF NOT EXISTS sanmar_catalog_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  unique_key text NOT NULL,
  product_id uuid REFERENCES sanmar_catalog_products(id) ON DELETE CASCADE,

  warehouse_code text,
  warehouse_name text,

  quantity_available integer DEFAULT 0,
  quantity_on_order integer DEFAULT 0,
  eta_date date,

  last_updated timestamptz DEFAULT now(),

  UNIQUE(company_id, unique_key, warehouse_code)
);

-- Create sanmar_catalog_pricing table (DIP pricing data)
CREATE TABLE IF NOT EXISTS sanmar_catalog_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  unique_key text NOT NULL,
  product_id uuid REFERENCES sanmar_catalog_products(id) ON DELETE CASCADE,

  price_type text,
  quantity_min integer,
  quantity_max integer,
  unit_price decimal(10,2),

  is_sale boolean DEFAULT false,
  sale_price decimal(10,2),
  sale_end_date date,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(company_id, unique_key, price_type, quantity_min)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sanmar_styles_company_style ON sanmar_catalog_styles(company_id, style_number);
CREATE INDEX IF NOT EXISTS idx_sanmar_styles_brand ON sanmar_catalog_styles(company_id, brand_name);
CREATE INDEX IF NOT EXISTS idx_sanmar_styles_category ON sanmar_catalog_styles(company_id, category);
CREATE INDEX IF NOT EXISTS idx_sanmar_styles_active ON sanmar_catalog_styles(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_sanmar_products_company_key ON sanmar_catalog_products(company_id, unique_key);
CREATE INDEX IF NOT EXISTS idx_sanmar_products_style_id ON sanmar_catalog_products(style_id);
CREATE INDEX IF NOT EXISTS idx_sanmar_products_style_number ON sanmar_catalog_products(company_id, style_number);
CREATE INDEX IF NOT EXISTS idx_sanmar_products_color ON sanmar_catalog_products(company_id, style_number, color_name);

CREATE INDEX IF NOT EXISTS idx_sanmar_inventory_company_key ON sanmar_catalog_inventory(company_id, unique_key);
CREATE INDEX IF NOT EXISTS idx_sanmar_inventory_product_id ON sanmar_catalog_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_sanmar_inventory_warehouse ON sanmar_catalog_inventory(company_id, warehouse_code);

CREATE INDEX IF NOT EXISTS idx_sanmar_pricing_company_key ON sanmar_catalog_pricing(company_id, unique_key);
CREATE INDEX IF NOT EXISTS idx_sanmar_pricing_product_id ON sanmar_catalog_pricing(product_id);

-- Enable RLS
ALTER TABLE sanmar_catalog_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanmar_catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanmar_catalog_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanmar_catalog_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sanmar_catalog_styles
CREATE POLICY "Users can view styles for their company"
  ON sanmar_catalog_styles FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Service role can manage all styles"
  ON sanmar_catalog_styles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for sanmar_catalog_products
CREATE POLICY "Users can view products for their company"
  ON sanmar_catalog_products FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Service role can manage all products"
  ON sanmar_catalog_products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for sanmar_catalog_inventory
CREATE POLICY "Users can view inventory for their company"
  ON sanmar_catalog_inventory FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Service role can manage all inventory"
  ON sanmar_catalog_inventory FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for sanmar_catalog_pricing
CREATE POLICY "Users can view pricing for their company"
  ON sanmar_catalog_pricing FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Service role can manage all pricing"
  ON sanmar_catalog_pricing FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sanmar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_sanmar_styles_updated_at
  BEFORE UPDATE ON sanmar_catalog_styles
  FOR EACH ROW
  EXECUTE FUNCTION update_sanmar_updated_at();

CREATE TRIGGER update_sanmar_products_updated_at
  BEFORE UPDATE ON sanmar_catalog_products
  FOR EACH ROW
  EXECUTE FUNCTION update_sanmar_updated_at();

CREATE TRIGGER update_sanmar_pricing_updated_at
  BEFORE UPDATE ON sanmar_catalog_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_sanmar_updated_at();
