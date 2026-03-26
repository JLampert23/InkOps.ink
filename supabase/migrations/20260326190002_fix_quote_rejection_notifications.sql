/*
  # Fix Quote Rejection Notifications

  1. Changes
    - Update the quote status change notification trigger to handle 'rejected' status
    - The edge function uses 'rejected' but the trigger was checking for 'declined'
    - Now notifications will be sent when quote status changes to either 'rejected' or 'declined'

  2. Notes
    - This ensures users get notifications when customers decline/reject quotes
*/

-- Update the function to handle both 'rejected' and 'declined' statuses
CREATE OR REPLACE FUNCTION notify_quote_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_type text;
  v_title text;
  v_message text;
  v_user_record RECORD;
  v_pref_enabled boolean;
BEGIN
  -- Only create notifications for approved or rejected/declined status changes
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    v_notification_type := 'quote_approved';
    v_title := 'Quote Approved';
    v_message := 'Quote #' || COALESCE(NEW.quote_number, NEW.id::text) || ' has been approved by ' || COALESCE(NEW.approved_by_name, 'customer');

    -- Create notification for all users in the company who have this notification type enabled
    FOR v_user_record IN
      SELECT up.id, COALESCE(unp.quote_approved_enabled, true) as enabled
      FROM user_profiles up
      LEFT JOIN user_notification_preferences unp ON up.id = unp.user_id
      WHERE up.company_id = NEW.company_id
    LOOP
      IF v_user_record.enabled THEN
        INSERT INTO notifications (
          company_id,
          user_id,
          notification_type,
          title,
          message,
          reference_id,
          reference_type,
          is_read
        ) VALUES (
          NEW.company_id,
          v_user_record.id,
          v_notification_type,
          v_title,
          v_message,
          NEW.id,
          'quote',
          false
        );
      END IF;
    END LOOP;

  ELSIF (NEW.status = 'declined' OR NEW.status = 'rejected') AND 
        (OLD.status IS NULL OR (OLD.status != 'declined' AND OLD.status != 'rejected')) THEN
    v_notification_type := 'quote_declined';
    v_title := 'Quote Declined';
    v_message := 'Quote #' || COALESCE(NEW.quote_number, NEW.id::text) || ' has been declined by ' || COALESCE(NEW.approved_by_name, 'customer');

    -- Create notification for all users in the company who have this notification type enabled
    FOR v_user_record IN
      SELECT up.id, COALESCE(unp.quote_declined_enabled, true) as enabled
      FROM user_profiles up
      LEFT JOIN user_notification_preferences unp ON up.id = unp.user_id
      WHERE up.company_id = NEW.company_id
    LOOP
      IF v_user_record.enabled THEN
        INSERT INTO notifications (
          company_id,
          user_id,
          notification_type,
          title,
          message,
          reference_id,
          reference_type,
          is_read
        ) VALUES (
          NEW.company_id,
          v_user_record.id,
          v_notification_type,
          v_title,
          v_message,
          NEW.id,
          'quote',
          false
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;