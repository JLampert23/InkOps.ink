/*
  # Create Customer Portal Authentication

  1. New Tables
    - `customer_portal_sessions` - Magic link sessions for customer authentication
      - `id` (uuid, primary key)
      - `customer_id` (uuid) - References customers table
      - `email` (text) - Customer email
      - `magic_token` (text) - Unique magic link token
      - `expires_at` (timestamptz) - Token expiration (15 minutes)
      - `used_at` (timestamptz) - When token was used
      - `created_at` (timestamptz)

    - `customer_stripe_payment_methods` - Saved Stripe payment methods
      - `id` (uuid, primary key)
      - `customer_id` (uuid) - References customers table
      - `company_id` (uuid) - References company_settings
      - `stripe_payment_method_id` (text) - Stripe PM ID (tokenized)
      - `payment_method_type` (text) - 'card' or 'us_bank_account'
      - `last_four` (text) - Last 4 digits
      - `brand` (text) - Card brand or bank name
      - `exp_month` (int) - Card expiration month
      - `exp_year` (int) - Card expiration year
      - `is_default` (boolean) - Default payment method
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Sessions can only be created by edge functions
    - Payment methods can only be accessed by the owning customer
    - All tokens are unique and time-limited

  3. Important Notes
    - Magic links expire after 15 minutes
    - Payment method IDs are Stripe tokens (PCI compliant)
    - No raw payment data is stored
*/

-- Create customer portal sessions table
CREATE TABLE IF NOT EXISTS customer_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  magic_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for portal sessions
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token
  ON customer_portal_sessions(magic_token)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_portal_sessions_email
  ON customer_portal_sessions(email)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_portal_sessions_expiry
  ON customer_portal_sessions(expires_at)
  WHERE used_at IS NULL;

-- Enable RLS on portal sessions
ALTER TABLE customer_portal_sessions ENABLE ROW LEVEL SECURITY;

-- Portal sessions can only be accessed by service role
CREATE POLICY "Service role can manage portal sessions"
  ON customer_portal_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create customer Stripe payment methods table
CREATE TABLE IF NOT EXISTS customer_stripe_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  stripe_payment_method_id text UNIQUE NOT NULL,
  payment_method_type text NOT NULL CHECK (payment_method_type IN ('card', 'us_bank_account')),
  last_four text NOT NULL,
  brand text,
  exp_month integer,
  exp_year integer,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for payment methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_customer
  ON customer_stripe_payment_methods(customer_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_company
  ON customer_stripe_payment_methods(company_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_id
  ON customer_stripe_payment_methods(stripe_payment_method_id);

-- Enable RLS on payment methods
ALTER TABLE customer_stripe_payment_methods ENABLE ROW LEVEL SECURITY;

-- Payment methods can only be accessed by service role (for now, portal access will be via edge functions)
CREATE POLICY "Service role can manage payment methods"
  ON customer_stripe_payment_methods
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to generate magic link token
CREATE OR REPLACE FUNCTION generate_magic_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token text;
BEGIN
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$;

-- Function to create portal session
CREATE OR REPLACE FUNCTION create_portal_session(
  p_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
  v_company_id uuid;
  v_token text;
  v_expires_at timestamptz;
BEGIN
  -- Find customer by email
  SELECT id, company_id INTO v_customer_id, v_company_id
  FROM customers
  WHERE customer_email = p_email
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;

  -- Generate token and set expiration
  v_token := generate_magic_token();
  v_expires_at := now() + interval '15 minutes';

  -- Create session
  INSERT INTO customer_portal_sessions (
    customer_id,
    email,
    magic_token,
    expires_at
  ) VALUES (
    v_customer_id,
    p_email,
    v_token,
    v_expires_at
  );

  RETURN json_build_object(
    'success', true,
    'token', v_token,
    'expires_at', v_expires_at,
    'customer_id', v_customer_id,
    'company_id', v_company_id
  );
END;
$$;

-- Function to verify magic token
CREATE OR REPLACE FUNCTION verify_magic_token(
  p_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session record;
  v_customer record;
  v_company record;
BEGIN
  -- Find valid session
  SELECT * INTO v_session
  FROM customer_portal_sessions
  WHERE magic_token = p_token
    AND used_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired token'
    );
  END IF;

  -- Mark token as used
  UPDATE customer_portal_sessions
  SET used_at = now()
  WHERE id = v_session.id;

  -- Get customer details
  SELECT id, customer_name, customer_email, company_id
  INTO v_customer
  FROM customers
  WHERE id = v_session.customer_id;

  -- Get company branding
  SELECT company_name, logo_url, company_logo_primary_url, 
         company_address, company_phone, company_email, customer_url
  INTO v_company
  FROM company_settings
  WHERE id = v_customer.company_id;

  RETURN json_build_object(
    'success', true,
    'customer', json_build_object(
      'id', v_customer.id,
      'email', v_customer.customer_email,
      'name', v_customer.customer_name,
      'company_id', v_customer.company_id
    ),
    'branding', json_build_object(
      'company_name', v_company.company_name,
      'logo_url', v_company.logo_url,
      'company_logo_primary_url', v_company.company_logo_primary_url,
      'company_address', v_company.company_address,
      'company_phone', v_company.company_phone,
      'company_email', v_company.company_email,
      'customer_url', v_company.customer_url
    )
  );
END;
$$;

-- Function to ensure only one default payment method per customer
CREATE OR REPLACE FUNCTION ensure_single_default_payment_method()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE customer_stripe_payment_methods
    SET is_default = false
    WHERE customer_id = NEW.customer_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to maintain single default payment method
DROP TRIGGER IF EXISTS trg_ensure_single_default_payment_method ON customer_stripe_payment_methods;
CREATE TRIGGER trg_ensure_single_default_payment_method
  BEFORE INSERT OR UPDATE ON customer_stripe_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_payment_method();

-- Function to clean up expired sessions (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_portal_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM customer_portal_sessions
  WHERE expires_at < now() - interval '1 day';
END;
$$;
