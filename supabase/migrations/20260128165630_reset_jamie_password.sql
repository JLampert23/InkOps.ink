/*
  # Reset Jamie's Password
  
  This is a one-time migration to reset the password for jamie@toddssportinggoods.com
  to allow login access.
*/

-- Create a temporary function to reset the password
CREATE OR REPLACE FUNCTION reset_user_password(user_id uuid, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the user's password using Supabase's internal password encryption
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = user_id;
END;
$$;

-- Reset Jamie's password
SELECT reset_user_password('aa362957-36e2-4b76-b830-165a7c32e674'::uuid, 'Jamielampert');

-- Drop the temporary function
DROP FUNCTION reset_user_password(uuid, text);
