-- 2026-06-10 [3.2-2] — Move payment request control from company-level to
-- customer-level. Each customer row now owns the on/off toggle.
--
-- Backfill: every existing customer inherits their company's previous global
-- setting so the day-of-deploy behaviour is identical to what it was before.
-- New customers (added after this migration) default to TRUE — most customers
-- in a real screen-print business want payment requests by default.
--
-- The company_settings.auto_send_payment_link column is intentionally LEFT IN
-- PLACE. We just stop reading it from the approval flow. Keeping the column
-- avoids breaking any external integration / report / view that might still
-- reference it, and lets us roll back the UX change without a schema rollback.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS payment_request_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN customers.payment_request_enabled IS
  '[3.2-2] If true, approving a quote for this customer auto-creates a Stripe payment link (50% mandatory minimum). Replaces the legacy company_settings.auto_send_payment_link global toggle.';

-- One-time backfill from the legacy global toggle so behaviour is unchanged
-- on the day this ships. The default of TRUE only applies to NEW customers
-- inserted after migration; existing rows are explicitly aligned to whatever
-- their company had configured.
UPDATE customers c
SET payment_request_enabled = COALESCE(cs.auto_send_payment_link, true)
FROM company_settings cs
WHERE c.company_id = cs.id;

-- Index supports the lookup in quote-actions edge function where we read this
-- column by customer id on every quote approval. Customer table is small per
-- company but quotes can run frequently — a simple btree on the FK source is
-- enough; we filter on .id so the existing PK index already covers single-row
-- reads. No new index needed.
