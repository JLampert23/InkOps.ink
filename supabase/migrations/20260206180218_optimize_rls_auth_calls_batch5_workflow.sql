/*
  # Optimize RLS Auth Function Calls - Batch 5: Workflow & Schedule Tables

  Covers: work_type_workflows, production_schedule_entries, production_stations,
  receiving_logs, receiving_line_items, receiving_settings, sanmar_image_map
*/

-- ============================================================================
-- WORK_TYPE_WORKFLOWS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view workflows in their company" ON public.work_type_workflows;
DROP POLICY IF EXISTS "Users can insert workflows in their company" ON public.work_type_workflows;
DROP POLICY IF EXISTS "Users can update workflows in their company" ON public.work_type_workflows;
DROP POLICY IF EXISTS "Users can delete workflows in their company" ON public.work_type_workflows;

CREATE POLICY "Users can view workflows in their company"
  ON public.work_type_workflows
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert workflows in their company"
  ON public.work_type_workflows
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update workflows in their company"
  ON public.work_type_workflows
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete workflows in their company"
  ON public.work_type_workflows
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- PRODUCTION_SCHEDULE_ENTRIES TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company schedule entries" ON public.production_schedule_entries;
DROP POLICY IF EXISTS "Users can create schedule entries for their company" ON public.production_schedule_entries;
DROP POLICY IF EXISTS "Users can update their company schedule entries" ON public.production_schedule_entries;
DROP POLICY IF EXISTS "Users can delete their company schedule entries" ON public.production_schedule_entries;

CREATE POLICY "Users can view their company schedule entries"
  ON public.production_schedule_entries
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can create schedule entries for their company"
  ON public.production_schedule_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update their company schedule entries"
  ON public.production_schedule_entries
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete their company schedule entries"
  ON public.production_schedule_entries
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- PRODUCTION_STATIONS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view stations in their company" ON public.production_stations;
DROP POLICY IF EXISTS "Users can insert stations in their company" ON public.production_stations;
DROP POLICY IF EXISTS "Users can update stations in their company" ON public.production_stations;
DROP POLICY IF EXISTS "Users can delete stations in their company" ON public.production_stations;

CREATE POLICY "Users can view stations in their company"
  ON public.production_stations
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert stations in their company"
  ON public.production_stations
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update stations in their company"
  ON public.production_stations
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete stations in their company"
  ON public.production_stations
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- RECEIVING_LOGS TABLE (2 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view receiving logs for their company" ON public.receiving_logs;
DROP POLICY IF EXISTS "Users can create receiving logs for their company" ON public.receiving_logs;
DROP POLICY IF EXISTS "Users can update receiving logs for their company" ON public.receiving_logs;

CREATE POLICY "Users can view receiving logs for their company"
  ON public.receiving_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE purchase_orders.id = receiving_logs.po_id
      AND purchase_orders.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can create receiving logs for their company"
  ON public.receiving_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE purchase_orders.id = receiving_logs.po_id
      AND purchase_orders.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can update receiving logs for their company"
  ON public.receiving_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE purchase_orders.id = receiving_logs.po_id
      AND purchase_orders.company_id IN (SELECT get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE purchase_orders.id = receiving_logs.po_id
      AND purchase_orders.company_id IN (SELECT get_user_company_id())
    )
  );

-- ============================================================================
-- RECEIVING_LINE_ITEMS TABLE (3 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view receiving line items for their company" ON public.receiving_line_items;
DROP POLICY IF EXISTS "Users can create receiving line items for their company" ON public.receiving_line_items;
DROP POLICY IF EXISTS "Users can update receiving line items for their company" ON public.receiving_line_items;

CREATE POLICY "Users can view receiving line items for their company"
  ON public.receiving_line_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receiving_logs
      JOIN purchase_orders ON purchase_orders.id = receiving_logs.po_id
      WHERE receiving_logs.id = receiving_line_items.receiving_log_id
      AND purchase_orders.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can create receiving line items for their company"
  ON public.receiving_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receiving_logs
      JOIN purchase_orders ON purchase_orders.id = receiving_logs.po_id
      WHERE receiving_logs.id = receiving_line_items.receiving_log_id
      AND purchase_orders.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can update receiving line items for their company"
  ON public.receiving_line_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receiving_logs
      JOIN purchase_orders ON purchase_orders.id = receiving_logs.po_id
      WHERE receiving_logs.id = receiving_line_items.receiving_log_id
      AND purchase_orders.company_id IN (SELECT get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receiving_logs
      JOIN purchase_orders ON purchase_orders.id = receiving_logs.po_id
      WHERE receiving_logs.id = receiving_line_items.receiving_log_id
      AND purchase_orders.company_id IN (SELECT get_user_company_id())
    )
  );

-- ============================================================================
-- RECEIVING_SETTINGS TABLE (3 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view receiving settings for their company" ON public.receiving_settings;
DROP POLICY IF EXISTS "Admins can update receiving settings for their company" ON public.receiving_settings;
DROP POLICY IF EXISTS "Admins can insert receiving settings for their company" ON public.receiving_settings;

CREATE POLICY "Users can view receiving settings for their company"
  ON public.receiving_settings
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Admins can insert receiving settings for their company"
  ON public.receiving_settings
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

CREATE POLICY "Admins can update receiving settings for their company"
  ON public.receiving_settings
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

-- ============================================================================
-- SANMAR_IMAGE_MAP TABLE (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Users can read company image mappings" ON public.sanmar_image_map;

CREATE POLICY "Users can read company image mappings"
  ON public.sanmar_image_map
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));
