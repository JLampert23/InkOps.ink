/*
  # Create Shipping Labels Table

  1. New Tables
    - `shipping_labels`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `invoice_id` (text, references printavo_invoices)
      - `shipstation_shipment_id` (text) - ShipStation shipment ID
      - `label_url` (text) - URL to download label PDF
      - `tracking_number` (text) - Carrier tracking number
      - `carrier` (text) - Carrier code (usps, fedex, ups, etc)
      - `service` (text) - Service code (usps_priority, fedex_2day, etc)
      - `cost` (decimal) - Shipping cost charged by carrier
      - `weight_oz` (decimal) - Package weight in ounces
      - `package_length` (decimal) - Package length in inches
      - `package_width` (decimal) - Package width in inches
      - `package_height` (decimal) - Package height in inches
      - `ship_date` (date) - Scheduled ship date
      - `voided_at` (timestamptz) - When label was voided
      - `created_at` (timestamptz)
      - `created_by` (uuid) - User who created label

  2. Security
    - Enable RLS on `shipping_labels` table
    - Add policies for company-based access

  3. Indexes
    - Index on company_id for fast lookups
    - Index on invoice_id for fast lookups
    - Index on tracking_number for fast lookups
*/

-- Create shipping_labels table
CREATE TABLE IF NOT EXISTS shipping_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id text NOT NULL REFERENCES printavo_invoices(id) ON DELETE CASCADE,
  shipstation_shipment_id text,
  label_url text NOT NULL,
  tracking_number text NOT NULL,
  carrier text NOT NULL,
  service text NOT NULL,
  cost decimal(10, 2),
  weight_oz decimal(10, 2),
  package_length decimal(10, 2),
  package_width decimal(10, 2),
  package_height decimal(10, 2),
  ship_date date,
  voided_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

-- Enable RLS
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shipping_labels_company_id 
  ON shipping_labels(company_id);

CREATE INDEX IF NOT EXISTS idx_shipping_labels_invoice_id 
  ON shipping_labels(invoice_id);

CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking_number 
  ON shipping_labels(tracking_number) 
  WHERE tracking_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipping_labels_voided 
  ON shipping_labels(voided_at) 
  WHERE voided_at IS NOT NULL;

-- RLS Policies
CREATE POLICY "Users can view shipping labels in their company"
  ON shipping_labels FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create shipping labels in their company"
  ON shipping_labels FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update shipping labels in their company"
  ON shipping_labels FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE shipping_labels IS 'Stores shipping labels created for invoices via ShipStation';
COMMENT ON COLUMN shipping_labels.shipstation_shipment_id IS 'ShipStation shipment ID for API reference';
COMMENT ON COLUMN shipping_labels.label_url IS 'URL to download the shipping label PDF';
COMMENT ON COLUMN shipping_labels.tracking_number IS 'Carrier tracking number for package';
COMMENT ON COLUMN shipping_labels.carrier IS 'Carrier code: usps, fedex, ups, dhl_express, etc';
COMMENT ON COLUMN shipping_labels.service IS 'Service code: usps_priority, fedex_2day, ups_ground, etc';
COMMENT ON COLUMN shipping_labels.cost IS 'Actual shipping cost charged by carrier';
COMMENT ON COLUMN shipping_labels.voided_at IS 'Timestamp when label was voided (NULL if active)';
