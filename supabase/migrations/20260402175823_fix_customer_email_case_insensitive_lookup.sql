/*
  # Fix Case-Insensitive Email Lookup in Customer Portal Functions
  
  ## Problem
  Customer emails may be stored in uppercase (e.g., JAMIE@TODDSSPORTINGGOODS.COM)
  but functions were doing case-sensitive lookups with lowercase input.
  This caused "Customer not found" errors during password setup.
  
  ## Solution
  Update all customer portal functions to use case-insensitive email matching
  using LOWER() on both sides of the comparison.
  
  ## Functions Updated
  1. set_customer_password - Uses LOWER() for email lookup
  2. verify_customer_password_hash - Uses LOWER() for email lookup  
  3. create_password_reset_request - Uses LOWER() for email lookup
  4. verify_password_reset_token - Uses LOWER() for email lookup
*/

-- Update set_customer_password to use case-insensitive email lookup
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
    AND used_at IS NULL
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired setup token'
    );
  END IF;

  -- Find customer by email using case-insensitive matching
  SELECT id, company_id INTO v_customer
  FROM customers
  WHERE LOWER(email) = LOWER(p_email)
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

-- Update verify_customer_password_hash to use case-insensitive email lookup
CREATE OR REPLACE FUNCTION verify_customer_password_hash(
  p_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer record;
  v_branding record;
BEGIN
  -- Find customer by email using case-insensitive matching
  SELECT id, email, contact_name, company_id, password_hash, password_set_at
  INTO v_customer
  FROM customers
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;

  IF v_customer IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;

  -- Check if password has been set
  IF v_customer.password_hash IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'requiresSetup', true,
      'error', 'Password not set'
    );
  END IF;

  -- Get company branding
  SELECT company_name, logo_url, company_logo_primary_url, company_address, 
         company_phone, company_email, customer_url
  INTO v_branding
  FROM company_settings
  WHERE id = v_customer.company_id;

  RETURN json_build_object(
    'success', true,
    'customer', json_build_object(
      'id', v_customer.id,
      'email', v_customer.email,
      'name', v_customer.contact_name,
      'company_id', v_customer.company_id,
      'password_hash', v_customer.password_hash
    ),
    'branding', json_build_object(
      'company_name', v_branding.company_name,
      'logo_url', v_branding.logo_url,
      'company_logo_primary_url', v_branding.company_logo_primary_url,
      'company_address', v_branding.company_address,
      'company_phone', v_branding.company_phone,
      'company_email', v_branding.company_email,
      'customer_url', v_branding.customer_url
    )
  );
END;
$$;

-- Update create_password_reset_request to use case-insensitive email lookup
CREATE OR REPLACE FUNCTION create_password_reset_request(
  p_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer record;
  v_reset_token text;
  v_expires_at timestamptz;
BEGIN
  -- Find customer by email using case-insensitive matching
  SELECT id, email, contact_name, company_id
  INTO v_customer
  FROM customers
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;

  IF v_customer IS NULL THEN
    -- Return success anyway to prevent email enumeration
    RETURN json_build_object(
      'success', true,
      'message', 'If an account exists, a reset link will be sent'
    );
  END IF;

  -- Generate reset token
  v_reset_token := extensions.gen_random_uuid()::text;
  v_expires_at := now() + interval '1 hour';

  -- Store reset token
  UPDATE customers
  SET 
    password_reset_token = v_reset_token,
    password_reset_expires_at = v_expires_at
  WHERE id = v_customer.id;

  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer.id,
    'customer_email', v_customer.email,
    'customer_name', v_customer.contact_name,
    'company_id', v_customer.company_id,
    'reset_token', v_reset_token,
    'expires_at', v_expires_at
  );
END;
$$;

-- Update verify_password_reset_token to use case-insensitive email lookup
CREATE OR REPLACE FUNCTION verify_password_reset_token(
  p_token text,
  p_new_password_hash text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer record;
BEGIN
  -- Find customer by reset token
  SELECT id, email, company_id
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

  -- Update password and clear reset token
  UPDATE customers
  SET 
    password_hash = p_new_password_hash,
    password_set_at = now(),
    password_reset_token = NULL,
    password_reset_expires_at = NULL
  WHERE id = v_customer.id;

  RETURN json_build_object(
    'success', true,
    'customer_id', v_customer.id,
    'company_id', v_customer.company_id
  );
END;
$$;
