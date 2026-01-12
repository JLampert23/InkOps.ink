/*
  # Add status_stage field to invoices

  1. Changes
    - Add `status_stage` column to `printavo_invoices` table
    - Status stages: 'billing_queue', 'sent', 'partial', 'paid', 'overdue'
    - Default value: 'billing_queue'
    - Index on status_stage for efficient queries

  2. Purpose
    - Track invoice lifecycle stages
    - Enable filtering of paid invoices
    - Support accounts receivable workflow
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'printavo_invoices' AND column_name = 'status_stage'
  ) THEN
    ALTER TABLE printavo_invoices
    ADD COLUMN status_stage text DEFAULT 'billing_queue';

    ALTER TABLE printavo_invoices
    ADD CONSTRAINT printavo_invoices_status_stage_check
    CHECK (status_stage IN ('billing_queue', 'sent', 'partial', 'paid', 'overdue', 'accounts_receivable'));

    CREATE INDEX IF NOT EXISTS idx_printavo_invoices_status_stage
    ON printavo_invoices(status_stage);

    UPDATE printavo_invoices
    SET status_stage = CASE
      WHEN status = 'Paid' THEN 'paid'
      WHEN status = 'Partially Paid' THEN 'partial'
      WHEN status = 'Unpaid' THEN 'billing_queue'
      ELSE 'billing_queue'
    END
    WHERE status_stage IS NULL OR status_stage = 'billing_queue';
  END IF;
END $$;