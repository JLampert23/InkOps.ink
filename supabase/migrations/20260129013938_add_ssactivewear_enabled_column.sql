/*
  # Add missing SSActivewear enabled column
  
  1. Changes
    - Add `ssactivewear_enabled` boolean column to `company_settings` table
    - Set default value to false
    - Set existing rows to true if they have ssactivewear_api_key_encrypted
  
  2. Purpose
    - Enable toggling SSActivewear integration on/off
    - Fix schema issue when saving supplier integrations
*/

-- Add the missing ssactivewear_enabled column
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS ssactivewear_enabled boolean DEFAULT false;

-- Update existing rows to enable if they have credentials
UPDATE company_settings 
SET ssactivewear_enabled = true 
WHERE ssactivewear_api_key_encrypted IS NOT NULL;
