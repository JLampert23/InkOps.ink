/*
  # Create Work Order Line Items and Workflow Board

  1. New Tables
    - `work_order_line_items`
      - `id` (uuid, primary key)
      - `work_order_id` (uuid) - Reference to work order
      - `company_id` (uuid) - Company isolation
      - `quote_line_item_id` (uuid) - Reference to original quote line item
      - `line_number` (int) - Display order
      - `item_type` (text) - Type: garment, decoration, custom
      - `description` (text) - Item description
      - `style_number` (text) - Product SKU
      - `style_name` (text) - Product name
      - `color` (text) - Garment color
      - `sizes` (jsonb) - Size breakdown for production
      - `quantity` (int) - Total quantity
      - `supplier_type` (text) - Supplier category
      - `supplier_name` (text) - Supplier name
      - `garment_images` (jsonb) - Product images
      - `notes` (text) - Production notes
      - `is_completed` (boolean) - Completion status
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `production_workflow_columns`
      - `id` (uuid, primary key)
      - `company_id` (uuid) - Company isolation
      - `column_name` (text) - Column display name
      - `column_order` (int) - Display order
      - `color` (text) - Visual color indicator
      - `is_default` (boolean) - Default column for new work orders
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for company-isolated access

  3. Purpose
    - Store production-specific line item data without pricing
    - Manage workflow board columns for production tracking
    - Enable drag-and-drop workflow management
*/

-- Create work_order_line_items table
CREATE TABLE IF NOT EXISTS work_order_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  quote_line_item_id uuid REFERENCES quote_line_items(id) ON DELETE SET NULL,
  line_number int NOT NULL DEFAULT 0,
  item_type text NOT NULL CHECK (item_type IN ('garment', 'decoration', 'custom', 'other')),
  description text NOT NULL,
  style_number text,
  style_name text,
  color text,
  sizes jsonb DEFAULT '{}'::jsonb,
  quantity int NOT NULL DEFAULT 0,
  supplier_type text,
  supplier_name text,
  garment_images jsonb DEFAULT '{}'::jsonb,
  notes text,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_line_items_work_order_id ON work_order_line_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_line_items_company_id ON work_order_line_items(company_id);
CREATE INDEX IF NOT EXISTS idx_work_order_line_items_quote_line_item_id ON work_order_line_items(quote_line_item_id);
CREATE INDEX IF NOT EXISTS idx_work_order_line_items_is_completed ON work_order_line_items(work_order_id, is_completed);

-- Enable RLS
ALTER TABLE work_order_line_items ENABLE ROW LEVEL SECURITY;

-- Policies for work_order_line_items
CREATE POLICY "Users can view their company work order line items"
  ON work_order_line_items
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create work order line items for their company"
  ON work_order_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update their company work order line items"
  ON work_order_line_items
  FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete their company work order line items"
  ON work_order_line_items
  FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Create production_workflow_columns table
CREATE TABLE IF NOT EXISTS production_workflow_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  column_name text NOT NULL,
  column_order int NOT NULL DEFAULT 0,
  color text DEFAULT '#3b82f6',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workflow_columns_company_id ON production_workflow_columns(company_id);
CREATE INDEX IF NOT EXISTS idx_workflow_columns_order ON production_workflow_columns(company_id, column_order);

-- Enable RLS
ALTER TABLE production_workflow_columns ENABLE ROW LEVEL SECURITY;

-- Policies for production_workflow_columns
CREATE POLICY "Users can view their company workflow columns"
  ON production_workflow_columns
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create workflow columns for their company"
  ON production_workflow_columns
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update their company workflow columns"
  ON production_workflow_columns
  FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete their company workflow columns"
  ON production_workflow_columns
  FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Seed default workflow columns for existing companies
INSERT INTO production_workflow_columns (company_id, column_name, column_order, color, is_default)
SELECT 
  id,
  'Pending Scheduling',
  0,
  '#94a3b8',
  true
FROM company_settings
WHERE NOT EXISTS (
  SELECT 1 FROM production_workflow_columns 
  WHERE company_id = company_settings.id
);

INSERT INTO production_workflow_columns (company_id, column_name, column_order, color, is_default)
SELECT 
  id,
  'In Production',
  1,
  '#3b82f6',
  false
FROM company_settings
WHERE NOT EXISTS (
  SELECT 1 FROM production_workflow_columns 
  WHERE company_id = company_settings.id 
  AND column_name = 'In Production'
);

INSERT INTO production_workflow_columns (company_id, column_name, column_order, color, is_default)
SELECT 
  id,
  'Quality Check',
  2,
  '#f59e0b',
  false
FROM company_settings
WHERE NOT EXISTS (
  SELECT 1 FROM production_workflow_columns 
  WHERE company_id = company_settings.id 
  AND column_name = 'Quality Check'
);

INSERT INTO production_workflow_columns (company_id, column_name, column_order, color, is_default)
SELECT 
  id,
  'Ready to Ship',
  3,
  '#10b981',
  false
FROM company_settings
WHERE NOT EXISTS (
  SELECT 1 FROM production_workflow_columns 
  WHERE company_id = company_settings.id 
  AND column_name = 'Ready to Ship'
);

INSERT INTO production_workflow_columns (company_id, column_name, column_order, color, is_default)
SELECT 
  id,
  'Completed',
  4,
  '#6b7280',
  false
FROM company_settings
WHERE NOT EXISTS (
  SELECT 1 FROM production_workflow_columns 
  WHERE company_id = company_settings.id 
  AND column_name = 'Completed'
);

-- Update timestamp trigger for work_order_line_items
CREATE OR REPLACE FUNCTION update_work_order_line_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_work_order_line_item_timestamp
  BEFORE UPDATE ON work_order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_work_order_line_item_updated_at();

-- Function to auto-complete work order when all line items are completed
CREATE OR REPLACE FUNCTION check_work_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_all_completed boolean;
  v_work_order_id uuid;
BEGIN
  -- Get work order id from either NEW or OLD record
  v_work_order_id := COALESCE(NEW.work_order_id, OLD.work_order_id);
  
  -- Check if all line items for this work order are completed
  SELECT 
    COUNT(*) = COUNT(*) FILTER (WHERE is_completed = true)
  INTO v_all_completed
  FROM work_order_line_items
  WHERE work_order_id = v_work_order_id;
  
  -- Update work order status if all items are completed
  IF v_all_completed THEN
    UPDATE work_orders
    SET 
      status = 'completed',
      completed_at = now()
    WHERE id = v_work_order_id
      AND status != 'completed';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_work_order_completion
  AFTER INSERT OR UPDATE OR DELETE ON work_order_line_items
  FOR EACH ROW
  EXECUTE FUNCTION check_work_order_completion();

-- Add comments for documentation
COMMENT ON TABLE work_order_line_items IS 'Production-focused line items without pricing, linked to work orders';
COMMENT ON TABLE production_workflow_columns IS 'Configurable workflow board columns for production tracking';
