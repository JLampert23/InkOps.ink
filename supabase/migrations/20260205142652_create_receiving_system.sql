/*
  # Create Receiving System

  1. New Tables
    - `receiving_logs`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `po_id` (uuid, foreign key to purchase_orders)
      - `received_by` (uuid, foreign key to user_profiles)
      - `received_at` (timestamptz)
      - `status` (text) - 'partial' or 'complete'
      - `notes` (text)
      - `created_at` (timestamptz)
    
    - `receiving_line_items`
      - `id` (uuid, primary key)
      - `receiving_log_id` (uuid, foreign key to receiving_logs)
      - `po_line_item_id` (uuid, foreign key to purchase_order_line_items)
      - `quantity_received` (integer)
      - `quantity_damaged` (integer, default 0)
      - `quantity_short` (integer, default 0)
      - `variance_notes` (text)
      - `scanned_upc` (text)
      - `created_at` (timestamptz)

  2. Modifications
    - Add columns to `purchase_order_line_items`:
      - `quantity_damaged` (integer, default 0)
      - `quantity_short` (integer, default 0)
      - `upc_code` (text)
    
    - Add columns to `purchase_orders`:
      - `expected_delivery_date` (date)
      - `receiving_status` (text, default 'pending') - 'pending', 'partial', 'complete'

  3. Security
    - Enable RLS on all new tables
    - Add policies for company-based access
*/

-- Add columns to purchase_orders
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' AND column_name = 'expected_delivery_date'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN expected_delivery_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_orders' AND column_name = 'receiving_status'
  ) THEN
    ALTER TABLE purchase_orders ADD COLUMN receiving_status text DEFAULT 'pending';
  END IF;
END $$;

-- Add columns to purchase_order_line_items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_order_line_items' AND column_name = 'quantity_damaged'
  ) THEN
    ALTER TABLE purchase_order_line_items ADD COLUMN quantity_damaged integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_order_line_items' AND column_name = 'quantity_short'
  ) THEN
    ALTER TABLE purchase_order_line_items ADD COLUMN quantity_short integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_order_line_items' AND column_name = 'upc_code'
  ) THEN
    ALTER TABLE purchase_order_line_items ADD COLUMN upc_code text;
  END IF;
END $$;

-- Create receiving_logs table
CREATE TABLE IF NOT EXISTS receiving_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  received_by uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  received_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'partial' CHECK (status IN ('partial', 'complete')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create receiving_line_items table
CREATE TABLE IF NOT EXISTS receiving_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_log_id uuid NOT NULL REFERENCES receiving_logs(id) ON DELETE CASCADE,
  po_line_item_id uuid NOT NULL REFERENCES purchase_order_line_items(id) ON DELETE CASCADE,
  quantity_received integer NOT NULL DEFAULT 0,
  quantity_damaged integer DEFAULT 0,
  quantity_short integer DEFAULT 0,
  variance_notes text,
  scanned_upc text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_receiving_logs_company_id ON receiving_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_receiving_logs_po_id ON receiving_logs(po_id);
CREATE INDEX IF NOT EXISTS idx_receiving_logs_received_at ON receiving_logs(received_at);
CREATE INDEX IF NOT EXISTS idx_receiving_line_items_receiving_log_id ON receiving_line_items(receiving_log_id);
CREATE INDEX IF NOT EXISTS idx_receiving_line_items_po_line_item_id ON receiving_line_items(po_line_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_expected_delivery ON purchase_orders(expected_delivery_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_receiving_status ON purchase_orders(receiving_status);
CREATE INDEX IF NOT EXISTS idx_po_line_items_upc_code ON purchase_order_line_items(upc_code) WHERE upc_code IS NOT NULL;

-- Enable RLS
ALTER TABLE receiving_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for receiving_logs
CREATE POLICY "Users can view receiving logs for their company"
  ON receiving_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create receiving logs for their company"
  ON receiving_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update receiving logs for their company"
  ON receiving_logs FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for receiving_line_items
CREATE POLICY "Users can view receiving line items for their company"
  ON receiving_line_items FOR SELECT
  TO authenticated
  USING (
    receiving_log_id IN (
      SELECT id FROM receiving_logs WHERE company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create receiving line items for their company"
  ON receiving_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    receiving_log_id IN (
      SELECT id FROM receiving_logs WHERE company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update receiving line items for their company"
  ON receiving_line_items FOR UPDATE
  TO authenticated
  USING (
    receiving_log_id IN (
      SELECT id FROM receiving_logs WHERE company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );

-- Function to update PO receiving status after receiving
CREATE OR REPLACE FUNCTION update_po_receiving_status()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id uuid;
  v_total_ordered integer;
  v_total_received integer;
BEGIN
  -- Get the PO ID from the receiving log
  SELECT po_id INTO v_po_id FROM receiving_logs WHERE id = NEW.receiving_log_id;

  -- Calculate total ordered vs received
  SELECT 
    COALESCE(SUM(quantity_ordered), 0),
    COALESCE(SUM(quantity_received), 0)
  INTO v_total_ordered, v_total_received
  FROM purchase_order_line_items
  WHERE po_id = v_po_id;

  -- Update PO status
  IF v_total_received >= v_total_ordered THEN
    UPDATE purchase_orders 
    SET receiving_status = 'complete'
    WHERE id = v_po_id;
  ELSIF v_total_received > 0 THEN
    UPDATE purchase_orders 
    SET receiving_status = 'partial'
    WHERE id = v_po_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update PO status when receiving items
DROP TRIGGER IF EXISTS trigger_update_po_receiving_status ON receiving_line_items;
CREATE TRIGGER trigger_update_po_receiving_status
  AFTER INSERT OR UPDATE ON receiving_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_receiving_status();

-- Function to check job readiness after receiving
CREATE OR REPLACE FUNCTION check_job_readiness_after_receiving()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id uuid;
  v_quote_ids uuid[];
  v_quote_id uuid;
  v_all_received boolean;
BEGIN
  -- Get the PO ID
  SELECT po_id INTO v_po_id FROM receiving_logs WHERE id = NEW.receiving_log_id;

  -- Get all quote IDs linked to this PO (through quote_line_items and their garments)
  -- This is a simplified version - you may need to adjust based on your schema
  SELECT ARRAY_AGG(DISTINCT quote_id)
  INTO v_quote_ids
  FROM quote_line_items qli
  INNER JOIN purchase_order_line_items poli ON (
    poli.style_number = qli.style_number 
    AND poli.color = qli.color
    AND poli.po_id = v_po_id
  )
  WHERE qli.quote_id IS NOT NULL;

  -- For each quote, check if all garments are received
  FOREACH v_quote_id IN ARRAY v_quote_ids
  LOOP
    -- Check if all garments for this quote have been received
    -- This is simplified logic - expand based on your needs
    SELECT NOT EXISTS (
      SELECT 1 FROM quote_line_items qli
      WHERE qli.quote_id = v_quote_id
      AND (
        SELECT COALESCE(SUM(poli.quantity_received), 0)
        FROM purchase_order_line_items poli
        WHERE poli.style_number = qli.style_number 
        AND poli.color = qli.color
      ) < (
        COALESCE(qli.xs_quantity, 0) + COALESCE(qli.s_quantity, 0) + 
        COALESCE(qli.m_quantity, 0) + COALESCE(qli.l_quantity, 0) +
        COALESCE(qli.xl_quantity, 0) + COALESCE(qli.xxl_quantity, 0) +
        COALESCE(qli.xxxl_quantity, 0) + COALESCE(qli.xxxxl_quantity, 0) +
        COALESCE(qli.youth_s_quantity, 0) + COALESCE(qli.youth_m_quantity, 0) +
        COALESCE(qli.youth_l_quantity, 0) + COALESCE(qli.youth_xl_quantity, 0) +
        COALESCE(qli.other_size_quantity, 0) + COALESCE(qli.custom_size_quantity, 0)
      )
    ) INTO v_all_received;

    -- If all garments received, update quote status to ready for production
    IF v_all_received THEN
      UPDATE quotes 
      SET status = 'ready_for_production'
      WHERE id = v_quote_id 
      AND status = 'approved';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to check job readiness
DROP TRIGGER IF EXISTS trigger_check_job_readiness ON receiving_line_items;
CREATE TRIGGER trigger_check_job_readiness
  AFTER INSERT OR UPDATE ON receiving_line_items
  FOR EACH ROW
  EXECUTE FUNCTION check_job_readiness_after_receiving();