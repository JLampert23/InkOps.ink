/*
  # Add City, State, Zip columns to company_settings

  1. New Columns
    - `company_city` (text) - Company city for address display on PDFs
    - `company_state` (text) - Company state for address display on PDFs
    - `company_zip` (text) - Company zip code for address display on PDFs

  2. Purpose
    - Enables proper company address formatting on Quote and Work Order PDFs
    - Separates address components for flexible formatting
*/

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS company_city text,
ADD COLUMN IF NOT EXISTS company_state text,
ADD COLUMN IF NOT EXISTS company_zip text;
