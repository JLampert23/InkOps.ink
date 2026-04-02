/*
  # Fix Token Flow for Password Setup

  1. Problem
    - verify_magic_token marks token as used immediately
    - set_customer_password still works but verify_magic_token in edge function 
      shows token as used when user needs password setup
    - The flow breaks for first-time users

  2. Solution
    - Modify verify_magic_token to NOT mark token as used when customer has no password
    - Token will be consumed either:
      a) By set_customer_password when user sets their password
      b) By verify_magic_token on subsequent login when user already has password
    - This allows the magic link token to be reused for password setup

  3. Security Considerations
    - Token still expires after the configured time
    - Token is consumed after password is set
    - Users with existing passwords have tokens consumed immediately
*/

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
  SELECT id, customer_name, customer_email, company_id, 
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
      'email', v_customer.customer_email,
      'name', v_customer.customer_name,
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
