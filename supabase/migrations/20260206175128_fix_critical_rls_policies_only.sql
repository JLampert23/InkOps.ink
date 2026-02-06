/*
  # Fix Critical RLS Security Issues

  Fixes RLS policies that currently bypass security with USING(true) or WITH CHECK(true).
  These are CRITICAL security vulnerabilities that allow unrestricted access.
*/

-- ============================================================================
-- FIX CRITICAL RLS POLICIES THAT BYPASS SECURITY
-- ============================================================================

-- 1. Fix printavo_statuses policies (currently allows any authenticated user to insert/update)
DROP POLICY IF EXISTS "Authenticated users can insert statuses" ON public.printavo_statuses;
DROP POLICY IF EXISTS "Authenticated users can update billing eligibility" ON public.printavo_statuses;

-- Only admins can manage global status data
CREATE POLICY "Admins can manage statuses"
  ON public.printavo_statuses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
      AND user_profiles.role IN ('admin', 'super_admin')
    )
  );

-- 2. Fix quote_approval_responses (currently allows anon to insert without validation)
DROP POLICY IF EXISTS "Public can create approval responses" ON public.quote_approval_responses;

-- Must verify valid approval token before allowing response
CREATE POLICY "Public can create approval responses with valid token"
  ON public.quote_approval_responses
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote_approvals
      WHERE quote_approvals.id = quote_approval_responses.approval_id
      AND quote_approvals.company_id = quote_approval_responses.company_id
      AND quote_approvals.expires_at > NOW()
      AND (quote_approvals.single_use = false OR NOT quote_approvals.is_used)
    )
  );

-- 3. Fix stripe_payment_history (currently allows unrestricted inserts)
DROP POLICY IF EXISTS "Authenticated users can create payment history" ON public.stripe_payment_history;

-- Must verify company ownership before creating payment history
CREATE POLICY "Users can create payment history for their company"
  ON public.stripe_payment_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stripe_invoices
      WHERE stripe_invoices.id = stripe_payment_history.stripe_invoice_id
      AND stripe_invoices.company_id IN (
        SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
      )
    )
  );
