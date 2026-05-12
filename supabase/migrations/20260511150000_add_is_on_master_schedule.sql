/*
  # Master Schedule — gate flag for the new first-tab scheduling view

  1. Why
    Per client spec (2026-05-09): every approved quote / work order now
    lands on a "Master Schedule" first tab before being routed to the
    type-specific schedule (Screen Print / Embroidery / HeatPress-DTF /
    etc). Admin clicks Schedule on each decoration in Master to push it
    to its type tab.

  2. Schema
    Add is_on_master_schedule boolean to production_schedule_entries.
    DEFAULT true so new entries created by the quote-approval cascade
    land on master automatically — no code changes needed in
    quote-actions.

  3. Backfill
    Existing rows pre-2026-05-11 are set to true so admin sees them on
    master and can decide. This is the conservative default — admin can
    click Schedule on anything that should already be on its type tab.

  4. Index
    (company_id, is_on_master_schedule) composite to keep the
    "what's on master" query fast as the table grows.

  Client ran this manually via the Supabase SQL Editor on 2026-05-11.
*/

ALTER TABLE production_schedule_entries
  ADD COLUMN IF NOT EXISTS is_on_master_schedule boolean DEFAULT true;

UPDATE production_schedule_entries
SET is_on_master_schedule = true
WHERE is_on_master_schedule IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_entries_on_master
  ON production_schedule_entries(company_id, is_on_master_schedule);
