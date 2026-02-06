/*
  # Add override_required_validation column to communication_templates

  1. Changes
    - Add `override_required_validation` column (boolean) to communication_templates table
      - Allows admins to override validation warnings about missing required shortcodes
      - Defaults to false for security
      - Used for audit trail and template validation logging

  2. Purpose
    - Enables admins to save templates that are missing required shortcodes
    - Provides flexibility while maintaining security through audit logging
    - Supports the template validation system
*/

-- Add the override_required_validation column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'communication_templates' 
    AND column_name = 'override_required_validation'
  ) THEN
    ALTER TABLE communication_templates 
    ADD COLUMN override_required_validation boolean NOT NULL DEFAULT false;
    
    COMMENT ON COLUMN communication_templates.override_required_validation IS 'Allows admin to override required shortcode validation warnings';
  END IF;
END $$;
