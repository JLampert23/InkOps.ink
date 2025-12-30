/*
  # Create calculated invoice balances view

  1. Purpose
    - Calculate accurate invoice balances by summing actual payment records
    - Work around Printavo API data lag between invoices and payments endpoints
    
  2. Changes
    - Create a view that joins invoices with their payments
    - Calculates actual amount_paid from payment records
    - Calculates actual amount_outstanding as (total - calculated_amount_paid)
    - Determines paid_in_full status based on calculated balances
    
  3. Benefits
    - Real-time accurate balances even when Printavo API lags
    - Single source of truth for invoice status
    - No data duplication
*/

CREATE OR REPLACE VIEW printavo_invoices_calculated AS
SELECT 
  i.id,
  i.invoice_number,
  i.customer_email,
  i.customer_name,
  i.customer_company,
  i.subtotal,
  i.tax,
  i.total,
  COALESCE(SUM(p.amount), 0)::numeric AS amount_paid,
  GREATEST(i.total - COALESCE(SUM(p.amount), 0), 0)::numeric AS amount_outstanding,
  CASE 
    WHEN i.total <= COALESCE(SUM(p.amount), 0) THEN true
    ELSE false
  END AS paid_in_full,
  i.status,
  i.invoice_date,
  i.due_date,
  i.created_at,
  i.updated_at,
  i.raw_data
FROM printavo_invoices i
LEFT JOIN printavo_payments p ON p.invoice_id = i.id
GROUP BY 
  i.id, i.invoice_number, i.customer_email, i.customer_name, 
  i.customer_company, i.subtotal, i.tax, i.total, i.status, 
  i.invoice_date, i.due_date, i.created_at, i.updated_at, i.raw_data;