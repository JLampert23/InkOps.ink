/*
  # Backfill unified payments table with historical data

  1. Purpose
    - Migrate existing payment records from stripe_payments and paid_invoices tables
    - Populate the unified payments table with all historical payment data
    - Ensure proper mapping of fields and prevent duplicates

  2. Data Sources
    - stripe_payments: Stripe payment records
    - paid_invoices: Manual payment records

  3. Mapping
    - Stripe payments: source='stripe', status='successful', includes transaction IDs
    - Manual payments: source='manual', status='successful', from paid_invoices
*/

-- Backfill from stripe_payments table
INSERT INTO payments (
  company_id,
  invoice_id,
  customer_id,
  amount,
  payment_date,
  payment_method,
  payment_type,
  stripe_transaction_id,
  stripe_payment_intent_id,
  stripe_charge_id,
  status,
  source,
  metadata,
  created_at,
  updated_at
)
SELECT 
  sp.company_id,
  sp.printavo_invoice_id,
  pi.customer_id,
  sp.amount,
  COALESCE(sp.created_at, NOW()),
  'Stripe',
  'stripe',
  COALESCE(sp.stripe_charge_id, sp.stripe_payment_intent_id),
  sp.stripe_payment_intent_id,
  sp.stripe_charge_id,
  CASE 
    WHEN sp.status = 'succeeded' THEN 'successful'
    WHEN sp.status = 'failed' THEN 'failed'
    ELSE sp.status
  END,
  'stripe',
  jsonb_build_object(
    'customer_email', sp.customer_email,
    'customer_name', sp.customer_name,
    'payment_method', sp.payment_method,
    'currency', sp.currency,
    'migrated_from', 'stripe_payments',
    'original_metadata', sp.metadata
  ),
  sp.created_at,
  sp.updated_at
FROM stripe_payments sp
LEFT JOIN printavo_invoices pi ON pi.id = sp.printavo_invoice_id
WHERE NOT EXISTS (
  SELECT 1 FROM payments p 
  WHERE p.stripe_payment_intent_id = sp.stripe_payment_intent_id
);

-- Backfill from paid_invoices table (manual payments)
INSERT INTO payments (
  company_id,
  invoice_id,
  customer_id,
  amount,
  payment_date,
  payment_method,
  payment_type,
  status,
  source,
  notes,
  metadata,
  created_at
)
SELECT 
  pdi.company_id,
  pdi.printavo_invoice_id,
  pi.customer_id,
  pdi.amount_paid,
  COALESCE(pdi.payment_date, pdi.created_at, NOW()),
  COALESCE(pdi.payment_method, 'Manual'),
  CASE 
    WHEN pdi.payment_method = 'manual' THEN 'other'
    ELSE 'other'
  END,
  'successful',
  'manual',
  'Migrated from paid_invoices',
  jsonb_build_object(
    'customer_email', pdi.customer_email,
    'customer_name', pdi.customer_name,
    'invoice_total', pdi.invoice_total,
    'printavo_visual_id', pdi.printavo_visual_id,
    'migrated_from', 'paid_invoices',
    'original_metadata', pdi.metadata
  ),
  pdi.created_at
FROM paid_invoices pdi
LEFT JOIN printavo_invoices pi ON pi.id = pdi.printavo_invoice_id
WHERE NOT EXISTS (
  SELECT 1 FROM payments p 
  WHERE p.invoice_id = pdi.printavo_invoice_id 
  AND p.amount = pdi.amount_paid
  AND p.payment_date = pdi.payment_date
);