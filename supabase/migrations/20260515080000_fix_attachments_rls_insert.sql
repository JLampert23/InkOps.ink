/*
  # Fix attachments RLS — allow INSERT for company members

  ## Why
    Client reported 2026-05-15: uploading a file to a quote shows
    "new row violates row-level security policy" and the attachment
    is rejected.

    Root cause: the original policy (migration 20260422183447) used
    FOR ALL with only a USING clause. In Postgres RLS:
      - USING is evaluated against EXISTING rows (SELECT/UPDATE/DELETE)
      - WITH CHECK is evaluated against NEW rows (INSERT/UPDATE)
    Without WITH CHECK, every INSERT is rejected because no predicate
    validates the new row, even when the user is a legitimate member
    of the company referenced in company_id.

  ## What changes
    Drop the existing policy. Recreate FOR ALL with both USING (so
    members can read/update/delete their company's attachments) AND
    WITH CHECK (so they can INSERT new ones bound to their company).

    Behavior is unchanged for reads/updates/deletes. Inserts now
    succeed as long as the company_id matches the caller's company.

  ## Safe to re-run
    DROP POLICY IF EXISTS + CREATE POLICY.
*/

DROP POLICY IF EXISTS "Company members can manage their own attachments" ON attachments;

CREATE POLICY "Company members can manage their own attachments"
  ON attachments
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );
