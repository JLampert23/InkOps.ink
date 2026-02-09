/*
  # Add Change Tracking for Garment Requirements

  1. Schema Changes
    - Add `requires_review` column to flag items changed after PO creation
    - Add `change_reason` column to explain why review is needed
    - Add `original_data` column to store pre-change data for comparison

  2. Purpose
    - Track when garment requirements change after being added to a PO
    - Prevent automatic deletion of items already on purchase orders
    - Require manual review when changes affect existing POs
    - Preserve audit trail of what changed
*/

-- Add new columns for change tracking
ALTER TABLE garment_requirements_staging
ADD COLUMN IF NOT EXISTS requires_review boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS change_reason text,
ADD COLUMN IF NOT EXISTS original_data jsonb;

-- Create index for items requiring review
CREATE INDEX IF NOT EXISTS idx_garment_requirements_needs_review
ON garment_requirements_staging(company_id, requires_review)
WHERE requires_review = true;

-- Add comment explaining the columns
COMMENT ON COLUMN garment_requirements_staging.requires_review IS 'Set to true when garment details change after being added to a PO';
COMMENT ON COLUMN garment_requirements_staging.change_reason IS 'Explanation of what changed (e.g., "Quote edited after PO created")';
COMMENT ON COLUMN garment_requirements_staging.original_data IS 'Snapshot of data before change for comparison';
