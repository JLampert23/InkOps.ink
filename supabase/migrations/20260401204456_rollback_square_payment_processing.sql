/*
  # Rollback Square Payment Processing Integration

  This migration removes the Square payment processing functionality that was added
  but never fully implemented. This cleanup preserves the Square Dashboard (data viewing)
  integration while removing payment processing tables and columns.

  ## Changes

  1. Drop Tables
    - `square_payment_links` - Stored Square checkout links for invoices
    - `square_payments` - Records of completed Square payments  
    - `square_webhook_events` - Log of Square webhook events

  2. Drop Triggers and Functions
    - `update_square_payment_links_updated_at()` function and trigger
    - `update_square_payments_updated_at()` function and trigger

  3. Drop Indexes
    - All indexes associated with the three Square payment tables

  4. Remove Columns from company_settings
    - `square_payments_enabled` - Toggle for Square payment processing
    - `square_webhook_signature_key` - Webhook validation key

  ## Note
  Square Dashboard integration (for viewing Square data) remains intact.
  Only payment processing functionality is being removed.
*/

-- Drop RLS policies first (required before dropping tables)
DROP POLICY IF EXISTS "Anon can view completed payments" ON square_payments;
DROP POLICY IF EXISTS "Anon can view active payment links for valid invoices" ON square_payment_links;
DROP POLICY IF EXISTS "Service role can manage webhook events" ON square_webhook_events;
DROP POLICY IF EXISTS "Company members can view their webhook events" ON square_webhook_events;
DROP POLICY IF EXISTS "Service role can manage all payments" ON square_payments;
DROP POLICY IF EXISTS "Company members can update their payments" ON square_payments;
DROP POLICY IF EXISTS "Company members can create payments" ON square_payments;
DROP POLICY IF EXISTS "Company members can view their payments" ON square_payments;
DROP POLICY IF EXISTS "Service role can manage all payment links" ON square_payment_links;
DROP POLICY IF EXISTS "Company members can update their payment links" ON square_payment_links;
DROP POLICY IF EXISTS "Company members can create payment links" ON square_payment_links;
DROP POLICY IF EXISTS "Company members can view their payment links" ON square_payment_links;

-- Drop indexes
DROP INDEX IF EXISTS idx_square_webhook_events_company_id;
DROP INDEX IF EXISTS idx_square_webhook_events_processed;
DROP INDEX IF EXISTS idx_square_webhook_events_square_event_id;
DROP INDEX IF EXISTS idx_square_payments_square_payment_id;
DROP INDEX IF EXISTS idx_square_payments_status;
DROP INDEX IF EXISTS idx_square_payments_invoice_id;
DROP INDEX IF EXISTS idx_square_payments_company_id;
DROP INDEX IF EXISTS idx_square_payment_links_square_checkout_id;
DROP INDEX IF EXISTS idx_square_payment_links_status;
DROP INDEX IF EXISTS idx_square_payment_links_invoice_id;
DROP INDEX IF EXISTS idx_square_payment_links_company_id;

-- Drop triggers
DROP TRIGGER IF EXISTS square_payments_updated_at ON square_payments;
DROP TRIGGER IF EXISTS square_payment_links_updated_at ON square_payment_links;

-- Drop tables (CASCADE will handle any remaining dependencies)
DROP TABLE IF EXISTS square_webhook_events CASCADE;
DROP TABLE IF EXISTS square_payments CASCADE;
DROP TABLE IF EXISTS square_payment_links CASCADE;

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_square_payments_updated_at();
DROP FUNCTION IF EXISTS update_square_payment_links_updated_at();

-- Remove Square payment columns from company_settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_payments_enabled'
  ) THEN
    ALTER TABLE company_settings DROP COLUMN square_payments_enabled;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'square_webhook_signature_key'
  ) THEN
    ALTER TABLE company_settings DROP COLUMN square_webhook_signature_key;
  END IF;
END $$;
