/*
  # Add box_label_layout column to company_settings

  ## Summary
  Adds a JSONB column `box_label_layout` to `company_settings` to store
  the ordered layout configuration for box labels, including element order,
  visibility, font sizes (for text fields), and dimensions (for logo/QR code).

  ## Changes
  - `company_settings`: adds `box_label_layout` (jsonb, nullable)
    - Stores an array of BoxLabelElement objects
    - Each element has: id, order, visible, fontSize (pt), width (in), height (in)
    - NULL means use legacy individual boolean columns (backwards compatible)

  ## Notes
  - Non-destructive: existing boolean columns are preserved
  - When layout is present it takes precedence over individual boolean columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'box_label_layout'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN box_label_layout jsonb DEFAULT NULL;
  END IF;
END $$;
