/*
  # Add Customer Password Authentication and Reset Fields

  1. Changes to Customers Table
    - `password_hash` (text) - Bcrypt hashed password for customer portal login
    - `password_set_at` (timestamptz) - When the password was last set/changed
    - `password_reset_token` (text) - Token for password reset flow
    - `password_reset_expires_at` (timestamptz) - When the reset token expires

  2. Security
    - Password hash is stored securely using bcrypt
    - Reset tokens expire after 1 hour
    - All password operations go through secure edge functions

  3. Important Notes
    - Customers can log in via magic link OR password
    - Password reset requires email verification
    - Tokens are one-time use and time-limited
*/

-- Add password fields to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE customers ADD COLUMN password_hash text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'password_set_at'
  ) THEN
    ALTER TABLE customers ADD COLUMN password_set_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'password_reset_token'
  ) THEN
    ALTER TABLE customers ADD COLUMN password_reset_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'password_reset_expires_at'
  ) THEN
    ALTER TABLE customers ADD COLUMN password_reset_expires_at timestamptz;
  END IF;
END $$;

-- Create index for password reset token lookup
CREATE INDEX IF NOT EXISTS idx_customers_password_reset_token
  ON customers(password_reset_token)
  WHERE password_reset_token IS NOT NULL;

-- Function to create a password reset request
CREATE OR REPLACE FUNCTION create_password_reset_request(
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

  -- Generate reset token (64 character hex string)
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '1 hour';

  -- Save reset token to customer record
  UPDATE customers
  SET 
    password_reset_token = v_token,
    password_reset_expires_at = v_expires_at
  WHERE id = v_customer_id;

  RETURN json_build_object(
    'success', true,
    'token', v_token,
    'expires_at', v_expires_at,
    'customer_id', v_customer_id,
    'company_id', v_company_id
  );
END;
$$;

-- Function to verify password reset token and update password
CREATE OR REPLACE FUNCTION verify_password_reset_token(
  p_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer record;
BEGIN
  -- Find customer with valid reset token
  SELECT id, customer_email, customer_name, company_id
  INTO v_customer
  FROM customers
  WHERE password_reset_token = p_token
    AND password_reset_expires_at > now()
  LIMIT 1;

  IF v_customer IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired reset token'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer.id,
    'email', v_customer.customer_email,
    'name', v_customer.customer_name,
    'company_id', v_customer.company_id
  );
END;
$$;

-- Function to reset password (after token verification)
CREATE OR REPLACE FUNCTION reset_customer_password(
  p_token text,
  p_password_hash text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Find customer with valid reset token
  SELECT id INTO v_customer_id
  FROM customers
  WHERE password_reset_token = p_token
    AND password_reset_expires_at > now()
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired reset token'
    );
  END IF;

  -- Update password and clear reset token
  UPDATE customers
  SET 
    password_hash = p_password_hash,
    password_set_at = now(),
    password_reset_token = NULL,
    password_reset_expires_at = NULL
  WHERE id = v_customer_id;

  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer_id
  );
END;
$$;

-- Function to verify customer password for login
CREATE OR REPLACE FUNCTION verify_customer_password_hash(
  p_email text,
  p_password_hash text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer record;
  v_company record;
BEGIN
  -- Find customer by email
  SELECT id, customer_email, customer_name, company_id, password_hash, password_set_at
  INTO v_customer
  FROM customers
  WHERE customer_email = p_email
  LIMIT 1;

  IF v_customer IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;

  -- Check if password is set
  IF v_customer.password_hash IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'requiresSetup', true,
      'error', 'Password not set. Please set up your password first.'
    );
  END IF;

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
      'company_id', v_customer.company_id,
      'stored_hash', v_customer.password_hash
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

-- Function to set customer password (for initial setup)
CREATE OR REPLACE FUNCTION set_customer_password(
  p_email text,
  p_password_hash text,
  p_setup_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer record;
  v_session record;
BEGIN
  -- Verify the setup token is valid (from magic link)
  SELECT * INTO v_session
  FROM customer_portal_sessions
  WHERE magic_token = p_setup_token
    AND expires_at > now()
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired setup token'
    );
  END IF;

  -- Find customer by email
  SELECT id, company_id INTO v_customer
  FROM customers
  WHERE customer_email = p_email
  LIMIT 1;

  IF v_customer IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;

  -- Update password
  UPDATE customers
  SET 
    password_hash = p_password_hash,
    password_set_at = now()
  WHERE id = v_customer.id;

  -- Mark token as used
  UPDATE customer_portal_sessions
  SET used_at = now()
  WHERE id = v_session.id;

  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer.id,
    'company_id', v_customer.company_id
  );
END;
$$;
