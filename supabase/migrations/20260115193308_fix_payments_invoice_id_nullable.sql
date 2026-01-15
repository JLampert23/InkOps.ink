/*
  # Make invoice_id nullable in payments table

  1. Changes
    - Change invoice_id from NOT NULL to nullable
    - This allows payments that aren't associated with invoices (e.g., standalone Stripe payments)

  2. Rationale
    - Some payments may not be linked to invoices
    - Standalone Stripe checkout sessions
    - Test payments
*/

ALTER TABLE payments 
ALTER COLUMN invoice_id DROP NOT NULL;