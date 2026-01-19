/*
  # Fix Remaining Insecure RLS Policies (Part 2)
  
  ## Problem
  Multiple tables still have insecure RLS policies using USING (true) or 
  WITH CHECK (true), allowing cross-company data access.
  
  Tables with company_id that need fixing:
  - stripe_invoices
  - stripe_payments
  - stripe_payment_links
  - stripe_webhook_events
  - paid_invoices
  - communication_logs
  - automations
  
  Tables WITHOUT company_id (will fix through parent relationships later):
  - customer_contacts
  - quote_items, quote_fees, quote_imprints
  - sms_logs
  - stripe_payment_history
  - automation_logs
  
  ## Solution
  Fix all policies for tables that have company_id using DROP IF EXISTS.
*/

-- Fix stripe_invoices
DROP POLICY IF EXISTS "Authenticated users can view stripe invoices" ON stripe_invoices;
DROP POLICY IF EXISTS "Authenticated users can create stripe invoices" ON stripe_invoices;
DROP POLICY IF EXISTS "Authenticated users can update stripe invoices" ON stripe_invoices;
DROP POLICY IF EXISTS "Users can view stripe invoices in their company" ON stripe_invoices;
DROP POLICY IF EXISTS "Users can create stripe invoices for their company" ON stripe_invoices;
DROP POLICY IF EXISTS "Users can update stripe invoices in their company" ON stripe_invoices;

CREATE POLICY "Users can view stripe invoices in their company"
  ON stripe_invoices FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create stripe invoices for their company"
  ON stripe_invoices FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update stripe invoices in their company"
  ON stripe_invoices FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Fix stripe_payments
DROP POLICY IF EXISTS "Users can view payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can create payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can update payments" ON stripe_payments;
DROP POLICY IF EXISTS "Users can view stripe payments in their company" ON stripe_payments;
DROP POLICY IF EXISTS "Users can create stripe payments for their company" ON stripe_payments;
DROP POLICY IF EXISTS "Users can update stripe payments in their company" ON stripe_payments;

CREATE POLICY "Users can view stripe payments in their company"
  ON stripe_payments FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create stripe payments for their company"
  ON stripe_payments FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update stripe payments in their company"
  ON stripe_payments FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Fix stripe_payment_links
DROP POLICY IF EXISTS "Users can view payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can create payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can update payment links" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can view payment links in their company" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can create payment links for their company" ON stripe_payment_links;
DROP POLICY IF EXISTS "Users can update payment links in their company" ON stripe_payment_links;

CREATE POLICY "Users can view payment links in their company"
  ON stripe_payment_links FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create payment links for their company"
  ON stripe_payment_links FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update payment links in their company"
  ON stripe_payment_links FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Fix stripe_webhook_events
DROP POLICY IF EXISTS "Users can view webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can insert webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can update webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Users can view webhook events in their company" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can insert webhook events for company" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Service can update webhook events in company" ON stripe_webhook_events;

CREATE POLICY "Users can view webhook events in their company"
  ON stripe_webhook_events FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Service can insert webhook events for company"
  ON stripe_webhook_events FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Service can update webhook events in company"
  ON stripe_webhook_events FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Fix paid_invoices
DROP POLICY IF EXISTS "Users can view paid invoices" ON paid_invoices;
DROP POLICY IF EXISTS "Users can insert paid invoices" ON paid_invoices;
DROP POLICY IF EXISTS "Users can view paid invoices in their company" ON paid_invoices;
DROP POLICY IF EXISTS "Users can insert paid invoices for their company" ON paid_invoices;

CREATE POLICY "Users can view paid invoices in their company"
  ON paid_invoices FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert paid invoices for their company"
  ON paid_invoices FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- Fix communication_logs
DROP POLICY IF EXISTS "Users can view communication logs" ON communication_logs;
DROP POLICY IF EXISTS "Users can insert communication logs" ON communication_logs;
DROP POLICY IF EXISTS "Users can view communication logs in their company" ON communication_logs;
DROP POLICY IF EXISTS "Users can insert communication logs for their company" ON communication_logs;

CREATE POLICY "Users can view communication logs in their company"
  ON communication_logs FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert communication logs for their company"
  ON communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- Fix automations (only the WITH CHECK true policy)
DROP POLICY IF EXISTS "Users can insert automations" ON automations;
DROP POLICY IF EXISTS "Users can insert automations for their company" ON automations;

CREATE POLICY "Users can insert automations for their company"
  ON automations FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());
