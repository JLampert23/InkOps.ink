/*
  # Create Schedule Entries on Quote Approval

  1. Functions
    - `create_schedule_entries_on_approval()` - Automatically creates production schedule entries when a quote is approved

  2. Triggers
    - After update on quotes table, if status changes to 'approved', create schedule entries

  This ensures schedule entries are created regardless of how the quote is approved (manual, API, public link, etc.)
*/

-- Function to create schedule entries when quote is approved
CREATE OR REPLACE FUNCTION create_schedule_entries_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Insert schedule entries for each imprint
    INSERT INTO production_schedule_entries (
      company_id,
      quote_id,
      line_item_id,
      imprint_id,
      type_of_work,
      imprint_number,
      artwork_thumb_url,
      production_due_date,
      station,
      quantity,
      step_statuses,
      priority_order,
      customer_name,
      quote_number
    )
    SELECT
      NEW.company_id,
      NEW.id,
      qi.line_item_id,
      qi.id,
      qi.type_of_work,
      qi.imprint_number,
      qi.artwork_url,
      COALESCE(NEW.production_due_date, NEW.due_date, CURRENT_DATE + INTERVAL '7 days'),
      NULL,
      COALESCE(qli.quantity, 0),
      '{}'::jsonb,
      0,
      COALESCE(c.customer_name, NEW.customer_name),
      NEW.quote_number
    FROM quote_imprints qi
    LEFT JOIN quote_line_items qli ON qi.line_item_id = qli.id
    LEFT JOIN customers c ON NEW.customer_id = c.id
    WHERE qi.quote_id = NEW.id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_create_schedule_on_approval ON quotes;
CREATE TRIGGER trigger_create_schedule_on_approval
  AFTER UPDATE ON quotes
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION create_schedule_entries_on_approval();