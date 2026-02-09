/*
  # Create SanMar Inventory Cache Table

  1. New Tables
    - `sanmar_inventory_cache`
      - Stores cached PromoStandards Inventory API responses
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `cache_key` (text, unique identifier for cached inventory)
      - `cache_type` (text, type of cache: inventory, date_modified)
      - `data` (jsonb, cached inventory data with normalized fields)
      - `created_at` (timestamptz, when cache was created)
      - `expires_at` (timestamptz, when cache expires - 1 hour)
      - `updated_at` (timestamptz, last update time)

  2. Security
    - Enable RLS on table
    - Add policies for company-isolated access
    - Service role can manage all cache entries

  3. Performance
    - Index on company_id and cache_key for fast lookups
    - Index on expires_at for cleanup operations
    - Composite unique index for company_id + cache_key

  4. Notes
    - 1-hour cache duration for inventory data (changes frequently)
    - Automatic cleanup function for expired entries
    - Supports normalized inventory fields: inventoryLevels, totalAvailable
*/

-- Create inventory cache table
CREATE TABLE IF NOT EXISTS sanmar_inventory_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  cache_type text NOT NULL CHECK (cache_type IN ('inventory', 'date_modified')),
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, cache_key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sanmar_inventory_cache_company_id ON sanmar_inventory_cache(company_id);
CREATE INDEX IF NOT EXISTS idx_sanmar_inventory_cache_cache_key ON sanmar_inventory_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_sanmar_inventory_cache_expires_at ON sanmar_inventory_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_sanmar_inventory_cache_cache_type ON sanmar_inventory_cache(cache_type);
CREATE INDEX IF NOT EXISTS idx_sanmar_inventory_cache_company_key ON sanmar_inventory_cache(company_id, cache_key);

-- Enable RLS
ALTER TABLE sanmar_inventory_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view inventory cache in their company"
  ON sanmar_inventory_cache FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all inventory cache entries"
  ON sanmar_inventory_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sanmar_inventory_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_sanmar_inventory_cache_updated_at_trigger ON sanmar_inventory_cache;
CREATE TRIGGER update_sanmar_inventory_cache_updated_at_trigger
  BEFORE UPDATE ON sanmar_inventory_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_sanmar_inventory_cache_updated_at();

-- Create function to clean expired inventory cache entries
CREATE OR REPLACE FUNCTION clean_expired_sanmar_inventory_cache()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM sanmar_inventory_cache
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;