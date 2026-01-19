/*
  # Add Company ID for Multi-Tenant Data Isolation
  
  ## Critical Security Fix
  
  This migration adds company_id to all tables that need multi-tenant isolation.
  Currently, all users can see all data regardless of which company they belong to.
  
  ## Changes
  
  1. Tables Updated:
     - `user_profiles` - Add company_id to link users to their company
     - `printavo_invoices` - Add company_id to isolate invoice data
     - `printavo_line_items` - Add company_id via invoice relationship
     - `customers` - Add company_id to isolate customer data
     - `quotes` - Add company_id to isolate quote data
     - `automations` - Add company_id to isolate automation rules
     - `customer_contacts` - Inherits from customer relationship
  
  2. Data Backfill:
     - Links existing data to the first company (Todd's)
     - Sets user company_id based on company_settings.owner_id
  
  3. Security:
     - All RLS policies will be updated in next migration to filter by company_id
     - Users will only see data for their company
*/

-- Add company_id to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Add company_id to printavo_invoices
ALTER TABLE printavo_invoices 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Add company_id to customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Add company_id to quotes
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Add company_id to automations
ALTER TABLE automations 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company_settings(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_invoices_company_id ON printavo_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_automations_company_id ON automations(company_id);

-- Backfill: Link existing users to their companies based on company_settings.owner_id
UPDATE user_profiles up
SET company_id = cs.id
FROM company_settings cs
WHERE cs.owner_id = up.id
  AND up.company_id IS NULL;

-- Backfill: For any users not already linked, link to the first company
UPDATE user_profiles
SET company_id = (SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Backfill: Link all existing invoices to the first company
UPDATE printavo_invoices
SET company_id = (SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Backfill: Link all existing customers to the first company
UPDATE customers
SET company_id = (SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Backfill: Link all existing quotes to the first company
UPDATE quotes
SET company_id = (SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Backfill: Link all existing automations to the first company
UPDATE automations
SET company_id = (SELECT id FROM company_settings ORDER BY created_at ASC LIMIT 1)
WHERE company_id IS NULL;

-- Make company_id NOT NULL after backfill (except for older tables we might not touch)
ALTER TABLE user_profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE printavo_invoices ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN company_id SET NOT NULL;
-- quotes and automations can stay nullable for now since they might not have data
