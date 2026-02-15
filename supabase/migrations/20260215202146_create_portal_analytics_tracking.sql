/*
  # Create Portal Analytics Tracking

  1. New Tables
    - `portal_analytics_events` - Track all portal activity events
      - `id` (uuid, primary key)
      - `company_id` (uuid) - References company_settings
      - `customer_id` (uuid) - References customers table
      - `event_type` (text) - Type of event (invoice_viewed, invoice_paid, quote_viewed, etc.)
      - `resource_type` (text) - Type of resource (invoice, quote, proof)
      - `resource_id` (uuid) - ID of the resource
      - `metadata` (jsonb) - Additional metadata (IP, user agent, etc.)
      - `created_at` (timestamptz)

    - `portal_analytics_summary` - Materialized view for quick stats
      - Aggregate views, approvals, payments by resource

  2. Security
    - Enable RLS on analytics table
    - Analytics can only be accessed by authenticated users of the company
    - Edge functions can write analytics events

  3. Indexes
    - Index on company_id, resource_type, resource_id for fast lookups
    - Index on event_type for filtering
    - Index on created_at for time-based queries

  4. Functions
    - Helper function to get analytics for a specific resource
    - Helper function to track an event
*/

-- Create portal analytics events table
CREATE TABLE IF NOT EXISTS portal_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'invoice_viewed',
      'invoice_paid',
      'quote_viewed',
      'quote_approved',
      'quote_declined',
      'proof_viewed',
      'proof_approved',
      'proof_rejected'
    )
  ),
  resource_type text NOT NULL CHECK (
    resource_type IN ('invoice', 'quote', 'proof')
  ),
  resource_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_portal_analytics_company
  ON portal_analytics_events(company_id);

CREATE INDEX IF NOT EXISTS idx_portal_analytics_customer
  ON portal_analytics_events(customer_id);

CREATE INDEX IF NOT EXISTS idx_portal_analytics_resource
  ON portal_analytics_events(company_id, resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_portal_analytics_event_type
  ON portal_analytics_events(event_type);

CREATE INDEX IF NOT EXISTS idx_portal_analytics_created_at
  ON portal_analytics_events(created_at DESC);

-- Enable RLS
ALTER TABLE portal_analytics_events ENABLE ROW LEVEL SECURITY;

-- Service role can manage all analytics
CREATE POLICY "Service role can manage analytics"
  ON portal_analytics_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can view analytics for their company
CREATE POLICY "Users can view company analytics"
  ON portal_analytics_events
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Function to track a portal event
CREATE OR REPLACE FUNCTION track_portal_event(
  p_company_id uuid,
  p_customer_id uuid,
  p_event_type text,
  p_resource_type text,
  p_resource_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO portal_analytics_events (
    company_id,
    customer_id,
    event_type,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_company_id,
    p_customer_id,
    p_event_type,
    p_resource_type,
    p_resource_id,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Function to get analytics for a specific resource
CREATE OR REPLACE FUNCTION get_resource_analytics(
  p_company_id uuid,
  p_resource_type text,
  p_resource_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_views', COUNT(*) FILTER (WHERE event_type LIKE '%_viewed'),
    'last_viewed_at', MAX(created_at) FILTER (WHERE event_type LIKE '%_viewed'),
    'approved_at', MAX(created_at) FILTER (WHERE event_type LIKE '%_approved'),
    'declined_at', MAX(created_at) FILTER (WHERE event_type LIKE '%_declined'),
    'rejected_at', MAX(created_at) FILTER (WHERE event_type LIKE '%_rejected'),
    'paid_at', MAX(created_at) FILTER (WHERE event_type = 'invoice_paid'),
    'unique_viewers', COUNT(DISTINCT customer_id),
    'events', json_agg(
      json_build_object(
        'event_type', event_type,
        'created_at', created_at,
        'metadata', metadata
      ) ORDER BY created_at DESC
    )
  )
  INTO v_result
  FROM portal_analytics_events
  WHERE company_id = p_company_id
    AND resource_type = p_resource_type
    AND resource_id = p_resource_id;

  RETURN v_result;
END;
$$;

-- Function to get global portal analytics
CREATE OR REPLACE FUNCTION get_portal_analytics_summary(
  p_company_id uuid,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  v_start_date := COALESCE(p_start_date, now() - interval '30 days');
  v_end_date := COALESCE(p_end_date, now());

  SELECT json_build_object(
    'total_invoice_views', COUNT(*) FILTER (WHERE event_type = 'invoice_viewed'),
    'total_quote_views', COUNT(*) FILTER (WHERE event_type = 'quote_viewed'),
    'total_proof_views', COUNT(*) FILTER (WHERE event_type = 'proof_viewed'),
    'total_quote_approvals', COUNT(*) FILTER (WHERE event_type = 'quote_approved'),
    'total_quote_declines', COUNT(*) FILTER (WHERE event_type = 'quote_declined'),
    'total_proof_approvals', COUNT(*) FILTER (WHERE event_type = 'proof_approved'),
    'total_proof_rejections', COUNT(*) FILTER (WHERE event_type = 'proof_rejected'),
    'total_invoice_payments', COUNT(*) FILTER (WHERE event_type = 'invoice_paid'),
    'approval_rate', CASE 
      WHEN COUNT(*) FILTER (WHERE event_type IN ('quote_approved', 'quote_declined')) > 0
      THEN ROUND(
        100.0 * COUNT(*) FILTER (WHERE event_type = 'quote_approved') / 
        NULLIF(COUNT(*) FILTER (WHERE event_type IN ('quote_approved', 'quote_declined')), 0),
        2
      )
      ELSE 0
    END,
    'proof_approval_rate', CASE 
      WHEN COUNT(*) FILTER (WHERE event_type IN ('proof_approved', 'proof_rejected')) > 0
      THEN ROUND(
        100.0 * COUNT(*) FILTER (WHERE event_type = 'proof_approved') / 
        NULLIF(COUNT(*) FILTER (WHERE event_type IN ('proof_approved', 'proof_rejected')), 0),
        2
      )
      ELSE 0
    END,
    'unique_customers', COUNT(DISTINCT customer_id),
    'events_by_day', (
      SELECT json_agg(
        json_build_object(
          'date', date_trunc('day', created_at)::date,
          'count', COUNT(*)
        )
        ORDER BY date_trunc('day', created_at)
      )
      FROM portal_analytics_events
      WHERE company_id = p_company_id
        AND created_at >= v_start_date
        AND created_at <= v_end_date
      GROUP BY date_trunc('day', created_at)
    ),
    'events_by_type', (
      SELECT json_agg(
        json_build_object(
          'event_type', event_type,
          'count', COUNT(*)
        )
        ORDER BY COUNT(*) DESC
      )
      FROM portal_analytics_events
      WHERE company_id = p_company_id
        AND created_at >= v_start_date
        AND created_at <= v_end_date
      GROUP BY event_type
    )
  )
  INTO v_result
  FROM portal_analytics_events
  WHERE company_id = p_company_id
    AND created_at >= v_start_date
    AND created_at <= v_end_date;

  RETURN v_result;
END;
$$;

-- Function to calculate time-to-action metrics
CREATE OR REPLACE FUNCTION get_time_to_action_metrics(
  p_company_id uuid,
  p_resource_type text,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  v_start_date := COALESCE(p_start_date, now() - interval '30 days');
  v_end_date := COALESCE(p_end_date, now());

  WITH first_view AS (
    SELECT 
      resource_id,
      MIN(created_at) as first_viewed_at
    FROM portal_analytics_events
    WHERE company_id = p_company_id
      AND resource_type = p_resource_type
      AND event_type LIKE '%_viewed'
      AND created_at >= v_start_date
      AND created_at <= v_end_date
    GROUP BY resource_id
  ),
  action_taken AS (
    SELECT 
      resource_id,
      MIN(created_at) as action_at,
      event_type
    FROM portal_analytics_events
    WHERE company_id = p_company_id
      AND resource_type = p_resource_type
      AND event_type IN ('quote_approved', 'quote_declined', 'proof_approved', 'proof_rejected', 'invoice_paid')
      AND created_at >= v_start_date
      AND created_at <= v_end_date
    GROUP BY resource_id, event_type
  )
  SELECT json_build_object(
    'avg_time_to_action_hours', ROUND(AVG(EXTRACT(EPOCH FROM (a.action_at - f.first_viewed_at)) / 3600)::numeric, 2),
    'median_time_to_action_hours', ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (a.action_at - f.first_viewed_at)) / 3600)::numeric, 2),
    'min_time_to_action_hours', ROUND(MIN(EXTRACT(EPOCH FROM (a.action_at - f.first_viewed_at)) / 3600)::numeric, 2),
    'max_time_to_action_hours', ROUND(MAX(EXTRACT(EPOCH FROM (a.action_at - f.first_viewed_at)) / 3600)::numeric, 2),
    'total_records', COUNT(*)
  )
  INTO v_result
  FROM first_view f
  INNER JOIN action_taken a ON f.resource_id = a.resource_id;

  RETURN v_result;
END;
$$;
