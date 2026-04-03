/*
  # Fix Customer Column Names in Database Functions

  1. Problem
    - Multiple database functions reference columns that don't exist:
      - `customer_email` should be `email`
      - `customer_name` should be `contact_name`
    - This causes token verification to fail silently
    - Users clicking welcome email links see login instead of password setup

  2. Functions Fixed
    - `verify_magic_token` - Used when clicking magic link from email
    - `create_password_reset_request` - Used for password reset flow
    - `verify_password_reset_token` - Used to validate reset tokens
    - `verify_customer_password_hash` - Used for password login
    - `set_customer_password` - Used for initial password setup

  3. Impact
    - Welcome email links will now properly detect new users need password setup
    - Password reset flow will work correctly
    - All customer portal authentication flows restored
*/

-- Fix verify_magic_token function
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
  v_has_password boolean;
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

  -- Get customer details including password status
  -- Using correct column names: email and contact_name
  SELECT id, contact_name, email, company_id, 
         (password_hash IS NOT NULL) as has_password
  INTO v_customer
  FROM customers
  WHERE id = v_session.customer_id;

  -- Only mark token as used if user ALREADY has a password
  -- If they need to set up a password, the token will be consumed
  -- by set_customer_password instead
  IF v_customer.has_password THEN
    UPDATE customer_portal_sessions
    SET used_at = now()
    WHERE id = v_session.id;
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
      'email', v_customer.email,
      'name', v_customer.contact_name,
      'company_id', v_customer.company_id,
      'has_password', v_customer.has_password
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

-- Fix create_password_reset_request function
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
  -- Find customer by email (using correct column name)
  SELECT id, company_id INTO v_customer_id, v_company_id
  FROM customers
  WHERE email = p_email
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

-- Fix verify_password_reset_token function
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
  -- Find customer with valid reset token (using correct column names)
  SELECT id, email, contact_name, company_id
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
    'email', v_customer.email,
    'name', v_customer.contact_name,
    'company_id', v_customer.company_id
  );
END;
$$;

-- Fix verify_customer_password_hash function
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
  -- Find customer by email (using correct column names)
  SELECT id, email, contact_name, company_id, password_hash, password_set_at
  INTO v_customer
  FROM customers
  WHERE email = p_email
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
      'email', v_customer.email,
      'name', v_customer.contact_name,
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

-- Fix set_customer_password function
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

  -- Find customer by email (using correct column name)
  SELECT id, company_id INTO v_customer
  FROM customers
  WHERE email = p_email
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
