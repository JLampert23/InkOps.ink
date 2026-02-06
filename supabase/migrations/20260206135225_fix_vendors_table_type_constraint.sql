/*
  # Fix Vendors Table Type Constraint

  1. Changes
    - Remove restrictive CHECK constraint on vendor_type
    - Allow any text value for vendor_type to support custom vendor types
    - This enables: SanMar, SSActivewear, Independent, Manufacturer, Distributor, Other, and custom types
  
  2. Notes
    - Existing data preserved
    - More flexible for future vendor types
    - Case-insensitive comparison not needed since we're removing the constraint
*/

-- Drop the existing CHECK constraint on vendor_type
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_vendor_type_check;

-- Update vendor_type to allow any text value (remove the constraint entirely)
-- The column is already text, so no need to change the type, just remove the restriction
