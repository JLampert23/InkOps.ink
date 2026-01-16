/*
  # Fix Payments Table RBAC Policies

  1. Changes
    - Drop existing conflicting policies on payments table
    - Create new RBAC-aware policies for super_admin and admin roles
    - Allow super_admin and admin to insert, update, and delete payments
    - All authenticated users can view payments

  2. Security
    - Super admin and admin roles can manage all payment operations
    - Regular users can view payments
    - Maintains proper role-based access control
*/

-- Drop all existing policies on payments table
DROP POLICY IF EXISTS "Allow read access to payments" ON payments;
DROP POLICY IF EXISTS "Allow anonymous read access to payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can create payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON payments;
DROP POLICY IF EXISTS "Users can view payments" ON payments;
DROP POLICY IF EXISTS "Users can create payments" ON payments;
DROP POLICY IF EXISTS "Users can update payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON payments;
DROP POLICY IF EXISTS "Allow public read access to payments" ON payments;
DROP POLICY IF EXISTS "Service role can insert payments" ON payments;
DROP POLICY IF EXISTS "Service role can update payments" ON payments;
DROP POLICY IF EXISTS "Service role can delete payments" ON payments;

-- Ensure RLS is enabled
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view payments
CREATE POLICY "Authenticated users can view payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

-- Allow super_admin and admin to insert payments
CREATE POLICY "Super admin and admin can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );

-- Allow super_admin and admin to update payments
CREATE POLICY "Super admin and admin can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );

-- Allow super_admin and admin to delete payments
CREATE POLICY "Super admin and admin can delete payments"
  ON payments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('super_admin', 'admin')
    )
  );
