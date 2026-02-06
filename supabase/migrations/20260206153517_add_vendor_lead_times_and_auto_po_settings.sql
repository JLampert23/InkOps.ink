/*
  # Add Vendor Lead Times and Auto-PO Creation Settings

  1. New Columns for vendors table
    - `default_lead_time_days` (integer) - Days from order to delivery
    - `minimum_order_quantity` (integer) - Minimum units per order
    - `minimum_order_value` (numeric) - Minimum dollar amount per order
    - `preferred_vendor` (boolean) - Mark as preferred for auto-PO
    - `auto_po_enabled` (boolean) - Enable automatic PO creation for this vendor

  2. New Columns for company_settings
    - `po_auto_create_enabled` (boolean) - Enable automatic PO creation
    - `po_auto_create_threshold_days` (integer) - Days before due date to create PO
    - `po_auto_create_notify_users` (uuid[]) - Users to notify when PO created
    - `po_auto_create_notify_enabled` (boolean) - Enable notifications

  3. Purpose
    - Track vendor delivery lead times
    - Enable automatic PO creation from garment requirements
    - Calculate expected delivery dates
    - Notify purchasing team of new draft POs
*/

-- Add columns to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS default_lead_time_days integer DEFAULT 7,
ADD COLUMN IF NOT EXISTS minimum_order_quantity integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS minimum_order_value numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preferred_vendor boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_po_enabled boolean DEFAULT true;

-- Add indexes for vendor queries
CREATE INDEX IF NOT EXISTS idx_vendors_preferred ON vendors(company_id, preferred_vendor) WHERE preferred_vendor = true;
CREATE INDEX IF NOT EXISTS idx_vendors_auto_po_enabled ON vendors(company_id, auto_po_enabled) WHERE auto_po_enabled = true;

-- Add columns to company_settings for auto-PO
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS po_auto_create_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS po_auto_create_threshold_days integer DEFAULT 14,
ADD COLUMN IF NOT EXISTS po_auto_create_notify_users uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS po_auto_create_notify_enabled boolean DEFAULT true;

-- Function to get or create vendor by supplier info
CREATE OR REPLACE FUNCTION get_or_create_vendor(
  p_company_id uuid,
  p_supplier_type text,
  p_supplier_name text
) RETURNS uuid AS $$
DECLARE
  v_vendor_id uuid;
  v_vendor_type text;
BEGIN
  -- Normalize supplier type
  v_vendor_type := LOWER(p_supplier_type);
  
  -- Try to find existing vendor
  SELECT id INTO v_vendor_id
  FROM vendors
  WHERE company_id = p_company_id
    AND LOWER(vendor_type) = v_vendor_type
    AND LOWER(vendor_name) = LOWER(COALESCE(p_supplier_name, v_vendor_type))
  LIMIT 1;
  
  -- If not found, create new vendor
  IF v_vendor_id IS NULL THEN
    INSERT INTO vendors (
      company_id,
      vendor_name,
      vendor_type,
      is_active,
      auto_po_enabled,
      default_lead_time_days,
      preferred_vendor
    ) VALUES (
      p_company_id,
      COALESCE(p_supplier_name, INITCAP(v_vendor_type)),
      v_vendor_type,
      true,
      true,
      CASE 
        WHEN v_vendor_type IN ('sanmar', 'ssactivewear') THEN 3
        ELSE 7
      END,
      v_vendor_type IN ('sanmar', 'ssactivewear')
    )
    RETURNING id INTO v_vendor_id;
  END IF;
  
  RETURN v_vendor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate expected delivery date
CREATE OR REPLACE FUNCTION calculate_expected_delivery_date(
  p_vendor_id uuid,
  p_processing_days integer DEFAULT 2
) RETURNS date AS $$
DECLARE
  v_lead_time_days integer;
  v_total_days integer;
BEGIN
  -- Get vendor lead time
  SELECT default_lead_time_days INTO v_lead_time_days
  FROM vendors
  WHERE id = p_vendor_id;
  
  -- Default to 7 days if not found
  v_lead_time_days := COALESCE(v_lead_time_days, 7);
  
  -- Add processing days (time to prepare PO and send)
  v_total_days := v_lead_time_days + COALESCE(p_processing_days, 2);
  
  -- Calculate delivery date (skip weekends)
  RETURN calculate_business_days(CURRENT_DATE, v_total_days);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate business days (skip weekends)
CREATE OR REPLACE FUNCTION calculate_business_days(
  p_start_date date,
  p_days_to_add integer
) RETURNS date AS $$
DECLARE
  v_current_date date;
  v_days_added integer := 0;
  v_day_of_week integer;
BEGIN
  v_current_date := p_start_date;
  
  WHILE v_days_added < p_days_to_add LOOP
    v_current_date := v_current_date + 1;
    v_day_of_week := EXTRACT(DOW FROM v_current_date);
    
    -- Skip weekends (0 = Sunday, 6 = Saturday)
    IF v_day_of_week NOT IN (0, 6) THEN
      v_days_added := v_days_added + 1;
    END IF;
  END LOOP;
  
  RETURN v_current_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON COLUMN vendors.default_lead_time_days IS 'Standard delivery time in business days from order placement';
COMMENT ON COLUMN vendors.minimum_order_quantity IS 'Minimum number of units required per order';
COMMENT ON COLUMN vendors.minimum_order_value IS 'Minimum dollar amount required per order';
COMMENT ON COLUMN vendors.preferred_vendor IS 'Preferred vendor for auto-PO creation when multiple vendors available';
COMMENT ON COLUMN vendors.auto_po_enabled IS 'Allow automatic PO creation for this vendor';

COMMENT ON COLUMN company_settings.po_auto_create_enabled IS 'Enable automatic PO creation from garment requirements';
COMMENT ON COLUMN company_settings.po_auto_create_threshold_days IS 'Days before production due date to trigger auto-PO creation';
COMMENT ON COLUMN company_settings.po_auto_create_notify_users IS 'User IDs to notify when auto-PO is created';
COMMENT ON COLUMN company_settings.po_auto_create_notify_enabled IS 'Send notifications when auto-POs are created';

COMMENT ON FUNCTION get_or_create_vendor IS 'Find existing vendor or create new one based on supplier type and name';
COMMENT ON FUNCTION calculate_expected_delivery_date IS 'Calculate expected delivery date based on vendor lead time and processing days';
COMMENT ON FUNCTION calculate_business_days IS 'Add business days to a date, skipping weekends';
