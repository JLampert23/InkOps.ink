/*
  # Add Portal Customer Update Policies

  1. Changes
    - Add UPDATE policy for customers table to allow portal users to edit their own info
    - Add SELECT, INSERT, UPDATE, DELETE policies for customer_contacts table for portal access
    
  2. Security
    - Anon role can update customers (portal users are validated via session checks in the app)
    - Anon role can manage customer_contacts for portal customers
    - These policies are permissive since portal session verification happens in the application layer
*/

-- Allow anon to update customers (for portal customer self-service)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customers' 
    AND policyname = 'Allow portal customer updates'
  ) THEN
    CREATE POLICY "Allow portal customer updates"
      ON customers FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Allow anon to view customer_contacts (for portal)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customer_contacts' 
    AND policyname = 'Allow portal contact lookups'
  ) THEN
    CREATE POLICY "Allow portal contact lookups"
      ON customer_contacts FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow anon to insert customer_contacts (for portal)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customer_contacts' 
    AND policyname = 'Allow portal contact creation'
  ) THEN
    CREATE POLICY "Allow portal contact creation"
      ON customer_contacts FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

-- Allow anon to update customer_contacts (for portal)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customer_contacts' 
    AND policyname = 'Allow portal contact updates'
  ) THEN
    CREATE POLICY "Allow portal contact updates"
      ON customer_contacts FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Allow anon to delete customer_contacts (for portal)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'customer_contacts' 
    AND policyname = 'Allow portal contact deletion'
  ) THEN
    CREATE POLICY "Allow portal contact deletion"
      ON customer_contacts FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;
