/*
  # Update verify_magic_token to Return Password Status

  1. Changes
    - Modify verify_magic_token function to check if customer has a password set
    - Return has_password boolean in the customer object

  2. Purpose
    - Enable the portal login to determine if user needs password setup
    - Support proper redirection to password setup page for new users
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

  -- Get customer details including password status
  SELECT id, customer_name, customer_email, company_id, 
         (password_hash IS NOT NULL) as has_password
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
