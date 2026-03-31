/*
  # Add Notification Email Forwarding Trigger
  
  1. Purpose
    - Automatically forward notifications to configured email address
    - Trigger fires after new notification is inserted
    - Calls Edge Function asynchronously to prevent blocking
  
  2. Changes
    - Create function to call email forwarding Edge Function
    - Create trigger on notifications table INSERT
  
  3. Security
    - Uses service role to call Edge Function
    - Only forwards if company has email forwarding enabled
    - Does not block notification creation on email failure
  
  4. Notes
    - Runs asynchronously using pg_net extension
    - Gracefully handles failures without affecting notification creation
    - Respects company-level email forwarding settings
*/

-- Enable pg_net extension if not already enabled (for async HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to forward notification via email
CREATE OR REPLACE FUNCTION forward_notification_to_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_request_id bigint;
BEGIN
  -- Get Supabase URL and service role key from environment
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Fallback to default URL if not set
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://zphneqaxhwphmcmtcfwg.supabase.co';
  END IF;

  -- Make async HTTP request to Edge Function (non-blocking)
  -- This prevents email failures from blocking notification creation
  SELECT INTO v_request_id extensions.http_post(
    url := v_supabase_url || '/functions/v1/forward-notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'notification_id', NEW.id::text,
      'company_id', NEW.company_id::text,
      'notification_type', NEW.notification_type,
      'title', NEW.title,
      'message', NEW.message,
      'reference_type', NEW.reference_type,
      'reference_id', NEW.reference_id::text
    )
  );

  -- Log the request for debugging (optional)
  RAISE LOG 'Notification email forwarding queued: notification_id=%, request_id=%', NEW.id, v_request_id;

  -- Always return NEW to allow notification creation to succeed
  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block notification creation
    RAISE WARNING 'Failed to queue notification email: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger to forward notifications after insert
DROP TRIGGER IF EXISTS trigger_forward_notification_email ON notifications;

CREATE TRIGGER trigger_forward_notification_email
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION forward_notification_to_email();

-- Add comment
COMMENT ON FUNCTION forward_notification_to_email IS 'Automatically forwards notifications to configured email address via Edge Function';
