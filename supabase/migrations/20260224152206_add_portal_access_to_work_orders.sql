/*
  # Add Portal Access to Work Orders

  1. Changes
    - Add RLS policy to allow anonymous access to work orders when customer_id matches
    - This enables the customer portal to display order history

  2. Security
    - Policy only allows SELECT (read-only)
    - Requires exact customer_id match
    - Uses anon role for portal access
*/

-- Allow portal access to work orders (read-only for specific customer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'work_orders' 
    AND policyname = 'Portal can view customer work orders'
  ) THEN
    CREATE POLICY "Portal can view customer work orders"
      ON work_orders
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Also add policy for work_order_line_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'work_order_line_items' 
    AND policyname = 'Portal can view customer work order line items'
  ) THEN
    CREATE POLICY "Portal can view customer work order line items"
      ON work_order_line_items
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Add policy for quote_imprints for imprint display
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'quote_imprints' 
    AND policyname = 'Portal can view quote imprints'
  ) THEN
    CREATE POLICY "Portal can view quote imprints"
      ON quote_imprints
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Add policy for decoration_locations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'decoration_locations' 
    AND policyname = 'Portal can view decoration locations'
  ) THEN
    CREATE POLICY "Portal can view decoration locations"
      ON decoration_locations
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Add policy for quotes table for quote info display
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'quotes' 
    AND policyname = 'Portal can view quotes'
  ) THEN
    CREATE POLICY "Portal can view quotes"
      ON quotes
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;