/*
  # Add SS Catalog Pricing Table

  ## Overview
  Adds a pricing cache table for SSActivewear products to store quantity break pricing
  from PromoStandards API, reducing API calls and enabling offline price lookups.

  ## New Table

  ### ss_catalog_pricing
  Stores pricing tiers with quantity breaks for each part
  - `id` (uuid, primary key)
  - `company_id` (uuid, for multi-tenant isolation)
  - `part_id` (uuid, FK → parts.id) - References the catalog part
  - `part_number` (text, indexed) - SS part identifier for quick lookup
  - `price_type` (text) - Type of price (e.g., 'net', 'list')
  - `currency` (text) - Currency code (default 'USD')
  - `quantity_min` (integer) - Minimum quantity for this price tier
  - `quantity_max` (integer) - Maximum quantity (null = unlimited)
  - `unit_price` (decimal) - Price per unit at this quantity
  - `discount_code` (text) - Optional discount/promo code
  - `price_effective_date` (date) - When this price becomes active
  - `price_expiry_date` (date) - When this price expires
  - `last_synced` (timestamptz) - When this price was last updated
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can view pricing for their company
  - Service role can manage all pricing (for sync operations)

  ## Indexes
  - Composite index on (company_id, part_number) for fast lookups
  - Index on part_id for joins
  - Index on (company_id, part_number, quantity_min) for tier lookups
*/

-- Create ss_catalog_pricing table
CREATE TABLE IF NOT EXISTS ss_catalog_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  part_id uuid NOT NULL,
  part_number text NOT NULL,

  price_type text DEFAULT 'net',
  currency text DEFAULT 'USD',

  quantity_min integer NOT NULL DEFAULT 1,
  quantity_max integer,
  unit_price decimal(10,2) NOT NULL,

  discount_code text,
  price_effective_date date,
  price_expiry_date date,

  last_synced timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT fk_ss_pricing_company FOREIGN KEY (company_id)
    REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT fk_ss_pricing_part FOREIGN KEY (part_id)
    REFERENCES parts(id) ON DELETE CASCADE,
  CONSTRAINT chk_ss_pricing_quantity_range CHECK (quantity_min >= 1 AND (quantity_max IS NULL OR quantity_max >= quantity_min)),
  CONSTRAINT chk_ss_pricing_unit_price CHECK (unit_price >= 0),

  UNIQUE(company_id, part_number, price_type, quantity_min)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ss_pricing_company_part ON ss_catalog_pricing(company_id, part_number);
CREATE INDEX IF NOT EXISTS idx_ss_pricing_part_id ON ss_catalog_pricing(part_id);
CREATE INDEX IF NOT EXISTS idx_ss_pricing_quantity_lookup ON ss_catalog_pricing(company_id, part_number, quantity_min);
CREATE INDEX IF NOT EXISTS idx_ss_pricing_expiry ON ss_catalog_pricing(price_expiry_date) WHERE price_expiry_date IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE ss_catalog_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view pricing for their company
CREATE POLICY "Users can view their company's SS pricing"
  ON ss_catalog_pricing FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

-- RLS Policy: Service role can manage all pricing (for sync operations)
CREATE POLICY "Service role can manage all SS pricing"
  ON ss_catalog_pricing FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_ss_pricing_updated_at
  BEFORE UPDATE ON ss_catalog_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create helper function to get pricing for a part at a specific quantity
CREATE OR REPLACE FUNCTION get_ss_part_price(
  p_company_id uuid,
  p_part_number text,
  p_quantity integer DEFAULT 1,
  p_price_type text DEFAULT 'net'
)
RETURNS decimal(10,2) AS $$
DECLARE
  v_price decimal(10,2);
BEGIN
  -- Find the best matching price tier for the quantity
  SELECT unit_price INTO v_price
  FROM ss_catalog_pricing
  WHERE company_id = p_company_id
    AND part_number = p_part_number
    AND price_type = p_price_type
    AND quantity_min <= p_quantity
    AND (quantity_max IS NULL OR quantity_max >= p_quantity)
    AND (price_expiry_date IS NULL OR price_expiry_date >= CURRENT_DATE)
  ORDER BY quantity_min DESC
  LIMIT 1;

  RETURN v_price;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;