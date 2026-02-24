/*
  # Add inkops_subdomain column to company_settings

  1. Changes
    - Add `inkops_subdomain` column to store the company's inkops.ink subdomain
    - This is separate from `customer_url` which stores the company's own website

  2. Notes
    - The subdomain is used to generate portal links like https://{subdomain}.inkops.ink/customer/{id}
*/

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS inkops_subdomain TEXT;

COMMENT ON COLUMN company_settings.inkops_subdomain IS 'The subdomain for this company on inkops.ink (e.g., toddssportinggoods for toddssportinggoods.inkops.ink)';