/*
  # Fix Security and Performance Issues - Step 1: Indexes

  ## 1. Add Missing Foreign Key Indexes
    - Add indexes for foreign keys on billing_attempts (company_id, queue_item_id)
    - Add index for payments.invoice_id
    - Add index for stripe_payment_intents.company_id

  ## 2. Drop Duplicate Indexes
    - Keep newer idx_printavo_* indexes, drop older idx_* versions

  ## 3. Drop Unused Indexes
    - Remove 48+ indexes that are never used
*/

-- =====================================================
-- ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_billing_attempts_company_id
  ON billing_attempts(company_id);

CREATE INDEX IF NOT EXISTS idx_billing_attempts_queue_item_id
  ON billing_attempts(queue_item_id);

CREATE INDEX IF NOT EXISTS idx_payments_invoice_id_new
  ON payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_company_id
  ON stripe_payment_intents(company_id);

-- =====================================================
-- DROP DUPLICATE INDEXES (keep newer ones)
-- =====================================================

DROP INDEX IF EXISTS idx_invoices_company_id;
DROP INDEX IF EXISTS idx_invoices_customer_id;
DROP INDEX IF EXISTS idx_invoices_status_stage;
DROP INDEX IF EXISTS idx_line_items_company_id;
DROP INDEX IF EXISTS idx_payments_invoice_id;
DROP INDEX IF EXISTS idx_payments_payment_date;
DROP INDEX IF EXISTS idx_stripe_invoices_printavo_id;

-- =====================================================
-- DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_quotes_quote_number;
DROP INDEX IF EXISTS idx_quotes_status;
DROP INDEX IF EXISTS idx_quote_items_quote_id;
DROP INDEX IF EXISTS idx_quote_imprints_quote_id;
DROP INDEX IF EXISTS idx_quote_fees_quote_id;
DROP INDEX IF EXISTS idx_automations_enabled;
DROP INDEX IF EXISTS idx_automations_trigger_type;
DROP INDEX IF EXISTS idx_automation_logs_automation_id;
DROP INDEX IF EXISTS idx_automation_logs_status;
DROP INDEX IF EXISTS idx_automation_logs_executed_at;
DROP INDEX IF EXISTS idx_customer_contacts_email;
DROP INDEX IF EXISTS idx_automated_reports_is_enabled;
DROP INDEX IF EXISTS idx_automated_reports_schedule_type;
DROP INDEX IF EXISTS idx_stripe_payment_links_company_id;
DROP INDEX IF EXISTS idx_stripe_payments_company_id;
DROP INDEX IF EXISTS idx_stripe_payments_status;
DROP INDEX IF EXISTS idx_stripe_webhook_events_processed;
DROP INDEX IF EXISTS idx_billing_queue_payment_status;
DROP INDEX IF EXISTS idx_communication_logs_company_id;
DROP INDEX IF EXISTS idx_communication_logs_sent_at;
DROP INDEX IF EXISTS idx_paid_invoices_company_id;
DROP INDEX IF EXISTS idx_printavo_statuses_type;
DROP INDEX IF EXISTS idx_printavo_statuses_billing;
DROP INDEX IF EXISTS idx_stripe_invoices_company_id;
DROP INDEX IF EXISTS idx_stripe_invoices_status;
DROP INDEX IF EXISTS idx_payment_history_invoice_id;
DROP INDEX IF EXISTS idx_payment_history_created_at;
DROP INDEX IF EXISTS idx_ar_report_automations_enabled;
DROP INDEX IF EXISTS idx_ar_report_logs_automation;
DROP INDEX IF EXISTS idx_ar_report_logs_executed_at;
DROP INDEX IF EXISTS idx_user_profiles_email;
DROP INDEX IF EXISTS idx_user_profiles_company_id;
DROP INDEX IF EXISTS idx_invoices_customer_email;
DROP INDEX IF EXISTS idx_invoices_due_date;
DROP INDEX IF EXISTS idx_printavo_line_items_company_id;
DROP INDEX IF EXISTS idx_printavo_payments_company_id;
DROP INDEX IF EXISTS idx_printavo_payments_invoice_id;
DROP INDEX IF EXISTS idx_printavo_payments_payment_date;
DROP INDEX IF EXISTS idx_stripe_customers_company_id;
DROP INDEX IF EXISTS idx_sms_logs_sent_at;
DROP INDEX IF EXISTS idx_stripe_customers_customer_id;
DROP INDEX IF EXISTS idx_stripe_invoices_printavo_invoice_id;
DROP INDEX IF EXISTS idx_line_items_extracted_color;
DROP INDEX IF EXISTS idx_printavo_invoices_financially_locked;
DROP INDEX IF EXISTS idx_ar_report_presets_created_by;
DROP INDEX IF EXISTS idx_communication_logs_sent_by;
DROP INDEX IF EXISTS idx_payments_created_by;
DROP INDEX IF EXISTS idx_printavo_invoices_status_stage;
