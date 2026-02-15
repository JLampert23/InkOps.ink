/*
  # Fix Portal Session Email Column
  
  1. Changes
    - Update create_portal_session function to use correct column name 'email' instead of 'customer_email'
    - Add case-insensitive email matching for better user experience
    
  2. Security
    - Maintains SECURITY DEFINER for safe execution
    - No changes to access control
*/

-- Fix the create_portal_session function to use correct column name
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
  -- Find customer by email (case-insensitive)
  SELECT id, company_id INTO v_customer_id, v_company_id
  FROM customers
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found with email: ' || p_email
    );
  END IF;

  -- Generate token and set expiration
  v_token := encode(gen_random_bytes(32), 'hex');
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

-- Also fix verify_magic_token to use correct column name
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

  -- Get customer details (using correct column name 'email')
  SELECT id, contact_name as customer_name, email as customer_email, company_id
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
