/*
  # Add receiving (check-in) columns to garment_requirements_staging

  1. Why
    Per client request 2026-05-08, when a garment is "Marked Ordered" in
    the Garment Order Report it should be checkable-in via the Receiving
    page even when no formal Purchase Order exists. The existing receiving
    flow is PO-only. To extend it to non-PO items we need a place to
    record received quantities directly on the staging row.

  2. New columns on garment_requirements_staging
    - quantity_received (int, default 0)  — running total received against
      this row when no PO exists; complements purchase_order_line_items
      .quantity_received which is used for PO-backed receiving.
    - is_received (boolean, default false) — true once quantity_received
      meets or exceeds total_quantity. Set by the application layer when
      a Quick Receive submission completes.
    - received_at (timestamptz) — last received timestamp. Helpful for
      sorting "recently received" in the dashboard.
    - received_by (text) — user_id or display name of the person who
      recorded the receipt. Audit trail.

  3. No new policies — existing RLS already covers UPDATE on this table.

  4. Stock Status semantics (downstream effect)
    The ProductionScheduler enrichment that powers the Stock Status badge
    on schedule rows currently treats "partial" as partial-ordering. After
    this migration ships and the receiving UI lands, the enrichment will
    be updated to read quantity_received from this column AND from
    purchase_order_line_items so the badge reflects ACTUAL receipt
    progress, matching the client's spec (red ordered / yellow partial /
    green received).
*/

ALTER TABLE garment_requirements_staging
  ADD COLUMN IF NOT EXISTS quantity_received int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_received boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_by text;

CREATE INDEX IF NOT EXISTS idx_garment_requirements_received_status
  ON garment_requirements_staging(company_id, is_ordered, is_received);
