/*
  # Create chipply_import_logs table

  1. New Tables
    - `chipply_import_logs`
      - `id` (uuid, primary key) - unique log entry identifier
      - `company_id` (uuid, foreign key to companies) - tenant isolation
      - `received_at` (timestamptz) - timestamp when payload was received
      - `raw_json` (jsonb) - full Chipply work order payload
      - `status` (text) - processing status: pending, processed, failed
      - `error_message` (text, nullable) - error details if failed
      - `created_at` (timestamptz) - row creation timestamp
      - `updated_at` (timestamptz) - last-modified timestamp

  2. Indexes
    - Index on (company_id, status) for filtering by status
    - Index on (company_id, received_at) for chronological queries

  3. Security
    - Enable RLS on `chipply_import_logs` table
    - Super-admin and admin read policy
    - No manual insert/update/delete (only via edge function with service role)
*/

CREATE TABLE IF NOT EXISTS chipply_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  raw_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chipply_import_logs_company_status
  ON chipply_import_logs (company_id, status);

CREATE INDEX IF NOT EXISTS idx_chipply_import_logs_company_received
  ON chipply_import_logs (company_id, received_at DESC);

ALTER TABLE chipply_import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view chipply import logs"
  ON chipply_import_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.company_id = chipply_import_logs.company_id
        AND user_profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION update_chipply_import_logs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chipply_import_logs_updated_at
  BEFORE UPDATE ON chipply_import_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_chipply_import_logs_timestamp();
