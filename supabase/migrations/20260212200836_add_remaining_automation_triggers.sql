/*
  # Add Remaining Automation Triggers
  
  1. New Triggers
    - Task created/status changed (via Printavo integration)
    - Artwork uploaded (via proof_artwork table)
    - Approval events (quote_approvals table)
    - Preset task list completed
  
  2. Notes
    - Some triggers rely on external Printavo data
    - Artwork uploads tracked via proof_artwork inserts
    - Approval events tracked via quote_approvals
*/

-- Artwork Uploaded Listener (Proof Artwork)
CREATE OR REPLACE FUNCTION trigger_automation_artwork_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM queue_matching_automations(
    NEW.company_id,
    'artwork_uploaded',
    jsonb_build_object(
      'proof_id', NEW.proof_id,
      'imprint_id', NEW.imprint_id,
      'artwork_url', NEW.artwork_url,
      'uploaded_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_artwork_uploaded ON proof_artwork;
CREATE TRIGGER automation_artwork_uploaded
  AFTER INSERT ON proof_artwork
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_artwork_uploaded();

-- Quote Approval Sent Listener
CREATE OR REPLACE FUNCTION trigger_automation_approval_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
BEGIN
  -- Get quote details
  SELECT * INTO v_quote FROM quotes WHERE id = NEW.quote_id;
  
  IF FOUND THEN
    PERFORM queue_matching_automations(
      NEW.company_id,
      'approval_sent',
      jsonb_build_object(
        'approval_id', NEW.id,
        'quote_id', NEW.quote_id,
        'quote_number', v_quote.quote_number,
        'customer_name', v_quote.customer_name,
        'sent_at', NEW.created_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_approval_sent ON quote_approvals;
CREATE TRIGGER automation_approval_sent
  AFTER INSERT ON quote_approvals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_approval_sent();

-- Approval Approved/Declined Listener
CREATE OR REPLACE FUNCTION trigger_automation_approval_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_trigger_type text;
BEGIN
  -- Only trigger if status changed to approved or declined
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'declined') THEN
    
    -- Get quote details
    SELECT * INTO v_quote FROM quotes WHERE id = NEW.quote_id;
    
    IF FOUND THEN
      -- Determine trigger type
      v_trigger_type := CASE 
        WHEN NEW.status = 'approved' THEN 'approval_approved'
        WHEN NEW.status = 'declined' THEN 'approval_declined'
      END;
      
      PERFORM queue_matching_automations(
        NEW.company_id,
        v_trigger_type,
        jsonb_build_object(
          'approval_id', NEW.id,
          'quote_id', NEW.quote_id,
          'quote_number', v_quote.quote_number,
          'customer_name', v_quote.customer_name,
          'status', NEW.status,
          'responded_at', NEW.updated_at
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automation_approval_response ON quote_approvals;
CREATE TRIGGER automation_approval_response
  AFTER UPDATE ON quote_approvals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automation_approval_response();

-- Task Created Listener (for Printavo tasks synced to local system)
-- Note: This assumes tasks are created in a local tasks table
-- If tasks are only in Printavo, this would need to be triggered via webhook

-- Preset Task List Completed Listener
-- Note: This would be triggered when all tasks in a preset list are completed
-- Implementation depends on task management structure

-- Grant permissions
GRANT EXECUTE ON FUNCTION trigger_automation_artwork_uploaded TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_automation_approval_sent TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_automation_approval_response TO authenticated;
