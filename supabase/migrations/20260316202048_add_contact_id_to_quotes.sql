/*
  # Add Contact Association to Quotes

  ## Summary
  This migration adds the ability to associate a specific customer contact with a quote,
  allowing quotes to be linked to individual contacts within a customer organization.

  ## Changes
  1. New Columns
    - `quotes.contact_id` (uuid, nullable) - References the specific contact for this quote
  
  2. Foreign Key Constraints
    - `contact_id` references `customer_contacts.id` with ON DELETE SET NULL
    - Ensures contact deletion doesn't break quotes, just clears the reference
  
  3. Index
    - Added index on `contact_id` for query performance
  
  ## Backward Compatibility
  - Column is nullable, so all existing quotes continue to work
  - Quotes without a contact will use customer-level information as before
  - This is a purely additive change with zero breaking changes
*/

-- Add contact_id column to quotes table
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS contact_id uuid;

-- Add foreign key constraint with SET NULL on delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotes_contact_id_fkey'
  ) THEN
    ALTER TABLE quotes
    ADD CONSTRAINT quotes_contact_id_fkey 
    FOREIGN KEY (contact_id) 
    REFERENCES customer_contacts(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_quotes_contact_id ON quotes(contact_id);

-- Add helpful comment
COMMENT ON COLUMN quotes.contact_id IS 'Optional reference to specific contact within customer organization';