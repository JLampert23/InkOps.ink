/*
  # Add company_id to customer_contacts
  
  Adds the missing company_id column to customer_contacts table
  to support multi-tenancy.
  
  1. Changes
    - Add company_id column to customer_contacts
    - Create index for performance
    - Enable RLS
    - Create security policy
*/

-- Add company_id to customer_contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customer_contacts' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE customer_contacts 
    ADD COLUMN company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_customer_contacts_company_id 
ON customer_contacts(company_id);

-- Enable RLS if not already enabled
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- Create policy
DROP POLICY IF EXISTS "Users can view customer contacts from their company" ON customer_contacts;
CREATE POLICY "Users can view customer contacts from their company" ON customer_contacts
  FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT company_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Backfill existing records
UPDATE customer_contacts
SET company_id = (SELECT company_id FROM customers WHERE customers.id = customer_contacts.customer_id)
WHERE company_id IS NULL 
  AND customer_id IS NOT NULL;
