/*
  # Add Company-Level Default Garment Markup

  1. New Columns
    - `default_garment_markup` (numeric 10,2, default 0.00)
      - Stores the default percentage markup applied to wholesale garment prices
      - 0 = no markup (sell at cost)
      - 50 = 50% markup (1.5x wholesale)
      - 100 = 100% markup (2x wholesale)

  2. Purpose
    - Centralizes garment markup at the company level
    - Replaces per-matrix product_markup_percentage
    - Used by calculate_garment_cost_with_markup() SQL function

  3. Migration Safety
    - Uses IF NOT EXISTS to prevent errors on re-run
    - Sets sensible default of 0% (no markup)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'default_garment_markup'
  ) THEN
    ALTER TABLE company_settings
    ADD COLUMN default_garment_markup numeric(10,2) NOT NULL DEFAULT 0.00;
  END IF;
END $$;

COMMENT ON COLUMN company_settings.default_garment_markup IS 'Default percentage markup applied to wholesale garment prices. 0 = no markup, 50 = 1.5x, 100 = 2x';
