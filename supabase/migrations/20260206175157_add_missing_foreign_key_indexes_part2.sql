/*
  # Add Missing Foreign Key Indexes - Part 2

  Adds remaining indexes on foreign key columns for company_id and other relationships.
*/

-- Company ID foreign keys
CREATE INDEX IF NOT EXISTS idx_billing_attempts_company_id ON public.billing_attempts(company_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_company_id ON public.communication_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_company_id ON public.paid_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_printavo_payments_company_id ON public.printavo_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_quote_approval_responses_company_id ON public.quote_approval_responses(company_id);
CREATE INDEX IF NOT EXISTS idx_quote_approvals_company_id ON public.quote_approvals(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_company_id ON public.stripe_customers(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_company_id ON public.stripe_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_company_id ON public.stripe_payment_intents(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_links_company_id ON public.stripe_payment_links(company_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_company_id ON public.stripe_payments(company_id);

-- Other important foreign keys
CREATE INDEX IF NOT EXISTS idx_ar_report_logs_automation_id ON public.ar_report_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_automation_id ON public.automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_billing_attempts_queue_item_id ON public.billing_attempts(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_fundraising_credits_customer_id ON public.customer_fundraising_credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tasks_quote_id ON public.delivery_tasks(quote_id);
CREATE INDEX IF NOT EXISTS idx_garment_requirements_staging_po_id ON public.garment_requirements_staging(po_id);
CREATE INDEX IF NOT EXISTS idx_production_schedule_entries_imprint_id ON public.production_schedule_entries(imprint_id);
CREATE INDEX IF NOT EXISTS idx_production_schedule_entries_line_item_id ON public.production_schedule_entries(line_item_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_customer_id ON public.stripe_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_history_stripe_invoice_id ON public.stripe_payment_history(stripe_invoice_id);

-- Remove duplicate index
DROP INDEX IF EXISTS public.idx_po_expected_delivery;
