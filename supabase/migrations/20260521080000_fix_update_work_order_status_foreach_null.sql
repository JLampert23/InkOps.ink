/*
  # Fix "FOREACH expression must not be null" on PO receiving

  ## Why
    Client reported on 2026-05-21: receiving against an open PO and
    clicking "Complete Receiving" throws the popup
      "Failed to record receipt: FOREACH expression must not be null"
    The save is rolled back and the PO line items keep their previous
    state.

  ## Root cause
    The AFTER INSERT trigger on receiving_line_items
    (update_work_order_status_after_receiving, installed by migration
    20260206154410) reads the linked work orders into an array and
    iterates them with FOREACH:

      SELECT ARRAY_AGG(DISTINCT work_order_id)
      INTO v_work_order_ids
      FROM garment_requirements_staging
      WHERE po_id = v_po_id AND work_order_id IS NOT NULL;

      FOREACH v_work_order_id IN ARRAY v_work_order_ids LOOP ...

    When NO garment_requirements_staging rows reference the PO (or
    none have a work_order_id), ARRAY_AGG returns NULL — not an empty
    array. PostgreSQL then raises "FOREACH expression must not be
    null" on the loop. The trigger errors out, the receiving INSERT
    is rolled back, and process_receiving's EXCEPTION WHEN OTHERS
    block returns {success: false, message: '...FOREACH expression must
    not be null'}.

    Hits PO-only receivings against POs created from older quotes
    whose staging rows lost their work_order_id link (the same kind
    of legacy rows we already saw cause the missing-WO# bug in the
    Receiving Dashboard table).

  ## What changes
    Rewrite the trigger to:
      1. Coalesce ARRAY_AGG to an empty array so it's never NULL.
      2. Short-circuit when the array is empty so we don't even
         enter the FOREACH (defensive — array_length(NULL,1) is NULL
         which IF-guards correctly, but the COALESCE keeps the loop
         contract clean).

    Behavior unchanged for the happy path. Just no more null array.

  ## Safe to re-run
    CREATE OR REPLACE FUNCTION; the trigger binding (DROP/CREATE in
    the original migration) is unaffected.
*/

CREATE OR REPLACE FUNCTION update_work_order_status_after_receiving()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id uuid;
  v_work_order_ids uuid[];
  v_work_order_id uuid;
  v_is_ready boolean;
BEGIN
  -- Get PO ID from receiving log
  SELECT po_id INTO v_po_id
  FROM receiving_logs
  WHERE id = NEW.receiving_log_id;

  -- Collect distinct work order ids linked to this PO via garment
  -- requirements staging. COALESCE so an empty result yields an
  -- empty array (not NULL) — FOREACH IN ARRAY NULL raises a runtime
  -- error and was bringing down every PO receive whose staging rows
  -- had lost their work_order_id link (client 2026-05-21).
  SELECT COALESCE(ARRAY_AGG(DISTINCT work_order_id), ARRAY[]::uuid[])
  INTO v_work_order_ids
  FROM garment_requirements_staging
  WHERE po_id = v_po_id
    AND work_order_id IS NOT NULL;

  IF COALESCE(array_length(v_work_order_ids, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  FOREACH v_work_order_id IN ARRAY v_work_order_ids
  LOOP
    v_is_ready := check_work_order_readiness(v_work_order_id);

    IF v_is_ready THEN
      UPDATE work_orders
      SET
        garments_ready = true,
        garments_received_at = COALESCE(garments_received_at, now()),
        ready_for_production = true,
        ready_for_production_at = COALESCE(ready_for_production_at, now()),
        status = CASE
          WHEN status = 'draft' THEN 'in_progress'
          ELSE status
        END,
        updated_at = now()
      WHERE id = v_work_order_id
        AND garments_ready = false;

      IF FOUND THEN
        INSERT INTO purchase_order_activity_log (
          company_id,
          po_id,
          action,
          performed_by,
          performed_by_name,
          notes,
          meta
        )
        SELECT
          wo.company_id,
          v_po_id,
          'work_order_ready',
          NEW.receiving_log_id::text::uuid,
          'Receiving System',
          format('Work Order %s is now ready for production - all garments received', wo.work_order_number),
          jsonb_build_object(
            'work_order_id', v_work_order_id,
            'work_order_number', wo.work_order_number
          )
        FROM work_orders wo
        WHERE wo.id = v_work_order_id;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
