/*
  # Restore Company-Wide User Profile Policies

  1. Problem
    - The previous migration removed the company-wide SELECT policy on user_profiles
    - This broke team management, user lists, and 50+ queries that need to view 
      other users in the same company
    - Admin/super_admin update, insert, and delete policies were also removed

  2. Solution
    - Re-add company-scoped SELECT so users can see teammates
    - Re-add admin UPDATE, super_admin INSERT, and super_admin DELETE policies
    - All policies use rls_get_user_company_id() and rls_get_user_role() which are 
      SECURITY DEFINER owned by postgres (rolbypassrls=true), so they safely bypass 
      RLS on user_profiles without causing recursion

  3. Changes
    - New SELECT policy: users can view all profiles in their company
    - New UPDATE policy: admins/super_admins can update profiles in their company
    - New INSERT policy: super_admins can create profiles in their company
    - New DELETE policy: super_admins can delete profiles in their company
*/

CREATE POLICY "user_profiles_select_company"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (company_id = rls_get_user_company_id());

CREATE POLICY "user_profiles_admin_update"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    company_id = rls_get_user_company_id()
    AND rls_get_user_role() IN ('admin', 'super_admin')
  )
  WITH CHECK (
    company_id = rls_get_user_company_id()
    AND rls_get_user_role() IN ('admin', 'super_admin')
  );

CREATE POLICY "user_profiles_superadmin_insert"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = rls_get_user_company_id()
    AND rls_get_user_role() = 'super_admin'
  );

CREATE POLICY "user_profiles_superadmin_delete"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (
    company_id = rls_get_user_company_id()
    AND rls_get_user_role() = 'super_admin'
  );
