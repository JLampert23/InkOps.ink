/*
  # Add QR Code Setting for Box Labels

  1. New Column
    - `box_label_show_qr_code` (boolean) - Show QR code on label, default true

  2. Notes
    - Enables/disables QR code display on printed box labels
    - QR code will link to the work order for quick reference
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_settings' AND column_name = 'box_label_show_qr_code'
  ) THEN
    ALTER TABLE company_settings ADD COLUMN box_label_show_qr_code boolean DEFAULT true;
  END IF;
END $$;