/*
  # Make Jamie Admin on Signup

  1. Updates
    - Modifies the handle_new_user function to automatically grant admin role to Jamie@toddssportinggoods.com
    - Sets their role as 'admin' instead of the default

  2. Security
    - Only affects the specific email address
    - All other users get the default 'user' role
*/

-- Update the function to check for the admin email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the admin email and set role accordingly
  IF LOWER(NEW.email) = 'jamie@toddssportinggoods.com' THEN
    INSERT INTO public.user_profiles (id, email, role, full_name)
    VALUES (NEW.id, NEW.email, 'admin', 'Jamie')
    ON CONFLICT (id) DO UPDATE SET role = 'admin';
  ELSE
    INSERT INTO public.user_profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'user')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
