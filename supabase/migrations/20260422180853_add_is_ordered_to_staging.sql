-- Add is_ordered tracking to garment_requirements_staging
ALTER TABLE garment_requirements_staging
  ADD COLUMN IF NOT EXISTS is_ordered boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordered_at timestamptz,
  ADD COLUMN IF NOT EXISTS ordered_by text;
