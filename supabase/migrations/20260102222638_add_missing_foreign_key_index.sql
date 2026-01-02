/*
  # Add Missing Foreign Key Index

  ## Changes Made

  1. **Add Index for Foreign Key**
     - Added index on company_settings.owner_id to improve query performance
     - This foreign key references user_profiles(id)
     - Missing indexes on foreign keys can cause slow queries when joining tables

  ## Performance Impact
     - Improves JOIN performance between company_settings and user_profiles
     - Speeds up CASCADE operations if parent records are deleted
     - Optimizes queries that filter by owner_id
*/

-- Add index for the foreign key on owner_id
CREATE INDEX IF NOT EXISTS idx_company_settings_owner_id 
  ON public.company_settings(owner_id);