/*
  # Create Function to Get Customers with Stats

  ## Description
  Creates an optimized database function to fetch all customers
  along with their invoice statistics in a single efficient query.
  This replaces multiple round-trip queries with a single database call.

  ## Returns
  - customer_id: UUID of the customer
  - company_name: Customer's company name
  - contact_name: Customer's contact name
  - email: Customer's email
  - phone: Customer's phone
  - total_invoices: Count of invoices for this customer
  - total_billed: Sum of all invoice totals
  - total_paid: Sum of all amounts paid
  - outstanding_balance: Total billed minus total paid

  ## Performance
  Uses a single LEFT JOIN with aggregation for optimal performance.
*/

CREATE OR REPLACE FUNCTION get_customers_with_stats()
RETURNS TABLE (
  customer_id uuid,
  company_name text,
  contact_name text,
  email text,
  phone text,
  total_invoices bigint,
  total_billed numeric,
  total_paid numeric,
  outstanding_balance numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as customer_id,
    c.company_name,
    c.contact_name,
    c.email,
    c.phone,
    COUNT(pi.id) as total_invoices,
    COALESCE(SUM(CAST(pi.total AS numeric)), 0) as total_billed,
    COALESCE(SUM(CAST(pi.amount_paid AS numeric)), 0) as total_paid,
    COALESCE(SUM(CAST(pi.total AS numeric)), 0) - COALESCE(SUM(CAST(pi.amount_paid AS numeric)), 0) as outstanding_balance
  FROM customers c
  LEFT JOIN printavo_invoices pi ON pi.customer_id = c.id
  GROUP BY c.id, c.company_name, c.contact_name, c.email, c.phone
  ORDER BY total_billed DESC;
END;
$$ LANGUAGE plpgsql STABLE;
