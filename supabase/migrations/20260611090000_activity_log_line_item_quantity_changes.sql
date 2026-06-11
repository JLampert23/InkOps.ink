-- 2026-06-11 [3.2-4 add-on] — Jamie's answer to the field-list question:
-- "Anything to add: QUANTITY CHANGES". Adds line-item quantity / price /
-- detail tracking via an UPDATE-ONLY trigger on quote_line_items.
--
-- Why UPDATE-only: QuoteBuilder's full save does delete-all + reinsert-all
-- on quote_line_items (QuoteBuilder.tsx:2259), so INSERT/DELETE triggers
-- would log "removed xN + added xN" junk on every save. Targeted edits in
-- the builder (size cells, unit price, description, color — debounced
-- per-field UPDATEs since the 2026-06-02 debounce fix) are real UPDATE
-- statements, which is exactly the set of events worth logging. Full-save
-- reinserts generate no UPDATE events → silence → no flood.
--
-- Net effect: "PC54: Qty (M) changed from 5 to 10 — by Jamie" style entries.

CREATE OR REPLACE FUNCTION log_quote_line_item_qty_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_actor record;
  v_company_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_col text;
  v_label text;
  -- Size qty columns + the headline numbers. jsonb '->' on a missing key
  -- yields NULL on both sides → no diff → safe if any column is absent.
  v_cols text[] := ARRAY[
    'qty_yxs','qty_ys','qty_ym','qty_yl','qty_yxl',
    'qty_xs','qty_s','qty_m','qty_l','qty_xl',
    'qty_2xl','qty_3xl','qty_4xl','qty_5xl',
    'total_quantity','quantity','unit_price','description','color','item_number'
  ];
BEGIN
  IF NEW.quote_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);

  -- Cheap pre-check before doing any lookups: bail if nothing tracked moved.
  IF NOT EXISTS (
    SELECT 1 FROM unnest(v_cols) AS c
    WHERE v_old -> c IS DISTINCT FROM v_new -> c
  ) THEN
    RETURN NEW;
  END IF;

  -- company_id from the quote (NOT NULL there); doubles as the
  -- deleted-parent guard so logging can never break the line-item write.
  SELECT company_id INTO v_company_id FROM quotes WHERE id = NEW.quote_id;
  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_actor FROM activity_log_actor();
  v_label := COALESCE(
    NULLIF(v_new ->> 'item_number', ''),
    NULLIF(NEW.description, ''),
    'line item'
  );

  FOREACH v_col IN ARRAY v_cols LOOP
    IF v_old -> v_col IS DISTINCT FROM v_new -> v_col THEN
      INSERT INTO quote_activity_log (quote_id, company_id, action, performed_by, performed_by_name, meta)
      VALUES (
        NEW.quote_id, v_company_id, 'line_item_updated',
        v_actor.actor_id, v_actor.actor_name,
        jsonb_build_object(
          'entity', 'line_item',
          'source', v_actor.source,
          'item_label', v_label,
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

DROP TRIGGER IF EXISTS trigger_log_quote_line_item_qty_changes ON quote_line_items;
CREATE TRIGGER trigger_log_quote_line_item_qty_changes
  AFTER UPDATE ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION log_quote_line_item_qty_changes();
