/*
  # Create attachments storage bucket + RLS policies

  ## Why
    Client 2026-05-19: after applying the table-level RLS fix from
    2026-05-15, upload still shows "new row violates row-level security
    policy". Reason: the AttachmentsSection component runs in two steps —
    storage upload FIRST, then DB metadata insert. My previous fix only
    addressed the DB row insert. The storage upload is what was actually
    failing all along.

    Diagnosis: no migration in this repo creates an `attachments`
    storage bucket or adds RLS policies for it. The bucket exists in
    Jamie's project (likely auto-created or created from the Dashboard
    at some point), but storage.objects RLS has no policy allowing
    INSERT/SELECT/UPDATE/DELETE scoped to bucket_id='attachments'.
    Default deny → every storage operation against the bucket is
    rejected with the same "new row violates row-level security policy"
    error wording Postgres uses for any RLS rejection.

  ## What changes
    1. INSERT ON CONFLICT DO NOTHING to ensure the bucket exists.
       Marked private (public=false) since attachments can carry
       customer files. The frontend always pulls them via authenticated
       supabase.storage.from('attachments').download(...), so private
       is the right setting.
    2. Four bucket-scoped RLS policies on storage.objects for INSERT,
       SELECT, UPDATE, DELETE. Matches the pattern used for
       imprint-proofs (migration 20260123235132). Any authenticated
       user of any company can access the bucket; tenant isolation is
       enforced by the company_id prefix the frontend bakes into the
       upload path AND by the row-level RLS on the metadata
       attachments table (fixed 2026-05-15).

  ## Safe to re-run
    INSERT ... ON CONFLICT DO NOTHING; DROP POLICY IF EXISTS guards.
*/

-- 1. Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies — bucket-scoped, authenticated users only.
DROP POLICY IF EXISTS "Authenticated users can upload to attachments bucket" ON storage.objects;
CREATE POLICY "Authenticated users can upload to attachments bucket"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Authenticated users can read attachments bucket" ON storage.objects;
CREATE POLICY "Authenticated users can read attachments bucket"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Authenticated users can update attachments bucket" ON storage.objects;
CREATE POLICY "Authenticated users can update attachments bucket"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attachments')
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "Authenticated users can delete from attachments bucket" ON storage.objects;
CREATE POLICY "Authenticated users can delete from attachments bucket"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');
