/*
  # Remove Unused SanMar FTP Tables

  This migration removes the deprecated SanMar FTP-based catalog tables.
  These tables were replaced by the PromoStandards API cache tables.

  1. Tables Removed
    - `sanmar_catalog_inventory` (deprecated FTP-based)
    - `sanmar_catalog_pricing` (deprecated FTP-based)
    - `sanmar_catalog_products` (deprecated FTP-based)
    - `sanmar_catalog_styles` (deprecated FTP-based)

  2. Tables Kept (PromoStandards-based)
    - `sanmar_inventory_cache`
    - `sanmar_media_cache`
    - `sanmar_pricing_cache`
    - `sanmar_product_cache`
*/

-- Drop old FTP-based tables
DROP TABLE IF EXISTS sanmar_catalog_inventory CASCADE;
DROP TABLE IF EXISTS sanmar_catalog_pricing CASCADE;
DROP TABLE IF EXISTS sanmar_catalog_products CASCADE;
DROP TABLE IF EXISTS sanmar_catalog_styles CASCADE;
