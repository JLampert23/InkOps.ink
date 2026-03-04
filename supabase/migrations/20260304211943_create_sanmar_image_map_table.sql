/*
  # Create SanMar Image Map Table

  Permanent image cache mapping for SanMar product images downloaded from
  PromoStandards MediaContent API and stored in Supabase Storage.

  1. New Tables
    - `sanmar_image_map`
      - `id` (uuid, primary key)
      - `style` (text) - Product style number (e.g., PC54)
      - `color_name` (text) - Color name (e.g., Red, Navy)
      - `image_type` (text) - View classification (front, back, side, lifestyle, swatch, other)
      - `original_url` (text) - Original SanMar CDN URL for deduplication
      - `cdn_url` (text) - Public Supabase Storage URL
      - `storage_path` (text) - Path within the sanmar-images bucket
      - `file_size` (bigint) - File size in bytes
      - `class_type_name` (text) - PromoStandards classTypeName for reference
      - `part_id` (text) - SanMar part ID
      - `last_synced_at` (timestamptz) - When this image was last downloaded
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Composite on (style, color_name) for fast lookups
    - On original_url for deduplication
    - On style for style-level queries
    - On last_synced_at for cleanup

  3. Security
    - RLS enabled
    - Authenticated users can read all images (images are not company-specific)
    - Service role can manage all entries

  4. Notes
    - Images are NOT company-specific: SanMar product images are the same
      for all companies, so we store them once globally
    - The sanmar-images storage bucket already exists and is public
*/

CREATE TABLE IF NOT EXISTS sanmar_image_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  style text NOT NULL,
  color_name text NOT NULL DEFAULT '',
  image_type text NOT NULL DEFAULT 'other' CHECK (image_type IN ('front', 'back', 'side', 'lifestyle', 'swatch', 'other')),
  original_url text NOT NULL,
  cdn_url text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint DEFAULT 0,
  class_type_name text DEFAULT '',
  part_id text DEFAULT '',
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(style, color_name, image_type, original_url)
);

CREATE INDEX IF NOT EXISTS idx_sanmar_image_map_style
  ON sanmar_image_map (style);

CREATE INDEX IF NOT EXISTS idx_sanmar_image_map_style_color
  ON sanmar_image_map (style, color_name);

CREATE INDEX IF NOT EXISTS idx_sanmar_image_map_original_url
  ON sanmar_image_map (original_url);

CREATE INDEX IF NOT EXISTS idx_sanmar_image_map_last_synced
  ON sanmar_image_map (last_synced_at);

ALTER TABLE sanmar_image_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all sanmar images"
  ON sanmar_image_map
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages sanmar image map"
  ON sanmar_image_map
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
