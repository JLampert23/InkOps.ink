/*
  # Remove SanMar FTP Infrastructure

  1. Cleanup Actions
    - Remove FTP cron jobs
    - Remove FTP sync functions
    - Drop FTP tables (sanmar_ftp_unified_garments, sanmar_ftp_sync_log, sanmar_image_map)
    - Remove FTP-related cron schedules

  2. Rationale
    - SanMar PromoStandards API is now the exclusive data source
    - FTP integration is deprecated and no longer needed
    - Reduces complexity and maintenance burden

  3. Notes
    - PromoStandards provides real-time data for products, pricing, inventory, and media
    - No data loss - all current data comes from PromoStandards
    - FTP tables are no longer referenced in application code
*/

-- Unschedule FTP cron jobs (with error handling)
DO $$
BEGIN
  PERFORM cron.unschedule('sanmar-full-sync-nightly');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'sanmar-full-sync-nightly job does not exist';
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('sanmar-inventory-sync-hourly');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'sanmar-inventory-sync-hourly job does not exist';
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('sanmar-image-sync-nightly');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'sanmar-image-sync-nightly job does not exist';
END $$;

-- Drop FTP tables first (CASCADE will remove triggers automatically)
DROP TABLE IF EXISTS sanmar_ftp_unified_garments CASCADE;
DROP TABLE IF EXISTS sanmar_ftp_sync_log CASCADE;
DROP TABLE IF EXISTS sanmar_image_map CASCADE;

-- Drop FTP sync functions (CASCADE to handle any remaining dependencies)
DROP FUNCTION IF EXISTS trigger_sanmar_full_sync() CASCADE;
DROP FUNCTION IF EXISTS trigger_sanmar_inventory_sync() CASCADE;
DROP FUNCTION IF EXISTS trigger_sanmar_image_sync() CASCADE;
DROP FUNCTION IF EXISTS manual_sanmar_image_sync(uuid) CASCADE;
DROP FUNCTION IF EXISTS update_sanmar_ftp_garments_updated_at() CASCADE;

-- Note: We keep sanmar_account_number, sanmar_promo_username, sanmar_promo_password_encrypted
-- as these are used by PromoStandards API authentication
