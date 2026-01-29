/*
  # Add SanMar Account Number and Password Fields

  1. Changes
    - Add `sanmar_account_number` column to store SanMar account number
    - Add `sanmar_password_encrypted` column to store encrypted SanMar password
    - Rename `sanmar_api_key_encrypted` to be clearer (optional, keeping for backward compatibility)
  
  2. Notes
    - SanMar API requires: Account Number, Username, and Password for authentication
    - All sensitive data is encrypted before storage
*/

-- Add SanMar account number field
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS sanmar_account_number text;

-- Add SanMar password field (encrypted)
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS sanmar_password_encrypted text;
