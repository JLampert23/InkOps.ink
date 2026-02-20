/*
  # Create ShipStation Audit Log

  1. New Tables
    - `shipstation_order_log`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `invoice_id` (text, foreign key to printavo_invoices)
      - `invoice_number` (text)
      - `shipstation_order_id` (text)
      - `shipstation_order_key` (text)
      - `action` (text) - created, updated, cancelled, error
      - `request_payload` (jsonb)
      - `response_payload` (jsonb)
      - `status_code` (integer)
      - `error_message` (text)
      - `created_at` (timestamptz)
      - `created_by` (uuid, foreign key to auth.users)

  2. Purpose
    - Maintain complete audit trail of ShipStation API interactions
    - Debug integration issues
    - Track order synchronization history
    - Support compliance and troubleshooting

  3. Security
    - Enable RLS on shipstation_order_log
    - Company-scoped access only
    - Admin and shipping managers can view logs
*/

-- Create shipstation_order_log table
CREATE TABLE IF NOT EXISTS shipstation_order_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id text REFERENCES printavo_invoices(id) ON DELETE SET NULL,
  invoice_number text,
  shipstation_order_id text,
  shipstation_order_key text,
  action text NOT NULL,
  request_payload jsonb,
  response_payload jsonb,
  status_code integer,
  error_message text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_shipstation_order_log_company_id 
  ON shipstation_order_log(company_id);

CREATE INDEX IF NOT EXISTS idx_shipstation_order_log_invoice_id 
  ON shipstation_order_log(invoice_id) 
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipstation_order_log_shipstation_order_id 
  ON shipstation_order_log(shipstation_order_id) 
  WHERE shipstation_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipstation_order_log_action 
  ON shipstation_order_log(action);

CREATE INDEX IF NOT EXISTS idx_shipstation_order_log_created_at 
  ON shipstation_order_log(created_at DESC);

-- Enable RLS
ALTER TABLE shipstation_order_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view company shipstation logs"
  ON shipstation_order_log
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can insert shipstation logs"
  ON shipstation_order_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE shipstation_order_log IS 'Audit log for all ShipStation API interactions';
COMMENT ON COLUMN shipstation_order_log.action IS 'Action type: created, updated, cancelled, error';
COMMENT ON COLUMN shipstation_order_log.request_payload IS 'Full request body sent to ShipStation API';
COMMENT ON COLUMN shipstation_order_log.response_payload IS 'Full response body from ShipStation API';
COMMENT ON COLUMN shipstation_order_log.status_code IS 'HTTP status code from ShipStation API';
COMMENT ON COLUMN shipstation_order_log.error_message IS 'Error message if request failed';