/*
  # Create Notifications System

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `user_id` (uuid, foreign key to user_profiles)
      - `notification_type` (text) - type of notification (quote_approved, quote_declined, etc.)
      - `title` (text) - notification title
      - `message` (text) - notification message
      - `reference_id` (uuid) - ID of the related record (quote_id, invoice_id, etc.)
      - `reference_type` (text) - type of reference (quote, invoice, payment, etc.)
      - `is_read` (boolean) - whether user has read the notification
      - `created_at` (timestamptz)
      - `read_at` (timestamptz) - when notification was read

    - `user_notification_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to user_profiles)
      - `company_id` (uuid, foreign key to companies)
      - `quote_approved_enabled` (boolean) - default true
      - `quote_declined_enabled` (boolean) - default true
      - `payment_received_enabled` (boolean) - default true
      - `production_completed_enabled` (boolean) - default true
      - `sound_enabled` (boolean) - default true
      - `email_notifications_enabled` (boolean) - default false
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only see their own notifications
    - Users can only manage their own preferences

  3. Triggers
    - Create trigger to auto-generate notifications when quote status changes
    - Create trigger to auto-create default preferences for new users
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  reference_id uuid,
  reference_type text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create user notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_approved_enabled boolean DEFAULT true,
  quote_declined_enabled boolean DEFAULT true,
  payment_received_enabled boolean DEFAULT true,
  production_completed_enabled boolean DEFAULT true,
  sound_enabled boolean DEFAULT true,
  email_notifications_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_company_id ON user_notification_preferences(company_id);

-- Enable RLS
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification preferences
CREATE POLICY "Users can view their own preferences"
  ON user_notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
  ON user_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON user_notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to create default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_notification_preferences (
    user_id,
    company_id,
    quote_approved_enabled,
    quote_declined_enabled,
    payment_received_enabled,
    production_completed_enabled,
    sound_enabled,
    email_notifications_enabled
  ) VALUES (
    NEW.id,
    NEW.company_id,
    true,
    true,
    true,
    true,
    true,
    false
  )
  ON CONFLICT (user_id, company_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default preferences when user profile is created
DROP TRIGGER IF EXISTS trigger_create_default_notification_preferences ON user_profiles;
CREATE TRIGGER trigger_create_default_notification_preferences
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- Function to create notifications when quote status changes
CREATE OR REPLACE FUNCTION notify_quote_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_notification_type text;
  v_title text;
  v_message text;
  v_user_record RECORD;
  v_pref_enabled boolean;
BEGIN
  -- Only create notifications for approved or declined status changes
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    v_notification_type := 'quote_approved';
    v_title := 'Quote Approved';
    v_message := 'Quote #' || COALESCE(NEW.quote_number, NEW.id::text) || ' has been approved';

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

  ELSIF NEW.status = 'declined' AND (OLD.status IS NULL OR OLD.status != 'declined') THEN
    v_notification_type := 'quote_declined';
    v_title := 'Quote Declined';
    v_message := 'Quote #' || COALESCE(NEW.quote_number, NEW.id::text) || ' has been declined';

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

-- Trigger to create notifications when quote status changes
DROP TRIGGER IF EXISTS trigger_notify_quote_status_change ON quotes;
CREATE TRIGGER trigger_notify_quote_status_change
  AFTER UPDATE OF status ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION notify_quote_status_change();

-- Backfill default preferences for existing users (only those with valid company_id)
INSERT INTO user_notification_preferences (
  user_id,
  company_id,
  quote_approved_enabled,
  quote_declined_enabled,
  payment_received_enabled,
  production_completed_enabled,
  sound_enabled,
  email_notifications_enabled
)
SELECT
  up.id,
  up.company_id,
  true,
  true,
  true,
  true,
  true,
  false
FROM user_profiles up
INNER JOIN companies c ON c.id = up.company_id
ON CONFLICT (user_id, company_id) DO NOTHING;
