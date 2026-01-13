/*
  # Add Garment Metadata Extraction Fields to Line Items

  ## Overview
  This migration adds structured fields to store extracted garment metadata from
  Printavo's line item descriptions. Since Printavo stores all garment details
  (style, color, size breakdown) in the description field as free text, we need
  to parse and store this data in a structured format.

  ## Changes

  1. New Columns Added to printavo_line_items:
     - `extracted_style` (text) - Garment style number (e.g., "Gildan 5000", "BC3001")
     - `extracted_color` (text) - Garment color (e.g., "Black", "Heather Navy")
     - `extracted_sizes` (jsonb) - Size breakdown as JSON (e.g., {"S": 5, "M": 12, "L": 8})
     - `extracted_sku` (text) - SKU or vendor code if present
     - `extraction_notes` (text) - Notes about extraction process or unparsed content
     - `parsed_at` (timestamptz) - Timestamp when parsing was performed

  ## Implementation Notes
  - All new fields are nullable (parsing may not always succeed)
  - Original description field is preserved for reference
  - extracted_sizes uses jsonb for flexible size data storage
  - parsed_at helps track when extraction was last performed
*/

-- Add extracted garment metadata fields to printavo_line_items
ALTER TABLE printavo_line_items 
ADD COLUMN IF NOT EXISTS extracted_style text,
ADD COLUMN IF NOT EXISTS extracted_color text,
ADD COLUMN IF NOT EXISTS extracted_sizes jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS extracted_sku text,
ADD COLUMN IF NOT EXISTS extraction_notes text,
ADD COLUMN IF NOT EXISTS parsed_at timestamptz;

-- Create index on extracted_style for faster searching
CREATE INDEX IF NOT EXISTS idx_line_items_extracted_style 
ON printavo_line_items(extracted_style) 
WHERE extracted_style IS NOT NULL;

-- Create index on extracted_color for faster filtering
CREATE INDEX IF NOT EXISTS idx_line_items_extracted_color 
ON printavo_line_items(extracted_color) 
WHERE extracted_color IS NOT NULL;