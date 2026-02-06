/*
  # Optimize RLS Auth Function Calls - Batch 3: Customer & User Tables

  Covers: customer_payment_methods, customer_tax_exemptions, user_profiles,
  template_validation_logs, quote_approval_responses, customer_artwork
*/

-- ============================================================================
-- CUSTOMER_PAYMENT_METHODS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view payment methods in their company" ON public.customer_payment_methods;
DROP POLICY IF EXISTS "Users can insert payment methods in their company" ON public.customer_payment_methods;
DROP POLICY IF EXISTS "Users can update payment methods in their company" ON public.customer_payment_methods;
DROP POLICY IF EXISTS "Users can delete payment methods in their company" ON public.customer_payment_methods;

CREATE POLICY "Users can view payment methods in their company"
  ON public.customer_payment_methods
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_payment_methods.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can insert payment methods in their company"
  ON public.customer_payment_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_payment_methods.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can update payment methods in their company"
  ON public.customer_payment_methods
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_payment_methods.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_payment_methods.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can delete payment methods in their company"
  ON public.customer_payment_methods
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_payment_methods.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

-- ============================================================================
-- CUSTOMER_TAX_EXEMPTIONS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view tax exemptions in their company" ON public.customer_tax_exemptions;
DROP POLICY IF EXISTS "Users can insert tax exemptions in their company" ON public.customer_tax_exemptions;
DROP POLICY IF EXISTS "Users can update tax exemptions in their company" ON public.customer_tax_exemptions;
DROP POLICY IF EXISTS "Users can delete tax exemptions in their company" ON public.customer_tax_exemptions;

CREATE POLICY "Users can view tax exemptions in their company"
  ON public.customer_tax_exemptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_tax_exemptions.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can insert tax exemptions in their company"
  ON public.customer_tax_exemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_tax_exemptions.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can update tax exemptions in their company"
  ON public.customer_tax_exemptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_tax_exemptions.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_tax_exemptions.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can delete tax exemptions in their company"
  ON public.customer_tax_exemptions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_tax_exemptions.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

-- ============================================================================
-- USER_PROFILES TABLE (2 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view profiles in their company" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can delete user profiles in their company" ON public.user_profiles;

CREATE POLICY "Users can view profiles in their company"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Super admins can delete user profiles in their company"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
      AND up.role = 'super_admin'
    )
  );

-- ============================================================================
-- TEMPLATE_VALIDATION_LOGS TABLE (2 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view validation logs for their company" ON public.template_validation_logs;
DROP POLICY IF EXISTS "Users can insert their own validation logs" ON public.template_validation_logs;

CREATE POLICY "Admins can view validation logs for their company"
  ON public.template_validation_logs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Users can insert their own validation logs"
  ON public.template_validation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND company_id IN (SELECT get_user_company_id())
  );

-- ============================================================================
-- QUOTE_APPROVAL_RESPONSES TABLE (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view responses for their company" ON public.quote_approval_responses;

CREATE POLICY "Users can view responses for their company"
  ON public.quote_approval_responses
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- CUSTOMER_ARTWORK TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's customer artwork" ON public.customer_artwork;
DROP POLICY IF EXISTS "Users can insert customer artwork for their company" ON public.customer_artwork;
DROP POLICY IF EXISTS "Users can update their company's customer artwork" ON public.customer_artwork;
DROP POLICY IF EXISTS "Users can delete their company's customer artwork" ON public.customer_artwork;

CREATE POLICY "Users can view their company's customer artwork"
  ON public.customer_artwork
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_artwork.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can insert customer artwork for their company"
  ON public.customer_artwork
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_artwork.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can update their company's customer artwork"
  ON public.customer_artwork
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_artwork.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_artwork.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can delete their company's customer artwork"
  ON public.customer_artwork
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = customer_artwork.customer_id
      AND customers.company_id IN (SELECT get_user_company_id())
    )
  );
