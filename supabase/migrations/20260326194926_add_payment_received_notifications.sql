/*
  # Add Payment Received Notifications

  1. Changes
    - Create trigger function to automatically generate notifications when payments are recorded
    - Notifications are sent to all users in the company who have payment notifications enabled
    - Trigger fires on INSERT to the payments table (new payments only)
    - Fetches invoice and customer details to build a meaningful notification message

  2. Security
    - Function uses SECURITY DEFINER to ensure it can insert notifications
    - Company isolation is maintained - only users within the same company get notifications
    - Respects user notification preferences (payment_received_enabled flag)

  3. Notes
    - Works with both printavo_invoices table (invoice_id is text)
    - Handles reversed/failed payments by checking status field
    - Only sends notifications for successful payments (status != 'reversed' and status != 'failed')
*/

-- Create function to notify when payments are received
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_record RECORD;
  v_user_record RECORD;
  v_customer_name text;
  v_invoice_number text;
  v_formatted_amount text;
BEGIN
  -- Only create notifications for successful payments
  IF NEW.status = 'reversed' OR NEW.status = 'failed' THEN
    RETURN NEW;
  END IF;

  -- Get invoice details from printavo_invoices
  SELECT 
    customer_name,
    customer_company,
    invoice_number
  INTO v_invoice_record
  FROM printavo_invoices
  WHERE id = NEW.invoice_id;

  -- Build customer name (prefer company name, fall back to customer name)
  IF v_invoice_record.customer_company IS NOT NULL AND v_invoice_record.customer_company != '' THEN
    v_customer_name := v_invoice_record.customer_company;
  ELSIF v_invoice_record.customer_name IS NOT NULL AND v_invoice_record.customer_name != '' THEN
    v_customer_name := v_invoice_record.customer_name;
  ELSE
    v_customer_name := 'Unknown Customer';
  END IF;

  -- Get invoice number
  v_invoice_number := COALESCE(v_invoice_record.invoice_number, NEW.invoice_id);

  -- Format amount as currency
  v_formatted_amount := '$' || TO_CHAR(ABS(NEW.amount), 'FM999,999,990.00');

  -- Create notification for all users in the company who have this notification type enabled
  FOR v_user_record IN
    SELECT up.id, COALESCE(unp.payment_received_enabled, true) as enabled
    FROM user_profiles up
    LEFT JOIN user_notification_preferences unp ON up.id = unp.user_id
    WHERE up.company_id = NEW.company_id
  LOOP
    IF v_user_record.enabled THEN
      INSERT INTO notifications (
        company_id,
        user_id,
        notification_type,
        title,
        message,
        reference_id,
        reference_type,
        is_read
      ) VALUES (
        NEW.company_id,
        v_user_record.id,
        'payment_received',
        'Payment Received',
        'Payment of ' || v_formatted_amount || ' received from ' || v_customer_name || ' for Invoice #' || v_invoice_number,
        NEW.id,
        'payment',
        false
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS trigger_notify_payment_received ON payments;
CREATE TRIGGER trigger_notify_payment_received
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_received();