/*
  # Fix create_portal_session to use schema-qualified gen_random_bytes

  1. Changes
    - Updates the create_portal_session function to use extensions.gen_random_bytes()
    - The pgcrypto extension is installed in the 'extensions' schema
    - The function was failing because gen_random_bytes() wasn't found without schema prefix

  2. Security
    - Function remains SECURITY DEFINER for proper token generation
    - No changes to RLS policies
*/

CREATE OR REPLACE FUNCTION public.create_portal_session(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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

  -- Generate token using schema-qualified function and set expiration
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
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
$function$;