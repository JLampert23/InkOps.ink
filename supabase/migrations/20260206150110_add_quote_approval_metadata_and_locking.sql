/*
  # Add Quote Approval Metadata and Locking

  1. Changes
    - Add `is_locked` boolean field to quotes table (prevents editing after approval)
    - Add `approved_by_name` text field to capture approver's name
    - Add `approved_by_email` text field to capture approver's email
    - Add `approved_ip` text field to capture approver's IP address
    - Add index on is_locked for filtering

  2. Purpose
    - Enable quote locking upon approval to prevent accidental modifications
    - Capture approval metadata for audit trail and compliance
    - Support comprehensive approval tracking

  3. Notes
    - Existing quotes default to unlocked (is_locked = false)
    - Approval metadata populated by approval automation trigger
*/

-- Add approval metadata and locking columns to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_by_name text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_by_email text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_ip text;

-- Add index for filtering locked/unlocked quotes
CREATE INDEX IF NOT EXISTS idx_quotes_is_locked ON quotes(is_locked);

-- Add comment for documentation
COMMENT ON COLUMN quotes.is_locked IS 'Prevents editing when true. Set automatically upon approval.';
COMMENT ON COLUMN quotes.approved_by_name IS 'Name of person who approved the quote';
COMMENT ON COLUMN quotes.approved_by_email IS 'Email of person who approved the quote';
COMMENT ON COLUMN quotes.approved_ip IS 'IP address from which approval was submitted';
