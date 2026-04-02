/*
  # Extend Portal Session Token Expiration

  1. Changes
    - Updates `create_portal_session` function to extend token validity from 15 minutes to 48 hours
    - This allows customers more time to click password setup links in their emails
    - Particularly useful when emails arrive while customers are away from their computer

  2. Security
    - 48 hours is still a reasonable security window for password setup
    - Tokens are still single-use (marked as used after verification)
    - Token is invalidated once password is set
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

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '48 hours';

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
