-- Attachments table for quotes and work orders
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  reference_type text NOT NULL CHECK (reference_type IN ('quote','work_order')),
  reference_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_url text,
  file_size bigint,
  mime_type text,
  uploaded_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attachments_reference_idx ON attachments(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS attachments_company_idx ON attachments(company_id);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage their own attachments"
  ON attachments
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );
