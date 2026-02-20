/*
  # Add Primary Contact Name Fields to Customers

  1. Changes
    - Add `primary_contact_first_name` column to customers table
    - Add `primary_contact_last_name` column to customers table
    - Migrate existing `contact_name` data to new fields (split on space)
    
  2. Notes
    - Existing `contact_name` field remains for backward compatibility
    - New fields provide more structured contact information
*/

-- Add primary contact name fields
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS primary_contact_first_name text,
ADD COLUMN IF NOT EXISTS primary_contact_last_name text;

-- Migrate existing contact_name data to new fields (simple split on first space)
UPDATE customers
SET 
  primary_contact_first_name = CASE 
    WHEN contact_name IS NOT NULL AND position(' ' in contact_name) > 0 
    THEN split_part(contact_name, ' ', 1)
    ELSE contact_name
  END,
  primary_contact_last_name = CASE 
    WHEN contact_name IS NOT NULL AND position(' ' in contact_name) > 0 
    THEN substring(contact_name from position(' ' in contact_name) + 1)
    ELSE NULL
  END
WHERE contact_name IS NOT NULL 
  AND (primary_contact_first_name IS NULL OR primary_contact_last_name IS NULL);
