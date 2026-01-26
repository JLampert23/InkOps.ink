/*
  # Backfill Quote Zip Codes from Customers

  1. Updates
    - Populate `bill_zip` and `ship_zip` in the `quotes` table from linked `customers` table
    - Only updates quotes where zip codes are missing but customer has zip codes
  
  2. Notes
    - This is a one-time data migration
    - QuoteBuilder already pulls zip codes for new quotes
    - QuoteDetail now fetches zip codes from customers on display
*/

-- Backfill billing zip codes where they're missing
UPDATE quotes q
SET bill_zip = c.billing_zip
FROM customers c
WHERE q.customer_id = c.id
  AND q.bill_zip IS NULL
  AND c.billing_zip IS NOT NULL;

-- Backfill shipping zip codes where they're missing
UPDATE quotes q
SET ship_zip = c.shipping_zip
FROM customers c
WHERE q.customer_id = c.id
  AND q.ship_zip IS NULL
  AND c.shipping_zip IS NOT NULL;
