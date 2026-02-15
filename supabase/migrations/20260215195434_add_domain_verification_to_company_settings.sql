/*
  # Add Domain Verification to Company Settings

  1. New Columns
    - `customer_url_verification_token` (text) - Unique token for DNS TXT record verification
    - `customer_url_verification_status` (text) - Status: 'unverified', 'verified', 'failed'
    - `customer_url_verified_at` (timestamptz) - When domain was verified
    - `customer_url_verification_expires_at` (timestamptz) - When verification token expires

  2. Security
    - Add constraint to ensure verification token is unique
    - Add check constraint for valid status values
    - Add unique constraint on verified customer_url to prevent duplicates

  3. Important Notes
    - Verification tokens expire after 24 hours
    - Only one company can verify a specific domain
    - Domains must be verified before use
*/

-- Add domain verification columns to company_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'customer_url_verification_token'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN customer_url_verification_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'customer_url_verification_status'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN customer_url_verification_status text DEFAULT 'unverified';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'customer_url_verified_at'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN customer_url_verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'customer_url_verification_expires_at'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN customer_url_verification_expires_at timestamptz;
  END IF;
END $$;

-- Add check constraint for valid verification statuses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_verification_status'
  ) THEN
    ALTER TABLE company_settings
      ADD CONSTRAINT valid_verification_status
      CHECK (customer_url_verification_status IN ('unverified', 'verified', 'failed'));
  END IF;
END $$;

-- Create index for verification token lookups
CREATE INDEX IF NOT EXISTS idx_company_settings_verification_token
  ON company_settings(customer_url_verification_token)
  WHERE customer_url_verification_token IS NOT NULL;

-- Create index for verified domains
CREATE INDEX IF NOT EXISTS idx_company_settings_verified_url
  ON company_settings(customer_url)
  WHERE customer_url_verification_status = 'verified';

-- Function to generate verification token
CREATE OR REPLACE FUNCTION generate_domain_verification_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token text;
BEGIN
  -- Generate a random token
  token := 'inkops-verification-' || encode(gen_random_bytes(16), 'hex');
  RETURN token;
END;
$$;

-- Function to check if domain is already verified by another company
CREATE OR REPLACE FUNCTION is_domain_verified_elsewhere(
  p_company_id uuid,
  p_customer_url text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_company_id uuid;
BEGIN
  -- Check if this domain is already verified by a different company
  SELECT id INTO existing_company_id
  FROM company_settings
  WHERE customer_url = p_customer_url
    AND customer_url_verification_status = 'verified'
    AND id != p_company_id
  LIMIT 1;

  RETURN existing_company_id IS NOT NULL;
END;
$$;

-- Function to request domain verification
CREATE OR REPLACE FUNCTION request_domain_verification(
  p_company_id uuid,
  p_customer_url text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token text;
  v_expires_at timestamptz;
  v_domain_taken boolean;
BEGIN
  -- Check if domain is already verified by another company
  v_domain_taken := is_domain_verified_elsewhere(p_company_id, p_customer_url);
  
  IF v_domain_taken THEN
    RETURN json_build_object(
      'success', false,
      'error', 'This domain is already verified by another company'
    );
  END IF;

  -- Generate new token and expiration
  v_token := generate_domain_verification_token();
  v_expires_at := now() + interval '24 hours';

  -- Update company settings
  UPDATE company_settings
  SET 
    customer_url = p_customer_url,
    customer_url_verification_token = v_token,
    customer_url_verification_status = 'unverified',
    customer_url_verified_at = NULL,
    customer_url_verification_expires_at = v_expires_at
  WHERE id = p_company_id;

  RETURN json_build_object(
    'success', true,
    'token', v_token,
    'expires_at', v_expires_at
  );
END;
$$;

-- Function to mark domain as verified
CREATE OR REPLACE FUNCTION mark_domain_verified(
  p_company_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE company_settings
  SET 
    customer_url_verification_status = 'verified',
    customer_url_verified_at = now()
  WHERE id = p_company_id;

  RETURN FOUND;
END;
$$;

-- Function to mark domain verification as failed
CREATE OR REPLACE FUNCTION mark_domain_verification_failed(
  p_company_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE company_settings
  SET customer_url_verification_status = 'failed'
  WHERE id = p_company_id;

  RETURN FOUND;
END;
$$;

-- Reset verification status for any existing URLs
UPDATE company_settings
SET customer_url_verification_status = 'unverified'
WHERE customer_url IS NOT NULL 
  AND customer_url_verification_status IS NULL;
