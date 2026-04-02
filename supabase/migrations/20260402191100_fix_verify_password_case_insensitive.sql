/*
  # Fix Case-Insensitive Email Matching in Password Verification

  1. Changes
    - Updates the two-parameter version of `verify_customer_password_hash` to use 
      case-insensitive email matching (LOWER() comparison)
    - This matches the behavior of the one-parameter version

  2. Issue Fixed
    - Login was failing because emails stored as uppercase were not matching 
      lowercase input from the login form
*/

CREATE OR REPLACE FUNCTION public.verify_customer_password_hash(p_email text, p_password_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_customer record;
  v_company record;
BEGIN
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

  IF v_customer.password_hash IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'requiresSetup', true,
      'error', 'Password not set. Please set up your password first.'
    );
  END IF;

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
$function$;
