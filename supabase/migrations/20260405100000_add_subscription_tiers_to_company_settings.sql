-- Migration: Add subscription tier columns to company_settings

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional')),
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_period_end timestamptz,
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Set Default value for Todds Screen Printing (and any other existing company) to 'professional' to avoid locking the client out.
UPDATE company_settings SET subscription_tier = 'professional';
