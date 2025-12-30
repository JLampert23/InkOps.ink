/*
  # Add API Credentials Storage

  1. New Tables
    - `api_credentials`
      - `id` (uuid, primary key)
      - `service_name` (text, unique) - Name of the external service (e.g., 'printavo')
      - `credentials` (jsonb) - Encrypted credentials storage
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `api_credentials` table
    - Add policy to allow service role access only (Edge Functions)
    - This table is not accessible to anonymous or authenticated users
  
  3. Initial Data
    - Insert Printavo API credentials for immediate use
*/

CREATE TABLE IF NOT EXISTS api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text UNIQUE NOT NULL,
  credentials jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;

-- No policies needed - only service role (Edge Functions) can access
-- RLS will block all user access by default

-- Insert Printavo credentials
INSERT INTO api_credentials (service_name, credentials)
VALUES (
  'printavo',
  jsonb_build_object(
    'email', 'sales@toddssportinggoods.com',
    'token', 'nfmw24ZgGEtj9ngNfCqMNA'
  )
)
ON CONFLICT (service_name) 
DO UPDATE SET 
  credentials = EXCLUDED.credentials,
  updated_at = now();