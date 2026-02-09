/*
  # Create SanMar FTP Unified Garments Table

  1. New Tables
    - `sanmar_ftp_unified_garments`
      - Stores normalized garment data from all SanMar FTP files
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `unique_key` (text, unique identifier for garment)
      - `inventory_key` (text, inventory identifier)
      - `size_index` (integer, size ordering)
      - `style` (text, style number)
      - `color` (text, color name)
      - `size` (text, size label)
      - `product_title` (text)
      - `description` (text)
      - `extended_description` (text)
      - `category` (text)
      - `subcategory` (text)
      - `msrp` (numeric, manufacturer suggested retail price)
      - `map_pricing` (numeric, minimum advertised price)
      - `piece_price` (numeric, individual piece price)
      - `case_price` (numeric, case price)
      - `weight` (numeric, weight in oz)
      - `qty` (integer, available quantity)
      - `gtin` (text, global trade item number)
      - `images` (jsonb, image URLs)
      - `source_file` (text, which file this data came from)
      - `last_synced` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `sanmar_ftp_sync_log`
      - Tracks FTP sync operations
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `sync_started` (timestamptz)
      - `sync_completed` (timestamptz)
      - `status` (text: pending, in_progress, completed, failed)
      - `files_downloaded` (jsonb, list of files)
      - `records_processed` (integer)
      - `error_message` (text)

  2. Security
    - Enable RLS on both tables
    - Add policies for company-isolated access
*/

-- Create unified garments table
CREATE TABLE IF NOT EXISTS sanmar_ftp_unified_garments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  unique_key text NOT NULL,
  inventory_key text,
  size_index integer,
  style text NOT NULL,
  color text,
  size text,
  product_title text,
  description text,
  extended_description text,
  category text,
  subcategory text,
  msrp numeric(10, 2),
  map_pricing numeric(10, 2),
  piece_price numeric(10, 2),
  case_price numeric(10, 2),
  weight numeric(10, 2),
  qty integer DEFAULT 0,
  gtin text,
  images jsonb DEFAULT '{}'::jsonb,
  source_file text,
  last_synced timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, unique_key)
);

-- Create sync log table
CREATE TABLE IF NOT EXISTS sanmar_ftp_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sync_started timestamptz DEFAULT now(),
  sync_completed timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  files_downloaded jsonb DEFAULT '[]'::jsonb,
  records_processed integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sanmar_ftp_garments_company_id ON sanmar_ftp_unified_garments(company_id);
CREATE INDEX IF NOT EXISTS idx_sanmar_ftp_garments_style ON sanmar_ftp_unified_garments(style);
CREATE INDEX IF NOT EXISTS idx_sanmar_ftp_garments_unique_key ON sanmar_ftp_unified_garments(unique_key);
CREATE INDEX IF NOT EXISTS idx_sanmar_ftp_garments_last_synced ON sanmar_ftp_unified_garments(last_synced);
CREATE INDEX IF NOT EXISTS idx_sanmar_ftp_sync_log_company_id ON sanmar_ftp_sync_log(company_id);
CREATE INDEX IF NOT EXISTS idx_sanmar_ftp_sync_log_status ON sanmar_ftp_sync_log(status);

-- Enable RLS
ALTER TABLE sanmar_ftp_unified_garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanmar_ftp_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for unified garments
CREATE POLICY "Users can view garments in their company"
  ON sanmar_ftp_unified_garments FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all garments"
  ON sanmar_ftp_unified_garments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for sync log
CREATE POLICY "Users can view sync logs in their company"
  ON sanmar_ftp_sync_log FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all sync logs"
  ON sanmar_ftp_sync_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sanmar_ftp_garments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_sanmar_ftp_garments_updated_at_trigger ON sanmar_ftp_unified_garments;
CREATE TRIGGER update_sanmar_ftp_garments_updated_at_trigger
  BEFORE UPDATE ON sanmar_ftp_unified_garments
  FOR EACH ROW
  EXECUTE FUNCTION update_sanmar_ftp_garments_updated_at();
