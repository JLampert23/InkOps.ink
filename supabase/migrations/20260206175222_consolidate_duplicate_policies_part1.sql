/*
  # Consolidate Duplicate RLS Policies - Part 1

  Removes duplicate permissive policies and consolidates them into single comprehensive policies.
  Multiple permissive policies on the same table for the same role/action can cause confusion
  and make security auditing difficult.
*/

-- ============================================================================
-- 1. INVOICE_FEES - Consolidate 8 policies into 2
-- ============================================================================

DROP POLICY IF EXISTS "Users can view invoice fees from their company" ON public.invoice_fees;
DROP POLICY IF EXISTS "Users can view their company's invoice fees" ON public.invoice_fees;
DROP POLICY IF EXISTS "Admins can insert invoice fees" ON public.invoice_fees;
DROP POLICY IF EXISTS "Users can insert invoice fees for their company" ON public.invoice_fees;
DROP POLICY IF EXISTS "Admins can update invoice fees" ON public.invoice_fees;
DROP POLICY IF EXISTS "Users can update invoice fees from their company" ON public.invoice_fees;
DROP POLICY IF EXISTS "Admins can delete invoice fees" ON public.invoice_fees;
DROP POLICY IF EXISTS "Users can delete invoice fees from their company" ON public.invoice_fees;

CREATE POLICY "Users can view invoice fees for their company"
  ON public.invoice_fees
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can manage invoice fees for their company"
  ON public.invoice_fees
  FOR ALL
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

-- ============================================================================
-- 2. PRODUCTION_WORKFLOW_STAGES - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage workflow stages for their company" ON public.production_workflow_stages;
DROP POLICY IF EXISTS "Users can view workflow stages for their company" ON public.production_workflow_stages;

CREATE POLICY "Users can manage workflow stages for their company"
  ON public.production_workflow_stages
  FOR ALL
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

-- ============================================================================
-- 3. QUOTE_APPROVALS - Separate SELECT and INSERT properly
-- ============================================================================

DROP POLICY IF EXISTS "Users can create approvals for their company" ON public.quote_approvals;
DROP POLICY IF EXISTS "Users can view approvals for their company" ON public.quote_approvals;

CREATE POLICY "Users can view approvals for their company"
  ON public.quote_approvals
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can create approvals for their company"
  ON public.quote_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- 4. QUOTE_LINE_ITEMS - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage line items for their company" ON public.quote_line_items;
DROP POLICY IF EXISTS "Users can view line items for their company" ON public.quote_line_items;

CREATE POLICY "Users can view line items for their company"
  ON public.quote_line_items
  FOR SELECT
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

CREATE POLICY "Users can manage line items for their company"
  ON public.quote_line_items
  FOR ALL
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
