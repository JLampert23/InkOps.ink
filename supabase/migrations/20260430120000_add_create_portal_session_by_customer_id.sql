/*
  # Add create_portal_session_by_customer_id RPC

  Adds a new RPC that creates a customer portal magic-link session keyed by
  customer_id (UUID) instead of email. Used by the "Copy Portal Link" button
  in EditCustomerModal where the customer's id is known directly from props.

  Why a new function instead of changing create_portal_session(p_email):
    - create_portal_session(p_email) is also called by:
        * supabase/functions/send-customer-portal-welcome (admin types email)
        * supabase/functions/send-magic-link            (customer types email)
      Both flows legitimately only have an email. Adding a new function avoids
      breaking those callers.

  Bug being fixed:
    The old RPC does `WHERE LOWER(email) = LOWER(p_email) LIMIT 1`. When two
    customers share an email (or a customer's email lives only on the primary
    contact and customers.email is NULL), the lookup either returns the wrong
    customer or fails. Result: every "Copy Portal Link" click produced a token
    for the same / wrong customer.

  Behavior:
    1. Look up customer by id (unambiguous).
    2. Use customers.email; if empty/null, fall back to the primary contact's
       email from customer_contacts.
    3. Insert a row into customer_portal_sessions and return the same JSON
       shape as create_portal_session for caller compatibility.

  Security: SECURITY DEFINER, same as the existing RPC. Granted to
  authenticated, anon, and service_role.
*/

CREATE OR REPLACE FUNCTION public.create_portal_session_by_customer_id(p_customer_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_email text;
  v_company_id uuid;
  v_token text;
  v_expires_at timestamptz;
BEGIN
  SELECT
    COALESCE(
      NULLIF(c.email, ''),
      (
        SELECT cc.email
        FROM customer_contacts cc
        WHERE cc.customer_id = c.id
          AND cc.is_primary = true
          AND cc.email IS NOT NULL
          AND cc.email <> ''
        LIMIT 1
      )
    ),
    c.company_id
  INTO v_email, v_company_id
  FROM customers c
  WHERE c.id = p_customer_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer has no email on record. Add a primary contact email or set the customer email first.'
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
    p_customer_id,
    v_email,
    v_token,
    v_expires_at
  );

  RETURN json_build_object(
    'success', true,
    'token', v_token,
    'expires_at', v_expires_at,
    'customer_id', p_customer_id,
    'company_id', v_company_id,
    'email', v_email
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_portal_session_by_customer_id(uuid)
  TO authenticated, anon, service_role;
