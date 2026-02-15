/*
  # Grant Portal RPC Permissions
  
  1. Changes
    - Grant execute permissions on portal functions to authenticated users
    - Ensure anon can also execute (for public access if needed)
    
  2. Security
    - Functions are SECURITY DEFINER so they run with elevated privileges
    - RLS policies on customer_portal_sessions protect the data
    - Functions validate customer existence before creating sessions
*/

-- Grant execute permissions to authenticated and anon roles
GRANT EXECUTE ON FUNCTION create_portal_session(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_magic_token(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_magic_token() TO authenticated, anon;

-- Also ensure service_role has access
GRANT EXECUTE ON FUNCTION create_portal_session(text) TO service_role;
GRANT EXECUTE ON FUNCTION verify_magic_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION generate_magic_token() TO service_role;
