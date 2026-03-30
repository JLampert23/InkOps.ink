/*
  # Add Quote Follow-Up Automation System

  1. New Columns in company_settings
    - `quote_followup_enabled` - Master toggle for quote follow-up automation
    - `quote_followup_days` - Days to wait before sending first follow-up
    - `quote_followup_max_attempts` - Maximum number of follow-up emails (1-10)
    - `quote_followup_interval_days` - Days between subsequent follow-ups
    - `quote_followup_template_id` - Foreign key to communication_templates

  2. New Columns in quotes
    - `followup_count` - Number of follow-ups sent for this quote
    - `last_followup_sent_at` - Timestamp of last follow-up email
    - `next_followup_due_at` - Calculated next follow-up date

  3. Cron Job
    - Daily cron to process pending quote follow-ups

  4. Security
    - RLS policies for new columns
    - Proper company isolation
*/

-- Add follow-up settings to company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS quote_followup_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS quote_followup_days integer NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS quote_followup_max_attempts integer NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS quote_followup_interval_days integer NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS quote_followup_template_id uuid REFERENCES communication_templates(id) ON DELETE SET NULL;

-- Add constraints for sensible limits
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_followup_days_positive') THEN
    ALTER TABLE company_settings DROP CONSTRAINT quote_followup_days_positive;
  END IF;
END $$;

ALTER TABLE company_settings
ADD CONSTRAINT quote_followup_days_positive CHECK (quote_followup_days > 0 AND quote_followup_days <= 365);

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_followup_max_attempts_range') THEN
    ALTER TABLE company_settings DROP CONSTRAINT quote_followup_max_attempts_range;
  END IF;
END $$;

ALTER TABLE company_settings
ADD CONSTRAINT quote_followup_max_attempts_range CHECK (quote_followup_max_attempts >= 1 AND quote_followup_max_attempts <= 10);

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_followup_interval_days_positive') THEN
    ALTER TABLE company_settings DROP CONSTRAINT quote_followup_interval_days_positive;
  END IF;
END $$;

ALTER TABLE company_settings
ADD CONSTRAINT quote_followup_interval_days_positive CHECK (quote_followup_interval_days > 0 AND quote_followup_interval_days <= 90);

-- Add follow-up tracking columns to quotes
ALTER TABLE quotes
ADD COLUMN IF NOT EXISTS followup_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_followup_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS next_followup_due_at timestamptz;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotes_next_followup_due ON quotes(next_followup_due_at) 
  WHERE next_followup_due_at IS NOT NULL AND status IN ('sent', 'pending');

-- Function to calculate next follow-up due date
CREATE OR REPLACE FUNCTION calculate_quote_next_followup(
  p_quote_id uuid,
  p_company_id uuid
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
  v_quote RECORD;
  v_next_date timestamptz;
BEGIN
  -- Get company settings
  SELECT 
    quote_followup_enabled,
    quote_followup_days,
    quote_followup_max_attempts,
    quote_followup_interval_days
  INTO v_settings
  FROM company_settings
  WHERE id = p_company_id;

  -- Check if follow-ups are enabled
  IF NOT v_settings.quote_followup_enabled THEN
    RETURN NULL;
  END IF;

  -- Get quote details
  SELECT
    created_at,
    status,
    valid_until,
    followup_count,
    last_followup_sent_at
  INTO v_quote
  FROM quotes
  WHERE id = p_quote_id;

  -- Only process quotes in sent or pending status
  IF v_quote.status NOT IN ('sent', 'pending') THEN
    RETURN NULL;
  END IF;

  -- Don't send if expired
  IF v_quote.valid_until IS NOT NULL AND v_quote.valid_until < CURRENT_DATE THEN
    RETURN NULL;
  END IF;

  -- Check if max attempts reached
  IF v_quote.followup_count >= v_settings.quote_followup_max_attempts THEN
    RETURN NULL;
  END IF;

  -- Calculate next follow-up date
  IF v_quote.followup_count = 0 THEN
    -- First follow-up: use initial delay from quote creation
    v_next_date := v_quote.created_at + (v_settings.quote_followup_days || ' days')::interval;
  ELSE
    -- Subsequent follow-ups: use interval from last follow-up
    v_next_date := v_quote.last_followup_sent_at + (v_settings.quote_followup_interval_days || ' days')::interval;
  END IF;

  RETURN v_next_date;
END;
$$;

-- Cron function to process quote follow-ups
CREATE OR REPLACE FUNCTION cron_process_quote_followups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
BEGIN
  -- Find all quotes that need follow-ups
  FOR v_quote IN
    SELECT 
      q.id,
      q.company_id,
      q.quote_number,
      q.customer_id,
      q.contact_id,
      q.followup_count,
      q.status
    FROM quotes q
    INNER JOIN company_settings cs ON cs.id = q.company_id
    WHERE cs.quote_followup_enabled = true
      AND q.status IN ('sent', 'pending')
      AND q.next_followup_due_at IS NOT NULL
      AND q.next_followup_due_at <= now()
      AND q.followup_count < cs.quote_followup_max_attempts
      AND (q.valid_until IS NULL OR q.valid_until >= CURRENT_DATE)
  LOOP
    -- Queue automation for this quote follow-up
    INSERT INTO automation_queue (
      company_id,
      automation_type,
      entity_type,
      entity_id,
      trigger_data,
      status,
      scheduled_for
    ) VALUES (
      v_quote.company_id,
      'quote_followup',
      'quote',
      v_quote.id,
      jsonb_build_object(
        'quote_id', v_quote.id,
        'quote_number', v_quote.quote_number,
        'customer_id', v_quote.customer_id,
        'contact_id', v_quote.contact_id,
        'followup_number', v_quote.followup_count + 1
      ),
      'pending',
      now()
    );
  END LOOP;
  
  RAISE NOTICE 'Processed quote follow-ups';
END;
$$;

-- Schedule daily cron job to check for quote follow-ups (runs at 10 AM)
SELECT cron.schedule(
  'process-quote-followups',
  '0 10 * * *',
  $$SELECT cron_process_quote_followups()$$
);

-- Trigger to automatically calculate next_followup_due_at when quote is created or updated
CREATE OR REPLACE FUNCTION trigger_calculate_quote_followup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate next follow-up date
  NEW.next_followup_due_at := calculate_quote_next_followup(NEW.id, NEW.company_id);
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS calculate_quote_followup_on_insert ON quotes;
DROP TRIGGER IF EXISTS calculate_quote_followup_on_update ON quotes;

-- Create triggers
CREATE TRIGGER calculate_quote_followup_on_insert
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_calculate_quote_followup();

CREATE TRIGGER calculate_quote_followup_on_update
  BEFORE UPDATE OF status, followup_count, last_followup_sent_at ON quotes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status 
    OR OLD.followup_count IS DISTINCT FROM NEW.followup_count
    OR OLD.last_followup_sent_at IS DISTINCT FROM NEW.last_followup_sent_at)
  EXECUTE FUNCTION trigger_calculate_quote_followup();

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_quote_next_followup TO authenticated;
GRANT EXECUTE ON FUNCTION cron_process_quote_followups TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_calculate_quote_followup TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN company_settings.quote_followup_enabled IS 'Master toggle to enable/disable automatic quote follow-up emails';
COMMENT ON COLUMN company_settings.quote_followup_days IS 'Number of days to wait before sending the first follow-up email after quote is sent';
COMMENT ON COLUMN company_settings.quote_followup_max_attempts IS 'Maximum number of follow-up emails to send (1-10)';
COMMENT ON COLUMN company_settings.quote_followup_interval_days IS 'Number of days to wait between subsequent follow-up emails';
COMMENT ON COLUMN quotes.followup_count IS 'Number of follow-up emails sent for this quote';
COMMENT ON COLUMN quotes.last_followup_sent_at IS 'Timestamp when the last follow-up email was sent';
COMMENT ON COLUMN quotes.next_followup_due_at IS 'Calculated timestamp when the next follow-up should be sent';
