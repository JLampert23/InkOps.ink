/*
  # Optimize RLS Auth Function Calls - Batch 2: Quote Tables

  Covers: quote_imprints, quote_fees, quotes, quote_activity_log,
  communication_templates, price_matrices
*/

-- ============================================================================
-- QUOTE_IMPRINTS TABLE (3 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's imprints" ON public.quote_imprints;
DROP POLICY IF EXISTS "Users can insert their company's imprints" ON public.quote_imprints;
DROP POLICY IF EXISTS "Users can update their company's imprints" ON public.quote_imprints;
DROP POLICY IF EXISTS "Users can delete their company's imprints" ON public.quote_imprints;

CREATE POLICY "Users can view their company's imprints"
  ON public.quote_imprints
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_imprints.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can insert their company's imprints"
  ON public.quote_imprints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_imprints.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can update their company's imprints"
  ON public.quote_imprints
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_imprints.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_imprints.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can delete their company's imprints"
  ON public.quote_imprints
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_imprints.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  );

-- ============================================================================
-- QUOTE_FEES TABLE (5 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view quote fees for their company's quotes" ON public.quote_fees;
DROP POLICY IF EXISTS "Users can insert quote fees for their company's quotes" ON public.quote_fees;
DROP POLICY IF EXISTS "Users can update quote fees for their company's quotes" ON public.quote_fees;
DROP POLICY IF EXISTS "Users can delete quote fees for their company's quotes" ON public.quote_fees;

CREATE POLICY "Users can view quote fees for their company's quotes"
  ON public.quote_fees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_fees.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can insert quote fees for their company's quotes"
  ON public.quote_fees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_fees.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can update quote fees for their company's quotes"
  ON public.quote_fees
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_fees.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_fees.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can delete quote fees for their company's quotes"
  ON public.quote_fees
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_fees.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  );

-- ============================================================================
-- QUOTES TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view quotes for their company" ON public.quotes;
DROP POLICY IF EXISTS "Users can create quotes for their company" ON public.quotes;
DROP POLICY IF EXISTS "Users can update quotes for their company" ON public.quotes;
DROP POLICY IF EXISTS "Admins can delete quotes" ON public.quotes;

CREATE POLICY "Users can view quotes for their company"
  ON public.quotes
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can create quotes for their company"
  ON public.quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update quotes for their company"
  ON public.quotes
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Admins can delete quotes"
  ON public.quotes
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- QUOTE_ACTIVITY_LOG TABLE (2 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view activity logs for their company" ON public.quote_activity_log;
DROP POLICY IF EXISTS "Users can create activity logs for their company" ON public.quote_activity_log;

CREATE POLICY "Users can view activity logs for their company"
  ON public.quote_activity_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_activity_log.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can create activity logs for their company"
  ON public.quote_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_activity_log.quote_id
      AND quotes.company_id IN (SELECT get_user_company_id())
    )
  );

-- ============================================================================
-- COMMUNICATION_TEMPLATES TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's templates" ON public.communication_templates;
DROP POLICY IF EXISTS "Admins can insert templates for their company" ON public.communication_templates;
DROP POLICY IF EXISTS "Admins can update their company's templates" ON public.communication_templates;
DROP POLICY IF EXISTS "Admins can delete their company's templates" ON public.communication_templates;

CREATE POLICY "Users can view their company's templates"
  ON public.communication_templates
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Admins can insert templates for their company"
  ON public.communication_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update their company's templates"
  ON public.communication_templates
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    company_id IN (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete their company's templates"
  ON public.communication_templates
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (SELECT get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PRICE_MATRICES TABLE (3 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's price matrices" ON public.price_matrices;
DROP POLICY IF EXISTS "Users can insert their company's price matrices" ON public.price_matrices;
DROP POLICY IF EXISTS "Users can update their company's price matrices" ON public.price_matrices;
DROP POLICY IF EXISTS "Users can delete their company's price matrices" ON public.price_matrices;

CREATE POLICY "Users can view their company's price matrices"
  ON public.price_matrices
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert their company's price matrices"
  ON public.price_matrices
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update their company's price matrices"
  ON public.price_matrices
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete their company's price matrices"
  ON public.price_matrices
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));
