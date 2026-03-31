/*
  # Add Billing First and Last Name to Quotes

  1. Changes
    - Add `bill_first_name` column to quotes table
    - Add `bill_last_name` column to quotes table
    - These fields will store the contact's first and last name for billing purposes
    - Mirrors the existing ship_name pattern but with separate fields for first/last
*/

-- Add billing first and last name columns
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS bill_first_name text,
ADD COLUMN IF NOT EXISTS bill_last_name text;
