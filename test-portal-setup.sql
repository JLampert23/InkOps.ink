-- Test Portal Setup Script
-- Run this in your Supabase SQL Editor to verify everything is set up correctly

-- 1. Check if customers exist
SELECT
  id,
  customer_name,
  customer_email,
  company_id,
  created_at
FROM customers
ORDER BY created_at DESC
LIMIT 10;

-- 2. Test the create_portal_session function with a customer email
-- Replace 'test@example.com' with an actual customer email from step 1
SELECT create_portal_session('mplampert@gmail.com');

-- 3. Check if any portal sessions were created
SELECT
  id,
  email,
  magic_token,
  expires_at,
  used_at,
  created_at
FROM customer_portal_sessions
ORDER BY created_at DESC
LIMIT 5;

-- 4. Verify the function exists
SELECT
  proname as function_name,
  prosrc as function_source
FROM pg_proc
WHERE proname IN ('create_portal_session', 'verify_magic_token', 'generate_magic_token');
