/*
  # Fix quote_approvals trigger referencing non-existent column

  1. Changes
    - Fix `trigger_automation_approval_response` function that references `OLD.status` / `NEW.status`
      on `quote_approvals` table, which has no `status` column
    - The trigger should fire when `is_used` changes from false to true instead

  2. Notes
    - The `quote_approvals` table has `is_used` boolean, not `status` text
    - The automation should be triggered based on the quote's status, not the approval record
*/

CREATE OR REPLACE FUNCTION trigger_automation_approval_response()
RETURNS TRIGGER AS $$
DECLARE
  v_quote RECORD;
  v_trigger_type text;
BEGIN
  IF OLD.is_used IS DISTINCT FROM NEW.is_used AND NEW.is_used = true THEN
    SELECT * INTO v_quote FROM quotes WHERE id = NEW.quote_id;

    IF FOUND THEN
      v_trigger_type := CASE
        WHEN v_quote.status = 'approved' THEN 'approval_approved'
        WHEN v_quote.status = 'rejected' THEN 'approval_declined'
        ELSE NULL
      END;

      IF v_trigger_type IS NOT NULL THEN
        PERFORM queue_matching_automations(
          NEW.company_id,
          v_trigger_type,
          jsonb_build_object(
            'approval_id', NEW.id,
            'quote_id', NEW.quote_id,
            'quote_number', v_quote.quote_number,
            'customer_name', v_quote.customer_name,
            'status', v_quote.status,
            'responded_at', NEW.updated_at
          )
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;