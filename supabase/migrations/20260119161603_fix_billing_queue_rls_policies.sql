/*
  # Fix Billing Queue RLS Policies for Company Isolation
  
  ## Problem
  The billing_queue table has company_id but all RLS policies use USING (true)
  and WITH CHECK (true), which allows ANY authenticated user to see ALL billing
  queue items across all companies.
  
  ## Solution
  Replace all insecure policies with company-specific policies that filter by
  get_user_company_id().
  
  ## Security Impact
  After this fix, users will only see billing queue items for their own company.
*/

-- Drop all insecure policies
DROP POLICY IF EXISTS "Users can view billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can insert to billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can update billing queue" ON billing_queue;
DROP POLICY IF EXISTS "Users can delete from billing queue" ON billing_queue;

-- Create secure company-specific policies
CREATE POLICY "Users can view billing queue for their company"
  ON billing_queue FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert to billing queue for their company"
  ON billing_queue FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update billing queue for their company"
  ON billing_queue FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete from billing queue for their company"
  ON billing_queue FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());
