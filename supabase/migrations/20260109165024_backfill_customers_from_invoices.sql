/*
  # Backfill Customers from Existing Invoices

  ## Description
  This migration creates customer records for all existing invoices
  and links invoices to their customers. This is needed because the
  customer-linking logic was added after invoices were already synced.

  ## Process
  1. Find all unique customers from invoices
  2. Create customer records for each unique customer
  3. Link invoices to their respective customers

  ## Matching Logic
  - Match by email first (if available)
  - Fall back to matching by customer name
  - Create new customer if no match found
*/

-- Create a function to backfill customers
CREATE OR REPLACE FUNCTION backfill_customers_from_invoices()
RETURNS TABLE(
  customers_created integer,
  invoices_linked integer
) AS $$
DECLARE
  v_customers_created integer := 0;
  v_invoices_linked integer := 0;
  v_invoice RECORD;
  v_customer_id uuid;
  v_customer_name text;
  v_customer_email text;
BEGIN
  -- Loop through all invoices that don't have a customer_id
  FOR v_invoice IN 
    SELECT DISTINCT ON (customer_name, customer_email)
      id,
      customer_name,
      customer_email,
      customer_company,
      customer_phone
    FROM printavo_invoices
    WHERE customer_id IS NULL
      AND customer_name IS NOT NULL
      AND customer_name != ''
    ORDER BY customer_name, customer_email, created_at DESC
  LOOP
    v_customer_name := COALESCE(v_invoice.customer_company, v_invoice.customer_name);
    v_customer_email := v_invoice.customer_email;
    v_customer_id := NULL;

    -- Try to find existing customer by email
    IF v_customer_email IS NOT NULL AND v_customer_email != '' THEN
      SELECT id INTO v_customer_id
      FROM customers
      WHERE email = v_customer_email
      LIMIT 1;
    END IF;

    -- If not found by email, try by company name
    IF v_customer_id IS NULL THEN
      SELECT id INTO v_customer_id
      FROM customers
      WHERE company_name = v_customer_name
      LIMIT 1;
    END IF;

    -- Create customer if not found
    IF v_customer_id IS NULL THEN
      INSERT INTO customers (
        company_name,
        contact_name,
        email,
        phone,
        status
      ) VALUES (
        v_customer_name,
        v_invoice.customer_name,
        v_customer_email,
        v_invoice.customer_phone,
        'active'
      )
      RETURNING id INTO v_customer_id;
      
      v_customers_created := v_customers_created + 1;
    END IF;

    -- Link all invoices for this customer
    UPDATE printavo_invoices
    SET customer_id = v_customer_id
    WHERE customer_id IS NULL
      AND (
        (customer_email IS NOT NULL AND customer_email != '' AND customer_email = v_customer_email)
        OR (customer_name = v_invoice.customer_name AND (v_customer_email IS NULL OR v_customer_email = ''))
      );
    
    GET DIAGNOSTICS v_invoices_linked = ROW_COUNT;
  END LOOP;

  RETURN QUERY SELECT v_customers_created, v_invoices_linked;
END;
$$ LANGUAGE plpgsql;

-- Run the backfill function
SELECT * FROM backfill_customers_from_invoices();

-- Drop the function after use (optional, can keep for re-runs)
-- DROP FUNCTION IF EXISTS backfill_customers_from_invoices();
