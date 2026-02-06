/*
  # Create Garment Requirements Staging Table

  1. New Tables
    - `garment_requirements_staging`
      - `id` (uuid, primary key) - Unique identifier
      - `company_id` (uuid) - Company isolation
      - `quote_id` (uuid) - Reference to originating quote
      - `work_order_id` (uuid) - Reference to work order
      - `supplier_type` (text) - Supplier type (sanmar, ssactivewear, independent)
      - `supplier_name` (text) - Name of supplier
      - `style_number` (text) - Product style/SKU
      - `style_name` (text) - Product name
      - `color` (text) - Garment color
      - `sizes` (jsonb) - Size breakdown (e.g., {"S": 10, "M": 20, "L": 15})
      - `total_quantity` (int) - Total quantity needed
      - `unit_cost` (numeric) - Cost per unit
      - `total_cost` (numeric) - Total cost for this requirement
      - `is_po_created` (boolean) - Whether PO has been created
      - `po_id` (uuid) - Reference to created PO
      - `notes` (text) - Special instructions or notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `garment_requirements_staging` table
    - Add policies for company-isolated access

  3. Purpose
    - Aggregate garment requirements from approved quotes
    - Stage data for PO creation
    - Track which requirements have been converted to POs
    - Enable bulk PO creation and supplier ordering
*/

CREATE TABLE IF NOT EXISTS garment_requirements_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES work_orders(id) ON DELETE SET NULL,
  supplier_type text CHECK (supplier_type IN ('sanmar', 'ssactivewear', 'independent', 'other')),
  supplier_name text,
  style_number text,
  style_name text,
  color text,
  sizes jsonb DEFAULT '{}'::jsonb,
  total_quantity int DEFAULT 0,
  unit_cost numeric(10, 2) DEFAULT 0,
  total_cost numeric(10, 2) DEFAULT 0,
  is_po_created boolean DEFAULT false,
  po_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_garment_requirements_company_id ON garment_requirements_staging(company_id);
CREATE INDEX IF NOT EXISTS idx_garment_requirements_quote_id ON garment_requirements_staging(quote_id);
CREATE INDEX IF NOT EXISTS idx_garment_requirements_work_order_id ON garment_requirements_staging(work_order_id);
CREATE INDEX IF NOT EXISTS idx_garment_requirements_supplier ON garment_requirements_staging(company_id, supplier_type);
CREATE INDEX IF NOT EXISTS idx_garment_requirements_po_status ON garment_requirements_staging(company_id, is_po_created);
CREATE INDEX IF NOT EXISTS idx_garment_requirements_style ON garment_requirements_staging(company_id, style_number);

-- Enable RLS
ALTER TABLE garment_requirements_staging ENABLE ROW LEVEL SECURITY;

-- Policy for viewing garment requirements
CREATE POLICY "Users can view their company garment requirements"
  ON garment_requirements_staging
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

-- Policy for creating garment requirements
CREATE POLICY "Users can create garment requirements for their company"
  ON garment_requirements_staging
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- Policy for updating garment requirements
CREATE POLICY "Users can update their company garment requirements"
  ON garment_requirements_staging
  FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Policy for deleting garment requirements
CREATE POLICY "Users can delete their company garment requirements"
  ON garment_requirements_staging
  FOR DELETE
  TO authenticated
  USING (company_id = get_user_company_id());

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_garment_requirements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_garment_requirements_timestamp
  BEFORE UPDATE ON garment_requirements_staging
  FOR EACH ROW
  EXECUTE FUNCTION update_garment_requirements_updated_at();
