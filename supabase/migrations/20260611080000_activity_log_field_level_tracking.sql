-- 2026-06-11 [3.2-4] — Activity Log redesign, layer 1: field-level change
-- tracking across quote / work order / invoice (+ line items + imprints).
--
-- What changes:
--   1. log_quote_activity() (the existing AFTER INSERT OR UPDATE trigger fn on
--      quotes) is REPLACED. Old behaviour logged a generic 'updated' row on
--      EVERY update — including ones where only updated_at moved — which is
--      how Jamie's quotes ended up with 1000+ "Quote saved" entries. New
--      behaviour diffs a whitelist of meaningful columns and logs one row per
--      actual change, with old/new values in meta. No whitelisted change = no
--      log row at all.
--   2. New triggers on work_orders and printavo_invoices write into the same
--      quote_activity_log keyed by the parent quote_id, with meta.entity
--      distinguishing the source.
--      NOTE: quote_line_items and quote_imprints deliberately have NO
--      triggers in this version. QuoteBuilder's save flow does
--      delete-all + reinsert-all on both tables (QuoteBuilder.tsx:2259 and
--      :2406), so row-level triggers would log "removed xN + added xN" on
--      every save — worse spam than the bug we're fixing. Item-level
--      tracking requires refactoring the save flow to targeted upserts
--      first (tracked as phase 2 of [3.2-4]). The quotes-table total /
--      subtotal / tax diffs still capture the net effect of item edits.
--   3. Attribution: meta.source = 'user' when auth.uid() resolves (request
--      came through PostgREST with a user JWT — i.e. someone clicked
--      something), 'automation' when it doesn't (service-role writes from
--      edge functions, cron, db triggers).
--
-- Rendering note: old/new values are stored RAW (as text); the frontend
-- humanizes field names and formats dates/currency. Existing legacy rows are
-- untouched and keep rendering through the legacy label map.

-- ---------------------------------------------------------------------------
-- Helper: resolve actor (user id, display name, source) once per statement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION activity_log_actor()
RETURNS TABLE (actor_id uuid, actor_name text, source text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
  v_name text;
BEGIN
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  IF v_uid IS NOT NULL THEN
    SELECT full_name INTO v_name FROM user_profiles WHERE id = v_uid;
    RETURN QUERY SELECT v_uid, COALESCE(NULLIF(v_name, ''), 'User'), 'user'::text;
  ELSE
    RETURN QUERY SELECT NULL::uuid, 'Automation'::text, 'automation'::text;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. quotes — replace log_quote_activity with field-level diffing.
--    Same function name + existing trigger keeps working (no DDL churn).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_quote_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_actor record;
  v_old jsonb;
  v_new jsonb;
  v_col text;
  -- Whitelist of columns worth surfacing to the user. jsonb '->' on a key
  -- that doesn't exist returns NULL on both sides → no diff → safe even if
  -- a column in this list is missing from the live schema.
  v_cols text[] := ARRAY[
    'status',
    'production_due_date',
    'customer_due_date',
    'payment_due_date',
    'valid_until',
    'total',
    'subtotal',
    'tax_amount',
    'discount',
    'terms',
    'delivery_method',
    'po_number',
    'customer_name',
    'notes',
    'customer_notes',
    'nickname'
  ];
BEGIN
  SELECT * INTO v_actor FROM activity_log_actor();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by, performed_by_name, meta)
    VALUES (
      NEW.id, NEW.company_id, 'created',
      COALESCE(v_actor.actor_id, NEW.created_by),
      v_actor.actor_name,
      jsonb_build_object('entity', 'quote', 'source', v_actor.source, 'new_status', NEW.status)
    );
    RETURN NEW;
  END IF;

  -- UPDATE: one log row per changed whitelisted column.
  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_col IN ARRAY v_cols LOOP
    IF v_old -> v_col IS DISTINCT FROM v_new -> v_col THEN
      IF v_col = 'status' THEN
        INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by, performed_by_name, meta)
        VALUES (
          NEW.id, NEW.company_id, 'status_changed',
          v_actor.actor_id, v_actor.actor_name,
          jsonb_build_object(
            'entity', 'quote',
            'source', v_actor.source,
            'old_status', OLD.status,
            'new_status', NEW.status
          )
        );
      ELSE
        INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by, performed_by_name, meta)
        VALUES (
          NEW.id, NEW.company_id, 'quote_field_changed',
          v_actor.actor_id, v_actor.actor_name,
          jsonb_build_object(
            'entity', 'quote',
            'source', v_actor.source,
            'field', v_col,
            'old_value', v_old ->> v_col,
            'new_value', v_new ->> v_col
          )
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (trigger_log_quote_activity on quotes already exists and points at this
--  function name — replaced in place, no re-create needed.)

-- ---------------------------------------------------------------------------
-- 2. work_orders — field-level diffs, written against the parent quote.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_work_order_field_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor record;
  v_old jsonb;
  v_new jsonb;
  v_col text;
  v_cols text[] := ARRAY[
    'status',
    'priority',
    'production_due_date',
    'customer_due_date',
    'assigned_to',
    'total_quantity'
  ];
BEGIN
  IF NEW.quote_id IS NULL THEN
    RETURN NEW; -- orphan WO: nowhere to attach the log entry
  END IF;

  SELECT * INTO v_actor FROM activity_log_actor();
  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_col IN ARRAY v_cols LOOP
    IF v_old -> v_col IS DISTINCT FROM v_new -> v_col THEN
      INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by, performed_by_name, meta)
      VALUES (
        NEW.quote_id, NEW.company_id,
        CASE WHEN v_col = 'status' THEN 'work_order_status_changed' ELSE 'work_order_field_changed' END,
        v_actor.actor_id, v_actor.actor_name,
        jsonb_build_object(
          'entity', 'work_order',
          'source', v_actor.source,
          'work_order_number', NEW.work_order_number,
          'field', v_col,
          'old_value', v_old ->> v_col,
          'new_value', v_new ->> v_col,
          'old_status', CASE WHEN v_col = 'status' THEN v_old ->> v_col END,
          'new_status', CASE WHEN v_col = 'status' THEN v_new ->> v_col END
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_work_order_field_changes ON work_orders;
CREATE TRIGGER trigger_log_work_order_field_changes
  AFTER UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_work_order_field_changes();

-- ---------------------------------------------------------------------------
-- 3. printavo_invoices — total / amount_paid / status_stage / due_date.
--    quote_id lives in raw_data->>'quote_id' (set on creation by
--    quote-actions approve flow). Skip rows that don't carry it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_invoice_field_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor record;
  v_quote_id uuid;
  v_company_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_col text;
  v_cols text[] := ARRAY[
    'total',
    'amount_paid',
    'status_stage',
    'due_date'
  ];
BEGIN
  BEGIN
    v_quote_id := (NEW.raw_data ->> 'quote_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_quote_id := NULL;
  END;
  IF v_quote_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Guard against dangling quote ids (deleted quotes) — FK on the log table
  -- would reject the insert and break the invoice write. Also source
  -- company_id from the quote (guaranteed NOT NULL there) rather than the
  -- invoice row, since quote_activity_log.company_id is NOT NULL.
  SELECT company_id INTO v_company_id FROM quotes WHERE id = v_quote_id;
  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_actor FROM activity_log_actor();
  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  FOREACH v_col IN ARRAY v_cols LOOP
    IF v_old -> v_col IS DISTINCT FROM v_new -> v_col THEN
      INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by, performed_by_name, meta)
      VALUES (
        v_quote_id, v_company_id, 'invoice_field_changed',
        v_actor.actor_id, v_actor.actor_name,
        jsonb_build_object(
          'entity', 'invoice',
          'source', v_actor.source,
          'invoice_number', NEW.invoice_number,
          'field', v_col,
          'old_value', v_old ->> v_col,
          'new_value', v_new ->> v_col
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_invoice_field_changes ON printavo_invoices;
CREATE TRIGGER trigger_log_invoice_field_changes
  AFTER UPDATE ON printavo_invoices
  FOR EACH ROW
  EXECUTE FUNCTION log_invoice_field_changes();
