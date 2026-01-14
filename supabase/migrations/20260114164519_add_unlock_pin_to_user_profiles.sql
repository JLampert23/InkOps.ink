/*
  # Add Unlock PIN to User Profiles

  1. Changes
    - Add `unlock_pin_hash` column to `user_profiles` table (if not exists)
    - This column stores the hashed PIN for unlocking financially locked invoices
    - PINs are hashed client-side using SHA-256 before storage
  
  2. Security
    - PINs are hashed, never stored in plain text
    - Each user sets their own PIN
    - PIN is required to unlock invoices
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'unlock_pin_hash'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN unlock_pin_hash text;
  END IF;
END $$;
