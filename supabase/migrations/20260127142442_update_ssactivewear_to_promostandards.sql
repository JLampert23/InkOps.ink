/*
  # Update SSActivewear to PromoStandards Integration

  1. Changes
    - Update `integration_settings` table to support PromoStandards
    - Change ssactivewear_credentials structure to store:
      - accountNumber: SSActivewear account number
      - apiKey: PromoStandards API key
      - version: PromoStandards version (2.0.0)
    
  2. Notes
    - This migration maintains backward compatibility
    - Old credentials will need to be re-entered
    - PromoStandards uses XML-based SOAP APIs
*/

-- No schema changes needed - the existing jsonb field supports the new structure
-- Companies will need to re-enter their credentials in the new format:
-- {
--   "accountNumber": "YOUR_ACCOUNT_NUMBER",
--   "apiKey": "YOUR_API_KEY"
-- }

-- Add comment to document the new structure
COMMENT ON COLUMN integration_settings.ssactivewear_credentials IS 
  'PromoStandards credentials stored as JSON: {"accountNumber": "...", "apiKey": "..."}';