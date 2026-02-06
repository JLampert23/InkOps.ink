/*
  # Fix Remaining Duplicate Permissive Policies

  Removes remaining duplicate policies identified by security scanner.
  Some tables still have multiple policies for the same role/action combination.
*/

-- ============================================================================
-- FIX DUPLICATE POLICIES
-- ============================================================================

-- 1. invoice_fees - Remove duplicate SELECT policy (already has view + manage policies)
DROP POLICY IF EXISTS "Users can manage invoice fees for their company" ON public.invoice_fees;

-- Recreate with separate INSERT/UPDATE/DELETE policy
CREATE POLICY "Users can modify invoice fees for their company"
  ON public.invoice_fees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update invoice fees for their company"
  ON public.invoice_fees
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete invoice fees for their company"
  ON public.invoice_fees
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

-- 2. printavo_statuses - Has both "Admins can manage" and "Authenticated users can read"
-- Keep both since they serve different purposes (read vs manage)
-- No action needed - this is intentional

-- 3. quote_line_items - Already fixed but may have duplicate SELECT
DROP POLICY IF EXISTS "Users can manage line items for their company" ON public.quote_line_items;

CREATE POLICY "Users can insert line items for their company"
  ON public.quote_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Users can update line items for their company"
  ON public.quote_line_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete line items for their company"
  ON public.quote_line_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
      )
    )
  );

-- 4. scheduler_assignments - Already fixed but needs separate policies
DROP POLICY IF EXISTS "Admins can manage assignment rules" ON public.scheduler_assignments;

CREATE POLICY "Admins can insert assignment rules"
  ON public.scheduler_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update assignment rules"
  ON public.scheduler_assignments
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete assignment rules"
  ON public.scheduler_assignments
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- 5. scheduler_columns - Same pattern
DROP POLICY IF EXISTS "Admins can manage scheduler columns" ON public.scheduler_columns;

CREATE POLICY "Admins can insert scheduler columns"
  ON public.scheduler_columns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update scheduler columns"
  ON public.scheduler_columns
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete scheduler columns"
  ON public.scheduler_columns
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- 6. user_profiles - Keep both UPDATE policies as they serve different purposes
-- "Users can update own profile" - allows users to update their own profile
-- "Admins can update profiles in their company" - allows admins to update any profile in company
-- These are NOT duplicates, they are complementary
-- No action needed
