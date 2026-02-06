/*
  # Optimize RLS Auth Function Calls - Batch 1: Core Tables

  Replaces auth.uid() with (SELECT auth.uid()) and get_user_company_id() 
  with (SELECT get_user_company_id()) in RLS policies to prevent re-evaluation
  for each row, improving performance at scale.

  Covers: styles, parts, inventory, images
*/

-- ============================================================================
-- STYLES TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's styles" ON public.styles;
DROP POLICY IF EXISTS "Users can insert their company's styles" ON public.styles;
DROP POLICY IF EXISTS "Users can update their company's styles" ON public.styles;
DROP POLICY IF EXISTS "Users can delete their company's styles" ON public.styles;

CREATE POLICY "Users can view their company's styles"
  ON public.styles
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert their company's styles"
  ON public.styles
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update their company's styles"
  ON public.styles
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete their company's styles"
  ON public.styles
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- PARTS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's parts" ON public.parts;
DROP POLICY IF EXISTS "Users can insert their company's parts" ON public.parts;
DROP POLICY IF EXISTS "Users can update their company's parts" ON public.parts;
DROP POLICY IF EXISTS "Users can delete their company's parts" ON public.parts;

CREATE POLICY "Users can view their company's parts"
  ON public.parts
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert their company's parts"
  ON public.parts
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update their company's parts"
  ON public.parts
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete their company's parts"
  ON public.parts
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- INVENTORY TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can insert their company's inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can update their company's inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users can delete their company's inventory" ON public.inventory;

CREATE POLICY "Users can view their company's inventory"
  ON public.inventory
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert their company's inventory"
  ON public.inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update their company's inventory"
  ON public.inventory
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete their company's inventory"
  ON public.inventory
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- IMAGES TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's images" ON public.images;
DROP POLICY IF EXISTS "Users can insert their company's images" ON public.images;
DROP POLICY IF EXISTS "Users can update their company's images" ON public.images;
DROP POLICY IF EXISTS "Users can delete their company's images" ON public.images;

CREATE POLICY "Users can view their company's images"
  ON public.images
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert their company's images"
  ON public.images
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update their company's images"
  ON public.images
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete their company's images"
  ON public.images
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));
