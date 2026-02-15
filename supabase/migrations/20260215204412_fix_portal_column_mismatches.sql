/*
  # Fix Customer Portal Column Mismatches

  1. Changes
    - Fix `create_portal_session` to use correct column names
    - Fix `verify_magic_token` to use correct column names
    - Update references from `customer_email` to `email`
    - Update references from `customer_name` to `company_name`

  2. Security
    - No changes to RLS policies
    - Functions remain SECURITY DEFINER

  3. Important Notes
    - This fixes the portal authentication flow
    - Aligns function code with actual customers table schema
*/

-- Fix create_portal_session function
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
  -- Find customer by email (FIXED: using correct column name)
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

  -- Get customer details (FIXED: using correct column names)
  SELECT id, company_name, contact_name, email, company_id
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
      'email', v_customer.email,
      'name', v_customer.contact_name,
      'company_name', v_customer.company_name,
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
