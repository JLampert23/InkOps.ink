/*
  # Add quantity_received_by_size to garment_requirements_staging

  ## Why
    Client 2026-05-14: Mark Ordered receive flow needs the same size-level
    check-in UI that the PO receive flow already has. The PO path tracks
    received qty per size via purchase_order_line_items (one row per size).
    The Mark Ordered path uses garment_requirements_staging which has a
    `sizes` jsonb breakdown of what's needed but only an aggregate
    `quantity_received` int — no per-size received tracking.

  ## What changes
    Add `quantity_received_by_size` jsonb column.

    Format mirrors the `sizes` column: {"S": 5, "M": 10, "L": 0, ...}
    where each value is the cumulative units received for that size.

    The existing `quantity_received` aggregate keeps working — the modal
    save handler will keep it in sync (sum of per-size values).

  ## Backfill
    Existing rows where quantity_received > 0 don't have a per-size
    breakdown of those receipts. Leaving the new column as '{}' is
    acceptable — admin's pending receives haven't tracked by size up to
    now, and the aggregate is still authoritative for "is this fully
    received?". Future receives will populate the per-size map and the
    UI will show the breakdown going forward.

  ## Safe to re-run
    ADD COLUMN IF NOT EXISTS guards against double-apply.
*/

ALTER TABLE garment_requirements_staging
  ADD COLUMN IF NOT EXISTS quantity_received_by_size jsonb DEFAULT '{}'::jsonb;
