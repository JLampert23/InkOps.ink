/*
  # Create Work Orders Table

  1. New Tables
    - `work_orders`
      - `id` (uuid, primary key) - Unique identifier
      - `work_order_number` (text) - Human-readable WO number
      - `company_id` (uuid) - Company isolation
      - `quote_id` (uuid) - Reference to originating quote
      - `customer_id` (uuid) - Reference to customer
      - `customer_name` (text) - Cached customer name
      - `status` (text) - Current status (draft, in_progress, completed, cancelled)
      - `priority` (text) - Priority level (low, medium, high, urgent)
      - `production_due_date` (date) - When production is due
      - `customer_due_date` (date) - When customer expects delivery
      - `assigned_to` (uuid) - User assigned to this work order
      - `total_quantity` (int) - Total items in this work order
      - `notes` (text) - Production notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `started_at` (timestamptz) - When work began
      - `completed_at` (timestamptz) - When work finished

  2. Security
    - Enable RLS on `work_orders` table
    - Add policies for company-isolated access
    - Production users can view and update their company's work orders

  3. Purpose
    - Track production work orders created from approved quotes
    - Manage production workflow and assignments
    - Monitor production status and completion
*/

CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled', 'on_hold')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  production_due_date date,
  customer_due_date date,
  assigned_to uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  total_quantity int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_orders_company_id ON work_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_quote_id ON work_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(company_id, priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_to ON work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_work_orders_due_date ON work_orders(company_id, production_due_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_work_order_number ON work_orders(work_order_number);

-- Enable RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Policy for viewing work orders
CREATE POLICY "Users can view their company work orders"
  ON work_orders
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

-- Policy for creating work orders
CREATE POLICY "Users can create work orders for their company"
  ON work_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- Policy for updating work orders
CREATE POLICY "Users can update their company work orders"
  ON work_orders
  FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Policy for deleting work orders
CREATE POLICY "Users can delete their company work orders"
  ON work_orders
  FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_work_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_work_order_timestamp
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_updated_at();
