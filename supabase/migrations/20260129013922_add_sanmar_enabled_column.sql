/*
  # Add missing SanMar enabled column
  
  1. Changes
    - Add `sanmar_enabled` boolean column to `company_settings` table
    - Set default value to false
    - Set existing rows to true if they have sanmar_api_key_encrypted
  
  2. Purpose
    - Enable toggling SanMar integration on/off
    - Fix schema cache error when saving supplier integrations
*/

-- Add the missing sanmar_enabled column
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS sanmar_enabled boolean DEFAULT false;

-- Update existing rows to enable if they have credentials
UPDATE company_settings 
SET sanmar_enabled = true 
WHERE sanmar_api_key_encrypted IS NOT NULL;
