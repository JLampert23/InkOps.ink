/*
  # Fix scheduled_date Column Reference

  1. Changes
    - Update automation trigger to use correct column name `production_due_date` instead of `scheduled_date`
    - This fixes the error: record "new" has no field "scheduled_date"

  2. Impact
    - Fixes quote approval automation that creates production schedule entries
*/

-- Drop and recreate the trigger function with correct column reference
CREATE OR REPLACE FUNCTION trigger_automation_imprints_added_to_scheduler()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM queue_matching_automations(
    NEW.company_id,
    'imprints_added_to_scheduler',
    jsonb_build_object(
      'schedule_entry_id', NEW.id,
      'work_order_id', NEW.work_order_id,
      'scheduled_date', NEW.production_due_date
    )
  );
  RETURN NEW;
END;
$$;
