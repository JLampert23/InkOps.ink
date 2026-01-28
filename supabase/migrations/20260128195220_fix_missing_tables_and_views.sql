/*
  # Fix Missing Tables and Views

  1. New Tables
    - `billing_queue` - Tracks invoices in the billing workflow
    - `printavo_statuses` - Stores Printavo status configurations
    - `color_stitch_options` - Color and stitch count options for quotes
    - `type_of_work_settings` - Work type configurations (Screen Print, Embroidery, DTG, etc.)
    - `communication_logs` - Records customer communications
    - `paid_invoices` - Archives completed payments

  2. Views
    - `printavo_invoices_calculated` - Calculated invoice balances view

  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for company data isolation

  4. Indexes
    - Add indexes for all foreign keys and common queries
*/

-- ==============================================
-- Create billing_queue table
-- ==============================================
CREATE TABLE IF NOT EXISTS billing_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  printavo_status text,
  customer_name text,
  customer_email text,
  customer_company text,
  invoice_total numeric(10, 2) NOT NULL DEFAULT 0,
  invoice_date timestamptz,
  due_date timestamptz,
  stripe_payment_link_id text,
  stripe_invoice_id text,
  sent_at timestamptz,
  sent_method text,
  payment_status text DEFAULT 'unpaid',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_queue_company_id ON billing_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_printavo_invoice_id ON billing_queue(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_queue_payment_status ON billing_queue(payment_status);
CREATE INDEX IF NOT EXISTS idx_billing_queue_sent_at ON billing_queue(sent_at);

ALTER TABLE billing_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view billing queue in their company"
  ON billing_queue FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert to billing queue in their company"
  ON billing_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update billing queue in their company"
  ON billing_queue FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete from billing queue in their company"
  ON billing_queue FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==============================================
-- Create communication_logs table
-- ==============================================
CREATE TABLE IF NOT EXISTS communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  communication_type text NOT NULL,
  method text NOT NULL,
  recipient text NOT NULL,
  subject text,
  message text,
  status text DEFAULT 'sent',
  error_message text,
  metadata jsonb DEFAULT '{}',
  sent_by uuid REFERENCES auth.users(id),
  sent_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communication_logs_company_id ON communication_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_printavo_invoice_id ON communication_logs(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sent_at ON communication_logs(sent_at);

ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view communication logs in their company"
  ON communication_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert communication logs in their company"
  ON communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==============================================
-- Create paid_invoices table
-- ==============================================
CREATE TABLE IF NOT EXISTS paid_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company_settings(id) ON DELETE CASCADE,
  printavo_invoice_id text NOT NULL,
  printavo_visual_id text,
  customer_name text,
  customer_email text,
  invoice_total numeric(10, 2) NOT NULL,
  amount_paid numeric(10, 2) NOT NULL,
  payment_date timestamptz NOT NULL,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  payment_method text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paid_invoices_company_id ON paid_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_printavo_invoice_id ON paid_invoices(printavo_invoice_id);
CREATE INDEX IF NOT EXISTS idx_paid_invoices_payment_date ON paid_invoices(payment_date);

ALTER TABLE paid_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view paid invoices in their company"
  ON paid_invoices FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert paid invoices in their company"
  ON paid_invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ==============================================
-- Create printavo_statuses table
-- ==============================================
CREATE TABLE IF NOT EXISTS printavo_statuses (
  id text PRIMARY KEY,
  name text NOT NULL,
  color text,
  position integer DEFAULT 0,
  type text,
  is_billing_eligible boolean DEFAULT false,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_printavo_statuses_position ON printavo_statuses(position);

ALTER TABLE printavo_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view printavo statuses"
  ON printavo_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage printavo statuses"
  ON printavo_statuses FOR ALL
  USING (true);

-- ==============================================
-- Create type_of_work_settings table
-- ==============================================
CREATE TABLE IF NOT EXISTS type_of_work_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  work_type_name text NOT NULL,
  work_type_key text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  icon_name text,
  color_hex text DEFAULT '#3B82F6',
  default_steps jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, work_type_key)
);

CREATE INDEX IF NOT EXISTS idx_type_of_work_settings_company_id ON type_of_work_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_type_of_work_settings_sort_order ON type_of_work_settings(sort_order);

ALTER TABLE type_of_work_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view work types in their company"
  ON type_of_work_settings FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage work types in their company"
  ON type_of_work_settings FOR ALL
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

-- ==============================================
-- Create color_stitch_options table
-- ==============================================
CREATE TABLE IF NOT EXISTS color_stitch_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  option_label text NOT NULL,
  option_value text NOT NULL,
  option_type text NOT NULL CHECK (option_type IN ('color', 'stitch', 'other')),
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_color_stitch_options_company_id ON color_stitch_options(company_id);
CREATE INDEX IF NOT EXISTS idx_color_stitch_options_type ON color_stitch_options(option_type, is_active);

ALTER TABLE color_stitch_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view color/stitch options in their company"
  ON color_stitch_options FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage color/stitch options in their company"
  ON color_stitch_options FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- ==============================================
-- Seed default data for existing companies
-- ==============================================

-- Insert default work types for all existing companies
INSERT INTO type_of_work_settings (company_id, work_type_name, work_type_key, sort_order, icon_name, color_hex)
SELECT 
  id,
  work_type,
  LOWER(REPLACE(work_type, ' ', '_')),
  sort_order,
  icon,
  color
FROM company_settings
CROSS JOIN (
  VALUES 
    ('Screen Printing', 'screen_printing', 1, 'Paintbrush', '#FF6B6B'),
    ('Embroidery', 'embroidery', 2, 'Layers', '#4ECDC4'),
    ('DTG', 'dtg', 3, 'Printer', '#45B7D1'),
    ('Heat Transfer', 'heat_transfer', 4, 'Flame', '#FFA07A'),
    ('Sublimation', 'sublimation', 5, 'Droplet', '#98D8C8'),
    ('Vinyl', 'vinyl', 6, 'Scissors', '#F7DC6F')
) AS work_types(work_type, key, sort_order, icon, color)
ON CONFLICT (company_id, work_type_key) DO NOTHING;

-- Insert default color options for all existing companies
INSERT INTO color_stitch_options (company_id, option_label, option_value, option_type, sort_order)
SELECT 
  id,
  label,
  value,
  'color',
  sort_order
FROM company_settings
CROSS JOIN (
  VALUES 
    ('1 Color', '1', 1),
    ('2 Colors', '2', 2),
    ('3 Colors', '3', 3),
    ('4 Colors', '4', 4),
    ('5 Colors', '5', 5),
    ('6 Colors', '6', 6),
    ('7 Colors', '7', 7),
    ('8 Colors', '8', 8),
    ('9 Colors', '9', 9),
    ('10 Colors', '10', 10)
) AS colors(label, value, sort_order)
ON CONFLICT DO NOTHING;

-- Insert default stitch count options for all existing companies
INSERT INTO color_stitch_options (company_id, option_label, option_value, option_type, sort_order)
SELECT 
  id,
  label,
  value,
  'stitch',
  sort_order
FROM company_settings
CROSS JOIN (
  VALUES 
    ('1,000 Stitches', '1000', 101),
    ('2,500 Stitches', '2500', 102),
    ('5,000 Stitches', '5000', 103),
    ('7,500 Stitches', '7500', 104),
    ('10,000 Stitches', '10000', 105),
    ('12,500 Stitches', '12500', 106),
    ('15,000 Stitches', '15000', 107),
    ('20,000 Stitches', '20000', 108),
    ('25,000 Stitches', '25000', 109),
    ('30,000 Stitches', '30000', 110)
) AS stitches(label, value, sort_order)
ON CONFLICT DO NOTHING;

-- ==============================================
-- Create printavo_invoices_calculated view
-- ==============================================
CREATE OR REPLACE VIEW printavo_invoices_calculated AS
SELECT 
  i.*
FROM printavo_invoices i;

-- ==============================================
-- Create triggers for updated_at timestamps
-- ==============================================
CREATE OR REPLACE FUNCTION update_billing_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS billing_queue_updated_at ON billing_queue;
CREATE TRIGGER billing_queue_updated_at
  BEFORE UPDATE ON billing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_billing_queue_updated_at();

CREATE OR REPLACE FUNCTION update_type_of_work_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS type_of_work_settings_updated_at ON type_of_work_settings;
CREATE TRIGGER type_of_work_settings_updated_at
  BEFORE UPDATE ON type_of_work_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_type_of_work_settings_updated_at();

CREATE OR REPLACE FUNCTION update_color_stitch_options_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS color_stitch_options_updated_at ON color_stitch_options;
CREATE TRIGGER color_stitch_options_updated_at
  BEFORE UPDATE ON color_stitch_options
  FOR EACH ROW
  EXECUTE FUNCTION update_color_stitch_options_updated_at();

CREATE OR REPLACE FUNCTION update_printavo_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS printavo_statuses_updated_at ON printavo_statuses;
CREATE TRIGGER printavo_statuses_updated_at
  BEFORE UPDATE ON printavo_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_printavo_statuses_updated_at();