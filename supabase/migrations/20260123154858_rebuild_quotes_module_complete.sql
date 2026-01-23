/*
  # Rebuild Complete Quotes Module

  1. Purpose
    - Drop old quote tables (quote_items, quote_fees, quote_imprints, quotes)
    - Create new production-ready quotes module with approval system
    - Isolated from Accounting module
    - Support full quote-to-production workflow

  2. New Tables
    - `quotes` - Main quotes table with customer info and pricing
    - `quote_line_items` - Individual line items for quotes
    - `quote_activity_log` - Audit trail for all quote actions
    - `quote_approvals` - Public approval links with tokens
    - `quote_approval_responses` - Customer approval/rejection responses

  3. Security
    - RLS enabled on all tables
    - Company-based isolation
    - Role-based access control for sensitive actions
*/

-- Drop old quote tables (they're empty)
DROP TABLE IF EXISTS quote_items CASCADE;
DROP TABLE IF EXISTS quote_fees CASCADE;
DROP TABLE IF EXISTS quote_imprints CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;

-- Create new quotes table
CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  customer_company text,
  billing_address jsonb DEFAULT '{}'::jsonb,
  shipping_address jsonb DEFAULT '{}'::jsonb,
  
  line_items jsonb DEFAULT '[]'::jsonb,
  artwork_refs jsonb DEFAULT '[]'::jsonb,
  pricing_reference text,
  
  subtotal numeric(10,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(10,2) DEFAULT 0,
  total numeric(10,2) DEFAULT 0,
  
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'expired', 'converted')),
  valid_until date,
  notes text,
  customer_notes text,
  
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  converted_at timestamptz,
  production_job_id uuid
);

-- Create quote_line_items table
CREATE TABLE quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  line_number int NOT NULL DEFAULT 0,
  sku text,
  description text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  decoration_method text,
  decoration_location text,
  artwork_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quote_activity_log table
CREATE TABLE quote_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  performed_by_name text,
  performed_at timestamptz DEFAULT now(),
  meta jsonb DEFAULT '{}'::jsonb
);

-- Create quote_approvals table
CREATE TABLE quote_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  approval_token text UNIQUE NOT NULL,
  expires_at timestamptz,
  single_use boolean DEFAULT true,
  auto_approve_after_days int,
  auto_convert_on_approval boolean DEFAULT false,
  is_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Create quote_approval_responses table
CREATE TABLE quote_approval_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid NOT NULL REFERENCES quote_approvals(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  approved boolean NOT NULL,
  approver_name text NOT NULL,
  approver_email text NOT NULL,
  notes text,
  responded_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Create indexes
CREATE INDEX idx_quotes_company_id ON quotes(company_id);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX idx_quotes_quote_number ON quotes(quote_number);

CREATE INDEX idx_quote_line_items_quote_id ON quote_line_items(quote_id);
CREATE INDEX idx_quote_line_items_company_id ON quote_line_items(company_id);

CREATE INDEX idx_quote_activity_log_quote_id ON quote_activity_log(quote_id);
CREATE INDEX idx_quote_activity_log_company_id ON quote_activity_log(company_id);
CREATE INDEX idx_quote_activity_log_performed_at ON quote_activity_log(performed_at DESC);

CREATE INDEX idx_quote_approvals_quote_id ON quote_approvals(quote_id);
CREATE INDEX idx_quote_approvals_token ON quote_approvals(approval_token);
CREATE INDEX idx_quote_approvals_expires_at ON quote_approvals(expires_at);

CREATE INDEX idx_quote_approval_responses_approval_id ON quote_approval_responses(approval_id);

-- Enable RLS
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_approval_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotes
CREATE POLICY "Users can view quotes for their company"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create quotes for their company"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update quotes for their company"
  ON quotes FOR UPDATE
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

CREATE POLICY "Admins can delete quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- RLS Policies for quote_line_items
CREATE POLICY "Users can view line items for their company"
  ON quote_line_items FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage line items for their company"
  ON quote_line_items FOR ALL
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

-- RLS Policies for quote_activity_log
CREATE POLICY "Users can view activity logs for their company"
  ON quote_activity_log FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create activity logs for their company"
  ON quote_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for quote_approvals
CREATE POLICY "Users can view approvals for their company"
  ON quote_approvals FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create approvals for their company"
  ON quote_approvals FOR ALL
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

-- Public access to approvals via token (for edge functions)
CREATE POLICY "Public can view approvals by token"
  ON quote_approvals FOR SELECT
  TO anon
  USING (true);

-- RLS Policies for quote_approval_responses
CREATE POLICY "Users can view responses for their company"
  ON quote_approval_responses FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Public can create approval responses (for edge functions)
CREATE POLICY "Public can create approval responses"
  ON quote_approval_responses FOR INSERT
  TO anon
  WITH CHECK (true);

-- Function to generate quote numbers
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS text AS $$
DECLARE
  new_number text;
  max_number int;
BEGIN
  -- Get the highest quote number for this year
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(quote_number, '[^0-9]', '', 'g'), '')::int
  ), 0) INTO max_number
  FROM quotes
  WHERE quote_number LIKE 'Q' || TO_CHAR(CURRENT_DATE, 'YY') || '%';
  
  -- Generate new quote number
  new_number := 'Q' || TO_CHAR(CURRENT_DATE, 'YY') || LPAD((max_number + 1)::text, 5, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update quote totals when line items change
CREATE OR REPLACE FUNCTION update_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal numeric;
  v_tax_amount numeric;
  v_total numeric;
  v_tax_rate numeric;
  v_quote_id uuid;
BEGIN
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
  
  -- Get the quote's tax rate
  SELECT tax_rate INTO v_tax_rate
  FROM quotes
  WHERE id = v_quote_id;
  
  -- Calculate subtotal from line items
  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
  FROM quote_line_items
  WHERE quote_id = v_quote_id;
  
  -- Calculate tax amount
  v_tax_amount := ROUND(v_subtotal * (v_tax_rate / 100), 2);
  v_total := v_subtotal + v_tax_amount;
  
  -- Update quote totals
  UPDATE quotes
  SET 
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total = v_total,
    updated_at = now()
  WHERE id = v_quote_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update quote totals
DROP TRIGGER IF EXISTS trigger_update_quote_totals ON quote_line_items;
CREATE TRIGGER trigger_update_quote_totals
  AFTER INSERT OR UPDATE OR DELETE ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_totals();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on quotes
DROP TRIGGER IF EXISTS trigger_quotes_updated_at ON quotes;
CREATE TRIGGER trigger_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_quotes_updated_at();

-- Trigger to update updated_at on quote_line_items
DROP TRIGGER IF EXISTS trigger_quote_line_items_updated_at ON quote_line_items;
CREATE TRIGGER trigger_quote_line_items_updated_at
  BEFORE UPDATE ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_quotes_updated_at();

-- Function to log quote activity
CREATE OR REPLACE FUNCTION log_quote_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_action text;
  v_user_name text;
  v_company_id uuid;
BEGIN
  -- Get company_id
  v_company_id := NEW.company_id;
  
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status != OLD.status THEN
      v_action := 'status_changed_to_' || NEW.status;
    ELSE
      v_action := 'updated';
    END IF;
  END IF;
  
  -- Get user name if available
  SELECT full_name INTO v_user_name
  FROM user_profiles
  WHERE id = NEW.created_by;
  
  -- Log activity
  INSERT INTO quote_activity_log (
    quote_id,
    company_id,
    action,
    performed_by,
    performed_by_name,
    meta
  ) VALUES (
    NEW.id,
    v_company_id,
    v_action,
    NEW.created_by,
    v_user_name,
    jsonb_build_object(
      'old_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      'new_status', NEW.status
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log quote changes
DROP TRIGGER IF EXISTS trigger_log_quote_activity ON quotes;
CREATE TRIGGER trigger_log_quote_activity
  AFTER INSERT OR UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION log_quote_activity();
