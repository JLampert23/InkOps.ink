/*
  # Consolidate Duplicate RLS Policies - Part 2

  Consolidates remaining duplicate policies for scheduler tables and user_profiles.
*/

-- ============================================================================
-- 1. SCHEDULER_ASSIGNMENTS - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage assignment rules" ON public.scheduler_assignments;
DROP POLICY IF EXISTS "Users can view their company assignment rules" ON public.scheduler_assignments;

CREATE POLICY "Users can view assignment rules for their company"
  ON public.scheduler_assignments
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can manage assignment rules"
  ON public.scheduler_assignments
  FOR ALL
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

-- ============================================================================
-- 2. SCHEDULER_COLUMNS - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage scheduler columns" ON public.scheduler_columns;
DROP POLICY IF EXISTS "Users can view their company scheduler columns" ON public.scheduler_columns;

CREATE POLICY "Users can view scheduler columns for their company"
  ON public.scheduler_columns
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can manage scheduler columns"
  ON public.scheduler_columns
  FOR ALL
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

-- ============================================================================
-- 3. SCHEDULER_TABS - Consolidate 6 policies into 4 clear policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage all tabs" ON public.scheduler_tabs;
DROP POLICY IF EXISTS "Users can delete own tabs" ON public.scheduler_tabs;
DROP POLICY IF EXISTS "Users can create tabs" ON public.scheduler_tabs;
DROP POLICY IF EXISTS "Users can read own private tabs" ON public.scheduler_tabs;
DROP POLICY IF EXISTS "Users can read public tabs in company" ON public.scheduler_tabs;
DROP POLICY IF EXISTS "Users can update own tabs" ON public.scheduler_tabs;

CREATE POLICY "Users can view tabs in their company"
  ON public.scheduler_tabs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND (
      is_public = true
      OR user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
      )
    )
  );

CREATE POLICY "Users can create tabs for their company"
  ON public.scheduler_tabs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND user_id = (SELECT auth.uid())
  );

CREATE POLICY "Users can update own tabs or admins can update any"
  ON public.scheduler_tabs
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND (
      user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
      )
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own tabs or admins can delete any"
  ON public.scheduler_tabs
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND (
      user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = (SELECT auth.uid())
        AND role IN ('admin', 'super_admin')
      )
    )
  );

-- ============================================================================
-- 4. USER_PROFILES - Consolidate duplicate UPDATE policies
-- ============================================================================

DROP POLICY IF EXISTS "Super admins can update user profiles in their company" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Admins can update profiles in their company"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
      AND up.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (SELECT auth.uid())
    )
  );
