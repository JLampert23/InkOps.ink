/*
  # Unify Quote and Invoice Numbering System

  This migration consolidates quote and invoice numbering into a single unified system.
  
  ## Changes
  
  1. Rename Columns (for clarity)
    - `use_invoice_prefix` → `use_number_prefix`
    - `invoice_prefix` → kept but not used (will be ignored)
    - `invoice_start_number` → `number_start_number`
    - `next_invoice_number` → `next_number`
  
  2. Remove Separate Quote Columns
    - Remove `use_quote_prefix`, `quote_prefix`, `quote_start_number`
  
  ## Numbering Logic
  - When prefix is enabled:
    - Quotes use "QTE-" prefix
    - Invoices use "INV-" prefix
  - Both share the same sequential number series
  - Starting number applies to both quotes and invoices
*/

-- Add new unified columns
ALTER TABLE company_settings 
  ADD COLUMN IF NOT EXISTS use_number_prefix boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS number_start_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_number integer DEFAULT 1;

-- Copy existing invoice settings to new unified columns
UPDATE company_settings 
SET 
  use_number_prefix = use_invoice_prefix,
  number_start_number = COALESCE(invoice_start_number, 1),
  next_number = COALESCE(next_invoice_number, invoice_start_number, 1)
WHERE use_number_prefix IS NULL;

-- Remove separate quote numbering columns
ALTER TABLE company_settings 
  DROP COLUMN IF EXISTS use_quote_prefix,
  DROP COLUMN IF EXISTS quote_prefix,
  DROP COLUMN IF EXISTS quote_start_number;

-- Note: Keeping invoice_prefix and use_invoice_prefix for backward compatibility
-- but they will be ignored in favor of use_number_prefix
