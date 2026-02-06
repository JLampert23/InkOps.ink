/*
  # Create Invoice Line Items Table

  1. New Table
    - `invoice_line_items`
      - `id` (uuid, primary key)
      - `invoice_id` (text) - Reference to invoice
      - `company_id` (uuid) - Company isolation
      - `quote_line_item_id` (uuid) - Reference to original quote line item
      - `line_number` (int) - Display order
      - `item_type` (text) - Type: garment, decoration, custom, fee, discount
      - `description` (text) - Item description
      - `style_number` (text) - Product SKU
      - `style_name` (text) - Product name
      - `color` (text) - Garment color
      - `sizes` (jsonb) - Size breakdown
      - `quantity` (int) - Total quantity
      - `unit_price` (numeric) - Price per unit
      - `subtotal` (numeric) - Line item subtotal before tax
      - `tax_rate` (numeric) - Tax rate percentage
      - `tax_amount` (numeric) - Tax amount for this line
      - `total` (numeric) - Line item total with tax
      - `discount_percentage` (numeric) - Discount percentage if applicable
      - `discount_amount` (numeric) - Discount amount
      - `notes` (text) - Line item notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on invoice_line_items
    - Add policies for company-isolated access

  3. Purpose
    - Store detailed invoice line items with full pricing
    - Enable itemized billing
    - Maintain audit trail of pricing
    - Support PDF generation with line-item details
*/

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id text NOT NULL REFERENCES printavo_invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  quote_line_item_id uuid REFERENCES quote_line_items(id) ON DELETE SET NULL,
  line_number int NOT NULL DEFAULT 0,
  item_type text NOT NULL CHECK (item_type IN ('garment', 'decoration', 'custom', 'fee', 'discount', 'other')),
  description text NOT NULL,
  style_number text,
  style_name text,
  color text,
  sizes jsonb DEFAULT '{}'::jsonb,
  quantity int NOT NULL DEFAULT 0,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(10,2) DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  discount_percentage numeric(5,2) DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_company_id ON invoice_line_items(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_quote_line_item_id ON invoice_line_items(quote_line_item_id);

-- Enable RLS
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Policies for invoice_line_items
CREATE POLICY "Users can view their company invoice line items"
  ON invoice_line_items
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create invoice line items for their company"
  ON invoice_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update their company invoice line items"
  ON invoice_line_items
  FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can delete their company invoice line items"
  ON invoice_line_items
  FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_invoice_line_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_line_item_timestamp
  BEFORE UPDATE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_line_item_updated_at();

-- Function to recalculate invoice totals from line items
CREATE OR REPLACE FUNCTION recalculate_invoice_totals_from_line_items()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id text;
  v_subtotal numeric;
  v_tax numeric;
  v_total numeric;
  v_discount numeric;
BEGIN
  -- Get invoice id from either NEW or OLD record
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Calculate totals from all line items for this invoice
  SELECT 
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(tax_amount), 0),
    COALESCE(SUM(total), 0),
    COALESCE(SUM(discount_amount), 0)
  INTO v_subtotal, v_tax, v_total, v_discount
  FROM invoice_line_items
  WHERE invoice_id = v_invoice_id;
  
  -- Update invoice header with calculated totals
  UPDATE printavo_invoices
  SET 
    subtotal = v_subtotal,
    tax = v_tax,
    total = v_total,
    amount_outstanding = v_total - COALESCE(amount_paid, 0)
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalculate_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals_from_line_items();

COMMENT ON TABLE invoice_line_items IS 'Detailed line items for invoices with full pricing and tax information';
