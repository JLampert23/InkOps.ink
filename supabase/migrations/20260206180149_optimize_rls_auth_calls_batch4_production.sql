/*
  # Optimize RLS Auth Function Calls - Batch 4: Production Tables

  Covers: imprints, imprint_proofs, decoration_locations, color_stitch_options,
  production_color_settings, type_of_work_settings, proofs, proof_artwork, proof_colors,
  production_colors, integration_settings
*/

-- ============================================================================
-- IMPRINTS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's imprints" ON public.imprints;
DROP POLICY IF EXISTS "Users can insert their company's imprints" ON public.imprints;
DROP POLICY IF EXISTS "Users can update their company's imprints" ON public.imprints;
DROP POLICY IF EXISTS "Users can delete their company's imprints" ON public.imprints;

CREATE POLICY "Users can view their company's imprints"
  ON public.imprints
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert their company's imprints"
  ON public.imprints
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update their company's imprints"
  ON public.imprints
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete their company's imprints"
  ON public.imprints
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- IMPRINT_PROOFS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's imprint proofs" ON public.imprint_proofs;
DROP POLICY IF EXISTS "Users can insert their company's imprint proofs" ON public.imprint_proofs;
DROP POLICY IF EXISTS "Users can update their company's imprint proofs" ON public.imprint_proofs;
DROP POLICY IF EXISTS "Users can delete their company's imprint proofs" ON public.imprint_proofs;

CREATE POLICY "Users can view their company's imprint proofs"
  ON public.imprint_proofs
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert their company's imprint proofs"
  ON public.imprint_proofs
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update their company's imprint proofs"
  ON public.imprint_proofs
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete their company's imprint proofs"
  ON public.imprint_proofs
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- DECORATION_LOCATIONS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their company's decoration locations" ON public.decoration_locations;
DROP POLICY IF EXISTS "Users can insert their company's decoration locations" ON public.decoration_locations;
DROP POLICY IF EXISTS "Users can update their company's decoration locations" ON public.decoration_locations;
DROP POLICY IF EXISTS "Users can delete their company's decoration locations" ON public.decoration_locations;

CREATE POLICY "Users can view their company's decoration locations"
  ON public.decoration_locations
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert their company's decoration locations"
  ON public.decoration_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update their company's decoration locations"
  ON public.decoration_locations
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete their company's decoration locations"
  ON public.decoration_locations
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- COLOR_STITCH_OPTIONS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can read company color_stitch_options" ON public.color_stitch_options;
DROP POLICY IF EXISTS "Admins can insert color_stitch_options" ON public.color_stitch_options;
DROP POLICY IF EXISTS "Admins can update color_stitch_options" ON public.color_stitch_options;
DROP POLICY IF EXISTS "Admins can delete color_stitch_options" ON public.color_stitch_options;

CREATE POLICY "Users can read company color_stitch_options"
  ON public.color_stitch_options
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Admins can insert color_stitch_options"
  ON public.color_stitch_options
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

CREATE POLICY "Admins can update color_stitch_options"
  ON public.color_stitch_options
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

CREATE POLICY "Admins can delete color_stitch_options"
  ON public.color_stitch_options
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
-- PRODUCTION_COLOR_SETTINGS TABLE (3 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own company color settings" ON public.production_color_settings;
DROP POLICY IF EXISTS "Users can insert own company color settings" ON public.production_color_settings;
DROP POLICY IF EXISTS "Admins can update company color settings" ON public.production_color_settings;

CREATE POLICY "Users can read own company color settings"
  ON public.production_color_settings
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert own company color settings"
  ON public.production_color_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Admins can update company color settings"
  ON public.production_color_settings
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
-- TYPE_OF_WORK_SETTINGS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own company work types" ON public.type_of_work_settings;
DROP POLICY IF EXISTS "Users can insert own company work types" ON public.type_of_work_settings;
DROP POLICY IF EXISTS "Admins can update company work types" ON public.type_of_work_settings;
DROP POLICY IF EXISTS "Admins can delete company work types" ON public.type_of_work_settings;

CREATE POLICY "Users can read own company work types"
  ON public.type_of_work_settings
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can insert own company work types"
  ON public.type_of_work_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Admins can update company work types"
  ON public.type_of_work_settings
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

CREATE POLICY "Admins can delete company work types"
  ON public.type_of_work_settings
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
-- PROOFS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own company proofs" ON public.proofs;
DROP POLICY IF EXISTS "Users can create proofs for own company" ON public.proofs;
DROP POLICY IF EXISTS "Users can update own company proofs" ON public.proofs;
DROP POLICY IF EXISTS "Users can delete own company proofs" ON public.proofs;

CREATE POLICY "Users can view own company proofs"
  ON public.proofs
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can create proofs for own company"
  ON public.proofs
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update own company proofs"
  ON public.proofs
  FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete own company proofs"
  ON public.proofs
  FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

-- ============================================================================
-- PROOF_ARTWORK TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own company proof artwork" ON public.proof_artwork;
DROP POLICY IF EXISTS "Users can create proof artwork for own company" ON public.proof_artwork;
DROP POLICY IF EXISTS "Users can update own company proof artwork" ON public.proof_artwork;
DROP POLICY IF EXISTS "Users can delete own company proof artwork" ON public.proof_artwork;

CREATE POLICY "Users can view own company proof artwork"
  ON public.proof_artwork
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proofs
      WHERE proofs.id = proof_artwork.proof_id
      AND proofs.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can create proof artwork for own company"
  ON public.proof_artwork
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proofs
      WHERE proofs.id = proof_artwork.proof_id
      AND proofs.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can update own company proof artwork"
  ON public.proof_artwork
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proofs
      WHERE proofs.id = proof_artwork.proof_id
      AND proofs.company_id IN (SELECT get_user_company_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proofs
      WHERE proofs.id = proof_artwork.proof_id
      AND proofs.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can delete own company proof artwork"
  ON public.proof_artwork
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proofs
      WHERE proofs.id = proof_artwork.proof_id
      AND proofs.company_id IN (SELECT get_user_company_id())
    )
  );

-- ============================================================================
-- PROOF_COLORS TABLE (3 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own company proof colors" ON public.proof_colors;
DROP POLICY IF EXISTS "Users can create proof colors for own company" ON public.proof_colors;
DROP POLICY IF EXISTS "Users can delete own company proof colors" ON public.proof_colors;

CREATE POLICY "Users can view own company proof colors"
  ON public.proof_colors
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proofs
      WHERE proofs.id = proof_colors.proof_id
      AND proofs.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can create proof colors for own company"
  ON public.proof_colors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proofs
      WHERE proofs.id = proof_colors.proof_id
      AND proofs.company_id IN (SELECT get_user_company_id())
    )
  );

CREATE POLICY "Users can delete own company proof colors"
  ON public.proof_colors
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proofs
      WHERE proofs.id = proof_colors.proof_id
      AND proofs.company_id IN (SELECT get_user_company_id())
    )
  );

-- ============================================================================
-- PRODUCTION_COLORS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can read company production_colors" ON public.production_colors;
DROP POLICY IF EXISTS "Admins can insert production_colors" ON public.production_colors;
DROP POLICY IF EXISTS "Admins can update production_colors" ON public.production_colors;
DROP POLICY IF EXISTS "Admins can delete production_colors" ON public.production_colors;

CREATE POLICY "Users can read company production_colors"
  ON public.production_colors
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Admins can insert production_colors"
  ON public.production_colors
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

CREATE POLICY "Admins can update production_colors"
  ON public.production_colors
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

CREATE POLICY "Admins can delete production_colors"
  ON public.production_colors
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
-- INTEGRATION_SETTINGS TABLE (4 policies)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own company integration settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Admins can insert integration settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Admins can update integration settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Admins can delete integration settings" ON public.integration_settings;

CREATE POLICY "Users can view own company integration settings"
  ON public.integration_settings
  FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Admins can insert integration settings"
  ON public.integration_settings
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

CREATE POLICY "Admins can update integration settings"
  ON public.integration_settings
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

CREATE POLICY "Admins can delete integration settings"
  ON public.integration_settings
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
