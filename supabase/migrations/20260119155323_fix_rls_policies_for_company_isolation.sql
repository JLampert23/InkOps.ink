/*
  # Fix RLS Policies for Company Data Isolation
  
  ## Security Enhancement
  
  Updates all RLS policies to properly filter by company_id so users only see
  data belonging to their company.
  
  ## Changes
  
  1. Helper Function:
     - Create get_user_company_id() function to get current user's company
  
  2. Updated Policies:
     - user_profiles: Filter by company_id
     - printavo_invoices: Filter by company_id
     - customers: Filter by company_id
     - quotes: Filter by company_id
     - automations: Filter by company_id
  
  3. Notes:
     - Super admins can see all data (future enhancement)
     - Regular users only see their company's data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON printavo_invoices;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON printavo_invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to update printavo_invoices" ON printavo_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to update invoices for unlock" ON printavo_invoices;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON customers;
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can create customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON quotes;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON automations;

-- Create helper function to get user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- User Profiles Policies
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "New users can insert their profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Printavo Invoices Policies
CREATE POLICY "Users can view invoices in their company"
  ON printavo_invoices FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can update invoices in their company"
  ON printavo_invoices FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can insert invoices for their company"
  ON printavo_invoices FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- Customers Policies  
CREATE POLICY "Users can view customers in their company"
  ON customers FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create customers for their company"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update customers in their company"
  ON customers FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete customers in their company"
  ON customers FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Quotes Policies
CREATE POLICY "Users can view quotes in their company"
  ON quotes FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create quotes for their company"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update quotes in their company"
  ON quotes FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete quotes in their company"
  ON quotes FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Automations Policies
CREATE POLICY "Users can view automations in their company"
  ON automations FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create automations for their company"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update automations in their company"
  ON automations FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete automations in their company"
  ON automations FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());
