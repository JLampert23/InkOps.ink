/*
  # Fix customer automation trigger

  The trigger function was referencing NEW.name but the customers table uses company_name.
  This migration updates the trigger to use the correct column name.
*/

CREATE OR REPLACE FUNCTION trigger_automation_customer_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM queue_matching_automations(
    NEW.company_id,
    'customer_created',
    jsonb_build_object(
      'customer_id', NEW.id,
      'customer_name', NEW.company_name,
      'email', NEW.email,
      'phone', NEW.phone
    )
  );
  RETURN NEW;
END;
$$;
