/*
  # Create Purchase Orders Management System

  1. New Tables
    - `vendors`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `vendor_name` (text)
      - `vendor_type` (text) - SSActivewear, SanMar, Independent
      - `contact_name` (text)
      - `contact_email` (text)
      - `contact_phone` (text)
      - `address_1` (text)
      - `address_2` (text)
      - `city` (text)
      - `state` (text)
      - `zip` (text)
      - `country` (text)
      - `payment_terms` (text)
      - `notes` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `purchase_orders`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `po_number` (text, unique per company)
      - `vendor_id` (uuid, foreign key)
      - `status` (text) - draft, sent, confirmed, in_transit, partially_received, fully_received, closed
      - `subtotal` (numeric)
      - `tax_amount` (numeric)
      - `shipping_cost` (numeric)
      - `total_cost` (numeric)
      - `notes_to_vendor` (text)
      - `internal_notes` (text)
      - `expected_delivery_date` (date)
      - `sent_at` (timestamptz)
      - `confirmed_at` (timestamptz)
      - `received_at` (timestamptz)
      - `closed_at` (timestamptz)
      - `created_by` (uuid, foreign key to user_profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `purchase_order_line_items`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `po_id` (uuid, foreign key)
      - `line_number` (integer)
      - `sku` (text)
      - `style_number` (text)
      - `product_name` (text)
      - `color` (text)
      - `size` (text)
      - `quantity_ordered` (integer)
      - `quantity_received` (integer)
      - `unit_cost` (numeric)
      - `extended_cost` (numeric)
      - `vendor_product_id` (text)
      - `notes` (text)
      - `created_at` (timestamptz)

    - `purchase_order_attachments`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `po_id` (uuid, foreign key)
      - `file_name` (text)
      - `file_url` (text)
      - `file_type` (text)
      - `file_size` (integer)
      - `uploaded_by` (uuid, foreign key)
      - `created_at` (timestamptz)

    - `purchase_order_activity_log`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `po_id` (uuid, foreign key)
      - `action` (text)
      - `performed_by` (uuid, foreign key)
      - `performed_by_name` (text)
      - `notes` (text)
      - `meta` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users within same company
    - Add indexes for performance

  3. Functions
    - `generate_po_number()` - Auto-generate PO numbers
    - `update_po_totals()` - Recalculate PO totals when line items change
    - `check_po_received_status()` - Auto-update status when all items received
*/

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vendor_name text NOT NULL,
  vendor_type text DEFAULT 'independent' CHECK (vendor_type IN ('ssactivewear', 'sanmar', 'independent')),
  contact_name text,
  contact_email text,
  contact_phone text,
  address_1 text,
  address_2 text,
  city text,
  state text,
  zip text,
  country text DEFAULT 'USA',
  payment_terms text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vendors in their company"
  ON vendors FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can create vendors in their company"
  ON vendors FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update vendors in their company"
  ON vendors FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete vendors in their company"
  ON vendors FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE INDEX IF NOT EXISTS idx_vendors_company_id ON vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors(is_active);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_number text NOT NULL,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'in_transit', 'partially_received', 'fully_received', 'closed')),
  subtotal numeric(10, 2) DEFAULT 0,
  tax_amount numeric(10, 2) DEFAULT 0,
  shipping_cost numeric(10, 2) DEFAULT 0,
  total_cost numeric(10, 2) DEFAULT 0,
  notes_to_vendor text,
  internal_notes text,
  expected_delivery_date date,
  sent_at timestamptz,
  confirmed_at timestamptz,
  received_at timestamptz,
  closed_at timestamptz,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_po_number_per_company UNIQUE (company_id, po_number)
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase orders in their company"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can create purchase orders in their company"
  ON purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update purchase orders in their company"
  ON purchase_orders FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete purchase orders in their company"
  ON purchase_orders FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE INDEX IF NOT EXISTS idx_po_company_id ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_po_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_created_at ON purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_expected_delivery ON purchase_orders(expected_delivery_date);

-- Create purchase_order_line_items table
CREATE TABLE IF NOT EXISTS purchase_order_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  sku text,
  style_number text,
  product_name text NOT NULL,
  color text,
  size text,
  quantity_ordered integer NOT NULL DEFAULT 0,
  quantity_received integer NOT NULL DEFAULT 0,
  unit_cost numeric(10, 2) NOT NULL DEFAULT 0,
  extended_cost numeric(10, 2) NOT NULL DEFAULT 0,
  vendor_product_id text,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_quantities CHECK (quantity_received <= quantity_ordered)
);

ALTER TABLE purchase_order_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PO line items in their company"
  ON purchase_order_line_items FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can create PO line items in their company"
  ON purchase_order_line_items FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can update PO line items in their company"
  ON purchase_order_line_items FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()))
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete PO line items in their company"
  ON purchase_order_line_items FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE INDEX IF NOT EXISTS idx_po_line_items_po_id ON purchase_order_line_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_line_items_company_id ON purchase_order_line_items(company_id);

-- Create purchase_order_attachments table
CREATE TABLE IF NOT EXISTS purchase_order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PO attachments in their company"
  ON purchase_order_attachments FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can create PO attachments in their company"
  ON purchase_order_attachments FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can delete PO attachments in their company"
  ON purchase_order_attachments FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE INDEX IF NOT EXISTS idx_po_attachments_po_id ON purchase_order_attachments(po_id);
CREATE INDEX IF NOT EXISTS idx_po_attachments_company_id ON purchase_order_attachments(company_id);

-- Create purchase_order_activity_log table
CREATE TABLE IF NOT EXISTS purchase_order_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  performed_by_name text,
  notes text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_order_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PO activity logs in their company"
  ON purchase_order_activity_log FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT get_user_company_id()));

CREATE POLICY "Users can create PO activity logs in their company"
  ON purchase_order_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_id()));

CREATE INDEX IF NOT EXISTS idx_po_activity_log_po_id ON purchase_order_activity_log(po_id);
CREATE INDEX IF NOT EXISTS idx_po_activity_log_company_id ON purchase_order_activity_log(company_id);
CREATE INDEX IF NOT EXISTS idx_po_activity_log_created_at ON purchase_order_activity_log(created_at DESC);

-- Function to generate PO numbers
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  company_id_val uuid;
  next_number integer;
  po_number text;
BEGIN
  -- Get the user's company_id
  SELECT get_user_company_id() INTO company_id_val;

  IF company_id_val IS NULL THEN
    RAISE EXCEPTION 'User company not found';
  END IF;

  -- Get the next PO number for this company
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM '[0-9]+$') AS integer)), 0) + 1
  INTO next_number
  FROM purchase_orders
  WHERE company_id = company_id_val
    AND po_number ~ '^PO-[0-9]+$';

  -- Format as PO-00001
  po_number := 'PO-' || LPAD(next_number::text, 5, '0');

  RETURN po_number;
END;
$$;

-- Function to update PO totals
CREATE OR REPLACE FUNCTION update_po_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_subtotal numeric;
BEGIN
  -- Calculate new subtotal from line items
  SELECT COALESCE(SUM(extended_cost), 0)
  INTO new_subtotal
  FROM purchase_order_line_items
  WHERE po_id = COALESCE(NEW.po_id, OLD.po_id);

  -- Update the purchase order
  UPDATE purchase_orders
  SET
    subtotal = new_subtotal,
    total_cost = new_subtotal + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0),
    updated_at = now()
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger to update PO totals when line items change
DROP TRIGGER IF EXISTS trigger_update_po_totals ON purchase_order_line_items;
CREATE TRIGGER trigger_update_po_totals
AFTER INSERT OR UPDATE OR DELETE ON purchase_order_line_items
FOR EACH ROW
EXECUTE FUNCTION update_po_totals();

-- Function to check and update PO received status
CREATE OR REPLACE FUNCTION check_po_received_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_ordered integer;
  total_received integer;
  current_status text;
BEGIN
  -- Get totals for this PO
  SELECT
    COALESCE(SUM(quantity_ordered), 0),
    COALESCE(SUM(quantity_received), 0)
  INTO total_ordered, total_received
  FROM purchase_order_line_items
  WHERE po_id = NEW.po_id;

  -- Get current status
  SELECT status INTO current_status
  FROM purchase_orders
  WHERE id = NEW.po_id;

  -- Update status based on received quantities
  IF total_received = 0 THEN
    -- No items received yet, don't change status
    RETURN NEW;
  ELSIF total_received >= total_ordered THEN
    -- All items received
    UPDATE purchase_orders
    SET
      status = 'fully_received',
      received_at = CASE WHEN received_at IS NULL THEN now() ELSE received_at END,
      updated_at = now()
    WHERE id = NEW.po_id AND status != 'fully_received';
  ELSIF total_received > 0 AND current_status NOT IN ('partially_received', 'fully_received') THEN
    -- Some items received
    UPDATE purchase_orders
    SET
      status = 'partially_received',
      received_at = CASE WHEN received_at IS NULL THEN now() ELSE received_at END,
      updated_at = now()
    WHERE id = NEW.po_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to check received status when quantities change
DROP TRIGGER IF EXISTS trigger_check_po_received_status ON purchase_order_line_items;
CREATE TRIGGER trigger_check_po_received_status
AFTER UPDATE OF quantity_received ON purchase_order_line_items
FOR EACH ROW
EXECUTE FUNCTION check_po_received_status();

-- Create storage bucket for PO attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('po-attachments', 'po-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for PO attachments
CREATE POLICY "Users can view PO attachments in their company"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'po-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can upload PO attachments for their company"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'po-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete PO attachments for their company"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'po-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM user_profiles WHERE id = auth.uid()
  )
);
