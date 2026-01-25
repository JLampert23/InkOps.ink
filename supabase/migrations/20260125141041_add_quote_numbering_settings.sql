/*
  # Add Quote Numbering Settings

  This migration adds quote numbering configuration to company_settings table,
  similar to the existing invoice numbering system.

  ## Changes
  
  1. New Columns
    - `use_quote_prefix` (boolean) - Whether to use a prefix for quote numbers
    - `quote_prefix` (text) - Optional prefix for quote numbers (e.g., "Q-")
    - `quote_start_number` (integer) - Starting number for sequential quote numbering
  
  2. Default Values
    - use_quote_prefix: false
    - quote_prefix: ''
    - quote_start_number: 1

  ## Notes
  - These settings allow companies to configure custom quote numbering schemes
  - Quote numbers will follow the format: [prefix][sequential_number]
  - Example: "Q-1001", "Q-1002", etc. or "1001", "1002" without prefix
*/

-- Add quote numbering columns to company_settings
ALTER TABLE company_settings 
  ADD COLUMN IF NOT EXISTS use_quote_prefix boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quote_prefix text DEFAULT '',
  ADD COLUMN IF NOT EXISTS quote_start_number integer DEFAULT 1;

-- Update existing rows to have default values
UPDATE company_settings 
SET 
  use_quote_prefix = false,
  quote_prefix = '',
  quote_start_number = 1
WHERE use_quote_prefix IS NULL 
   OR quote_prefix IS NULL 
   OR quote_start_number IS NULL;
