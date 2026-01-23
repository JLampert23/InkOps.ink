/*
  # Add Printavo-Style Fields to Quotes

  1. Purpose
    - Add fields to match Printavo invoice template layout
    - Support for PO numbers, delivery method, and date tracking
    - Add 4XL size support to line items

  2. Changes to `quotes` table
    - `po_number` - Purchase order number from customer
    - `delivery_method` - PICK-UP, DELIVERY, SHIPPING, etc.
    - `invoice_date` - Separate from created_date for when quote becomes invoice
    - `payment_due_date` - Calculated or manual payment deadline
    - `terms` - Payment terms (Net 30, etc.)
    - `company_name` - Company name for quote header
    - `company_address` - Company address
    - `company_city` - Company city
    - `company_state` - Company state
    - `company_zip` - Company zip code
    - `company_phone` - Company phone
    - `company_email` - Company email
    - `company_website` - Company website
    - `company_logo_url` - URL to company logo

  3. Changes to `quote_line_items` table
    - Add size breakdown columns for apparel items
    - Add `qty_4xl` to support 4XL size

  4. Security
    - No RLS changes needed (already secured by company_id)
*/

-- Add new fields to quotes table
DO $$
BEGIN
  -- PO and delivery info
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'po_number') THEN
    ALTER TABLE quotes ADD COLUMN po_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'delivery_method') THEN
    ALTER TABLE quotes ADD COLUMN delivery_method text DEFAULT 'PICK-UP';
  END IF;

  -- Date fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'invoice_date') THEN
    ALTER TABLE quotes ADD COLUMN invoice_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'payment_due_date') THEN
    ALTER TABLE quotes ADD COLUMN payment_due_date date;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'terms') THEN
    ALTER TABLE quotes ADD COLUMN terms text DEFAULT 'Net 30';
  END IF;

  -- Company info fields for quote header
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_name') THEN
    ALTER TABLE quotes ADD COLUMN company_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_address') THEN
    ALTER TABLE quotes ADD COLUMN company_address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_city') THEN
    ALTER TABLE quotes ADD COLUMN company_city text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_state') THEN
    ALTER TABLE quotes ADD COLUMN company_state text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_zip') THEN
    ALTER TABLE quotes ADD COLUMN company_zip text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_phone') THEN
    ALTER TABLE quotes ADD COLUMN company_phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_email') THEN
    ALTER TABLE quotes ADD COLUMN company_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_website') THEN
    ALTER TABLE quotes ADD COLUMN company_website text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'company_logo_url') THEN
    ALTER TABLE quotes ADD COLUMN company_logo_url text;
  END IF;
END $$;

-- Add size breakdown columns to quote_line_items
DO $$
BEGIN
  -- Youth sizes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_yxs') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_yxs int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_ys') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_ys int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_ym') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_ym int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_yl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_yl int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_yxl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_yxl int DEFAULT 0;
  END IF;

  -- Adult sizes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_xs') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_xs int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_s') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_s int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_m') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_m int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_l') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_l int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_xl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_xl int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_2xl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_2xl int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_3xl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_3xl int DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'qty_4xl') THEN
    ALTER TABLE quote_line_items ADD COLUMN qty_4xl int DEFAULT 0;
  END IF;

  -- Item details
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'item_number') THEN
    ALTER TABLE quote_line_items ADD COLUMN item_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'color') THEN
    ALTER TABLE quote_line_items ADD COLUMN color text;
  END IF;

  -- Line item type (item, fee, imprint)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'line_type') THEN
    ALTER TABLE quote_line_items ADD COLUMN line_type text DEFAULT 'item' CHECK (line_type IN ('item', 'fee', 'imprint'));
  END IF;

  -- For imprints
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'imprint_number') THEN
    ALTER TABLE quote_line_items ADD COLUMN imprint_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_line_items' AND column_name = 'num_colors') THEN
    ALTER TABLE quote_line_items ADD COLUMN num_colors int;
  END IF;
END $$;

-- Create index for line type
CREATE INDEX IF NOT EXISTS idx_quote_line_items_line_type ON quote_line_items(line_type);

-- Add comment
COMMENT ON TABLE quotes IS 'Quotes table with Printavo-style fields for comprehensive quote/invoice generation';
COMMENT ON TABLE quote_line_items IS 'Quote line items with size breakdown support and multiple line types (items, fees, imprints)';
