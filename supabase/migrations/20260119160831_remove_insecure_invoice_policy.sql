/*
  # CRITICAL SECURITY FIX: Remove Insecure Invoice Access Policy
  
  ## Problem
  There's a policy "Allow read access to invoices" with USING (true) that allows
  ANY authenticated user to read ALL invoices from ALL companies. This completely
  bypasses company data isolation.
  
  ## Solution
  Drop the insecure policy. The company-specific policies will handle access:
  - "Users can view invoices in their company" - filters by company_id
  - "Users can update invoices in their company" - filters by company_id
  - "Users can insert invoices for their company" - filters by company_id
  
  ## Security Impact
  After this fix, users will ONLY see invoices belonging to their company.
*/

-- Drop the insecure policy that allows all authenticated users to see all invoices
DROP POLICY IF EXISTS "Allow read access to invoices" ON printavo_invoices;

-- Verify company-specific policies are in place (these should already exist)
-- If they don't exist, create them

DO $$
BEGIN
  -- Check if company-specific SELECT policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'printavo_invoices' 
    AND policyname = 'Users can view invoices in their company'
  ) THEN
    CREATE POLICY "Users can view invoices in their company"
      ON printavo_invoices FOR SELECT
      TO authenticated
      USING (company_id = get_user_company_id());
  END IF;
END $$;
