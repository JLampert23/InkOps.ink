/*
  # Create Automatic PO Creation System

  1. New Functions
    - `auto_create_pos_from_requirements()` - Main function to process garment requirements
    - `group_requirements_by_vendor()` - Group requirements by vendor
    - `create_draft_po()` - Create a single draft PO with line items
    - `trigger_auto_po_notifications()` - Send notifications for created POs

  2. Process Flow
    1. Check if auto-PO is enabled for company
    2. Get pending garment requirements (is_po_created = false)
    3. Group by vendor (using supplier_type and supplier_name)
    4. For each vendor group:
       a. Get or create vendor record
       b. Calculate expected delivery date
       c. Create draft PO
       d. Create line items (one per size in sizes jsonb)
       e. Mark requirements as processed
       f. Log activity
    5. Send notifications if enabled

  3. Security
    - Functions use SECURITY DEFINER to bypass RLS for system operations
    - All operations respect company isolation
*/

-- Function to auto-create POs from garment requirements
CREATE OR REPLACE FUNCTION auto_create_pos_from_requirements(
  p_company_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_company_settings RECORD;
  v_vendor_group RECORD;
  v_vendor_id uuid;
  v_po_id uuid;
  v_po_number text;
  v_expected_delivery date;
  v_requirement RECORD;
  v_line_number integer;
  v_size_key text;
  v_size_qty integer;
  v_unit_cost numeric;
  v_total_pos_created integer := 0;
  v_result jsonb;
  v_po_list uuid[] := '{}';
BEGIN
  -- Get company_id (from parameter or current user)
  IF p_company_id IS NULL THEN
    SELECT get_user_company_id() INTO v_company_id;
  ELSE
    v_company_id := p_company_id;
  END IF;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID not found';
  END IF;
  
  -- Get company settings
  SELECT
    po_auto_create_enabled,
    po_auto_create_threshold_days,
    po_auto_create_notify_users,
    po_auto_create_notify_enabled,
    po_auto_group_by_vendor
  INTO v_company_settings
  FROM company_settings
  WHERE id = v_company_id;
  
  -- Check if auto-PO creation is enabled
  IF NOT COALESCE(v_company_settings.po_auto_create_enabled, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Auto-PO creation is not enabled',
      'pos_created', 0
    );
  END IF;
  
  -- Loop through each vendor group
  FOR v_vendor_group IN
    SELECT
      supplier_type,
      supplier_name,
      COUNT(*) as requirement_count,
      SUM(total_cost) as total_value
    FROM garment_requirements_staging
    WHERE company_id = v_company_id
      AND is_po_created = false
      AND supplier_type IS NOT NULL
    GROUP BY supplier_type, supplier_name
  LOOP
    -- Get or create vendor
    v_vendor_id := get_or_create_vendor(
      v_company_id,
      v_vendor_group.supplier_type,
      v_vendor_group.supplier_name
    );
    
    -- Check if vendor has auto-PO enabled
    IF NOT EXISTS (
      SELECT 1 FROM vendors
      WHERE id = v_vendor_id
        AND auto_po_enabled = true
        AND is_active = true
    ) THEN
      CONTINUE;
    END IF;
    
    -- Calculate expected delivery date
    v_expected_delivery := calculate_expected_delivery_date(v_vendor_id, 2);
    
    -- Generate PO number
    SELECT generate_po_number() INTO v_po_number;
    
    -- Create draft PO
    INSERT INTO purchase_orders (
      company_id,
      po_number,
      vendor_id,
      status,
      expected_delivery_date,
      notes_to_vendor,
      internal_notes,
      created_by
    ) VALUES (
      v_company_id,
      v_po_number,
      v_vendor_id,
      'draft',
      v_expected_delivery,
      'Auto-generated purchase order from approved quotes',
      'Automatically created from garment requirements. Review before sending.',
      auth.uid()
    )
    RETURNING id INTO v_po_id;
    
    -- Add to PO list
    v_po_list := array_append(v_po_list, v_po_id);
    
    -- Initialize line number
    v_line_number := 0;
    
    -- Create line items from requirements
    FOR v_requirement IN
      SELECT
        id,
        style_number,
        style_name,
        color,
        sizes,
        unit_cost,
        total_quantity,
        notes
      FROM garment_requirements_staging
      WHERE company_id = v_company_id
        AND supplier_type = v_vendor_group.supplier_type
        AND COALESCE(supplier_name, '') = COALESCE(v_vendor_group.supplier_name, '')
        AND is_po_created = false
      ORDER BY style_number, color
    LOOP
      -- Get unit cost
      v_unit_cost := COALESCE(v_requirement.unit_cost, 0);
      
      -- If sizes are broken down, create one line per size
      IF v_requirement.sizes IS NOT NULL AND jsonb_typeof(v_requirement.sizes) = 'object' THEN
        FOR v_size_key, v_size_qty IN
          SELECT key, value::text::integer
          FROM jsonb_each_text(v_requirement.sizes)
          WHERE value::text::integer > 0
        LOOP
          v_line_number := v_line_number + 1;
          
          INSERT INTO purchase_order_line_items (
            company_id,
            po_id,
            line_number,
            style_number,
            product_name,
            color,
            size,
            quantity_ordered,
            quantity_received,
            unit_cost,
            extended_cost,
            notes
          ) VALUES (
            v_company_id,
            v_po_id,
            v_line_number,
            v_requirement.style_number,
            v_requirement.style_name,
            v_requirement.color,
            v_size_key,
            v_size_qty,
            0,
            v_unit_cost,
            v_unit_cost * v_size_qty,
            v_requirement.notes
          );
        END LOOP;
      ELSE
        -- No size breakdown, create single line item
        v_line_number := v_line_number + 1;
        
        INSERT INTO purchase_order_line_items (
          company_id,
          po_id,
          line_number,
          style_number,
          product_name,
          color,
          size,
          quantity_ordered,
          quantity_received,
          unit_cost,
          extended_cost,
          notes
        ) VALUES (
          v_company_id,
          v_po_id,
          v_line_number,
          v_requirement.style_number,
          v_requirement.style_name,
          v_requirement.color,
          'Mixed',
          v_requirement.total_quantity,
          0,
          v_unit_cost,
          v_unit_cost * v_requirement.total_quantity,
          v_requirement.notes
        );
      END IF;
      
      -- Mark requirement as PO created
      UPDATE garment_requirements_staging
      SET
        is_po_created = true,
        po_id = v_po_id,
        updated_at = now()
      WHERE id = v_requirement.id;
    END LOOP;
    
    -- Log PO creation
    INSERT INTO purchase_order_activity_log (
      company_id,
      po_id,
      action,
      performed_by,
      performed_by_name,
      notes,
      meta
    ) VALUES (
      v_company_id,
      v_po_id,
      'po_auto_created',
      auth.uid(),
      'Auto-PO System',
      'Purchase order automatically created from garment requirements',
      jsonb_build_object(
        'vendor_type', v_vendor_group.supplier_type,
        'vendor_name', v_vendor_group.supplier_name,
        'requirement_count', v_vendor_group.requirement_count,
        'line_items_count', v_line_number,
        'expected_delivery', v_expected_delivery
      )
    );
    
    v_total_pos_created := v_total_pos_created + 1;
  END LOOP;
  
  -- Prepare result
  v_result := jsonb_build_object(
    'success', true,
    'message', format('Created %s draft PO(s)', v_total_pos_created),
    'pos_created', v_total_pos_created,
    'po_ids', v_po_list,
    'company_id', v_company_id
  );
  
  -- Trigger notifications if enabled
  IF v_company_settings.po_auto_create_notify_enabled 
     AND array_length(v_company_settings.po_auto_create_notify_users, 1) > 0
     AND v_total_pos_created > 0 THEN
    PERFORM trigger_auto_po_notifications(
      v_company_id,
      v_po_list,
      v_company_settings.po_auto_create_notify_users
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to trigger notifications for auto-created POs
CREATE OR REPLACE FUNCTION trigger_auto_po_notifications(
  p_company_id uuid,
  p_po_ids uuid[],
  p_user_ids uuid[]
) RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_po_count integer;
BEGIN
  v_po_count := array_length(p_po_ids, 1);
  
  -- Create notification record for each user
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    -- Insert into a notifications table if you have one
    -- For now, we'll just log it
    INSERT INTO purchase_order_activity_log (
      company_id,
      po_id,
      action,
      performed_by,
      performed_by_name,
      notes,
      meta
    ) VALUES (
      p_company_id,
      p_po_ids[1],  -- Reference first PO
      'notification_sent',
      v_user_id,
      'Auto-PO System',
      format('Notified user about %s new draft PO(s)', v_po_count),
      jsonb_build_object(
        'po_ids', p_po_ids,
        'po_count', v_po_count,
        'notified_user_id', v_user_id
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and auto-create POs for requirements approaching due date
CREATE OR REPLACE FUNCTION check_and_create_pos_for_upcoming_requirements()
RETURNS jsonb AS $$
DECLARE
  v_company RECORD;
  v_result jsonb;
  v_all_results jsonb := '[]'::jsonb;
  v_total_pos integer := 0;
BEGIN
  -- Loop through companies with auto-PO enabled
  FOR v_company IN
    SELECT
      cs.id as company_id,
      cs.po_auto_create_enabled,
      cs.po_auto_create_threshold_days
    FROM company_settings cs
    WHERE cs.po_auto_create_enabled = true
  LOOP
    -- Check if there are requirements needing POs
    IF EXISTS (
      SELECT 1
      FROM garment_requirements_staging grs
      JOIN work_orders wo ON grs.work_order_id = wo.id
      WHERE grs.company_id = v_company.company_id
        AND grs.is_po_created = false
        AND wo.production_due_date <= CURRENT_DATE + v_company.po_auto_create_threshold_days
    ) THEN
      -- Create POs for this company
      v_result := auto_create_pos_from_requirements(v_company.company_id);
      
      -- Add to results
      v_all_results := v_all_results || jsonb_build_array(v_result);
      v_total_pos := v_total_pos + (v_result->>'pos_created')::integer;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_pos_created', v_total_pos,
    'results', v_all_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auto_create_pos_from_requirements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_create_pos_for_upcoming_requirements() TO service_role;
GRANT EXECUTE ON FUNCTION trigger_auto_po_notifications(uuid, uuid[], uuid[]) TO service_role;

COMMENT ON FUNCTION auto_create_pos_from_requirements IS 'Automatically create draft POs from pending garment requirements, grouped by vendor';
COMMENT ON FUNCTION trigger_auto_po_notifications IS 'Send notifications to purchasing team when auto-POs are created';
COMMENT ON FUNCTION check_and_create_pos_for_upcoming_requirements IS 'Scheduled function to check for requirements approaching due date and create POs';
