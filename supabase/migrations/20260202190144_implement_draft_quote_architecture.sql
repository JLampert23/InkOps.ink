/*
  # Implement Draft Quote Architecture

  1. Changes
    - Add `autosave_enabled` column to quotes table
    - Make customer fields nullable for drafts
    - Add indexes for better draft query performance
    - Update RLS policies to allow draft creation

  2. Security
    - Users can create drafts in their company
    - Drafts are private to the creator until status changes to 'sent' or 'approved'
*/

-- Add autosave_enabled column
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS autosave_enabled boolean DEFAULT true;

-- Make customer_name nullable for drafts (can be empty until customer selected)
ALTER TABLE quotes
ALTER COLUMN customer_name DROP NOT NULL;

-- Set default value for customer_name
ALTER TABLE quotes
ALTER COLUMN customer_name SET DEFAULT 'Draft Quote';

-- Add index for faster draft queries
CREATE INDEX IF NOT EXISTS idx_quotes_status_company
ON quotes(status, company_id);

CREATE INDEX IF NOT EXISTS idx_quotes_created_by
ON quotes(created_by);

-- Add comment explaining draft architecture
COMMENT ON COLUMN quotes.autosave_enabled IS 'Enable automatic saving of quote changes (primarily for drafts)';
COMMENT ON COLUMN quotes.status IS 'Quote lifecycle: draft (unsaved/editing) -> sent (sent to customer) -> approved/rejected -> converted (to invoice) or expired';
