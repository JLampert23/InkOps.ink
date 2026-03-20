/*
  # Add partId Index to SanMar Image Map

  Adds an index on part_id column for efficient partId-based image lookups.
  This ensures that images can be quickly matched to specific product variants
  by their unique SanMar part identifier.

  1. Indexes
    - Add index on part_id for fast partId-based lookups
    - Add composite index on (style, part_id) for variant-specific queries
    
  2. Notes
    - partId is the primary key for matching images to specific color/size variants
    - Each MediaContent entry from PromoStandards API includes a partId
    - Using partId ensures images match the exact product variant
*/

-- Add index on part_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sanmar_image_map_part_id
  ON sanmar_image_map (part_id);

-- Add composite index for style + part_id queries
CREATE INDEX IF NOT EXISTS idx_sanmar_image_map_style_part_id
  ON sanmar_image_map (style, part_id);
