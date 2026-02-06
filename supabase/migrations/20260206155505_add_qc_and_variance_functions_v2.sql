/*
  # QC and Variance Management Functions

  1. QC Functions
    - `create_qc_inspection()` - Create QC inspection record
    - `fail_qc_and_revert()` - Fail QC and send back to production

  2. Variance Functions
    - `report_production_variance()` - Report production issue
    - `resolve_production_variance()` - Resolve production issue

  3. Reporting Functions
    - `get_work_order_workflow_status()` - Get complete workflow status
    - `get_stage_performance_stats()` - Get stage performance metrics
*/

-- Function to create QC inspection
CREATE OR REPLACE FUNCTION create_qc_inspection(
  p_work_order_id uuid,
  p_inspector_id uuid,
  p_passed boolean,
  p_items_inspected integer,
  p_items_passed integer,
  p_items_failed integer,
  p_failure_reason text DEFAULT NULL,
  p_variance_notes text DEFAULT NULL,
  p_corrective_action text DEFAULT NULL,
  p_requires_rework boolean DEFAULT false,
  p_rework_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_work_order_number text;
  v_inspector_name text;
  v_inspection_id uuid;
BEGIN
  -- Get work order details
  SELECT company_id, work_order_number
  INTO v_company_id, v_work_order_number
  FROM work_orders
  WHERE id = p_work_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_not_found');
  END IF;

  -- Get inspector name
  SELECT COALESCE(full_name, email) INTO v_inspector_name
  FROM user_profiles
  WHERE id = p_inspector_id;

  -- Create QC inspection record
  INSERT INTO qc_inspections (
    company_id,
    work_order_id,
    work_order_number,
    inspector_id,
    inspector_name,
    passed,
    items_inspected,
    items_passed,
    items_failed,
    failure_reason,
    variance_notes,
    corrective_action,
    requires_rework,
    rework_notes,
    metadata
  ) VALUES (
    v_company_id,
    p_work_order_id,
    v_work_order_number,
    p_inspector_id,
    v_inspector_name,
    p_passed,
    p_items_inspected,
    p_items_passed,
    p_items_failed,
    p_failure_reason,
    p_variance_notes,
    p_corrective_action,
    p_requires_rework,
    p_rework_notes,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_inspection_id;

  -- Update workflow tracking with QC result
  UPDATE work_order_workflow_tracking
  SET
    qc_passed = p_passed,
    updated_at = now()
  WHERE work_order_id = p_work_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'inspection_id', v_inspection_id,
    'passed', p_passed,
    'message', CASE WHEN p_passed THEN 'QC inspection passed' ELSE 'QC inspection failed' END
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to fail QC and revert to production
CREATE OR REPLACE FUNCTION fail_qc_and_revert(
  p_work_order_id uuid,
  p_inspector_id uuid,
  p_items_inspected integer,
  p_items_failed integer,
  p_failure_reason text,
  p_rework_notes text
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_work_order_number text;
  v_inspector_name text;
  v_qc_result jsonb;
BEGIN
  -- Create failed QC inspection
  v_qc_result := create_qc_inspection(
    p_work_order_id,
    p_inspector_id,
    false,
    p_items_inspected,
    p_items_inspected - p_items_failed,
    p_items_failed,
    p_failure_reason,
    NULL,
    NULL,
    true,
    p_rework_notes
  );

  IF NOT (v_qc_result->>'success')::boolean THEN
    RETURN v_qc_result;
  END IF;

  -- Get work order details
  SELECT wo.company_id, wo.work_order_number
  INTO v_company_id, v_work_order_number
  FROM work_orders wo
  WHERE wo.id = p_work_order_id;

  -- Get inspector name
  SELECT COALESCE(full_name, email) INTO v_inspector_name
  FROM user_profiles
  WHERE id = p_inspector_id;

  -- Revert to production stage
  UPDATE work_order_workflow_tracking
  SET
    current_stage_key = 'production',
    previous_stage_key = 'qc',
    current_stage_started_at = now(),
    production_started_at = now(),
    qc_passed = false,
    updated_at = now()
  WHERE work_order_id = p_work_order_id;

  -- Log transition
  INSERT INTO workflow_transition_log (
    company_id,
    work_order_id,
    work_order_number,
    from_stage,
    to_stage,
    transition_type,
    performed_by,
    performed_by_name,
    notes,
    metadata
  ) VALUES (
    v_company_id,
    p_work_order_id,
    v_work_order_number,
    'qc',
    'production',
    'revert',
    p_inspector_id,
    v_inspector_name,
    format('QC Failed: %s. Requires rework.', p_failure_reason),
    jsonb_build_object(
      'items_failed', p_items_failed,
      'failure_reason', p_failure_reason,
      'rework_notes', p_rework_notes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'inspection_id', v_qc_result->>'inspection_id',
    'reverted_to', 'production',
    'message', 'QC failed, work order reverted to production for rework'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to report production variance
CREATE OR REPLACE FUNCTION report_production_variance(
  p_work_order_id uuid,
  p_stage_key text,
  p_variance_type text,
  p_severity text,
  p_description text,
  p_reported_by uuid,
  p_quantity_affected integer DEFAULT 0,
  p_metadata jsonb DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_work_order_number text;
  v_reported_by_name text;
  v_variance_id uuid;
BEGIN
  -- Get work order details
  SELECT company_id, work_order_number
  INTO v_company_id, v_work_order_number
  FROM work_orders
  WHERE id = p_work_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_not_found');
  END IF;

  -- Get reporter name
  SELECT COALESCE(full_name, email) INTO v_reported_by_name
  FROM user_profiles
  WHERE id = p_reported_by;

  -- Create variance record
  INSERT INTO production_variances (
    company_id,
    work_order_id,
    work_order_number,
    stage_key,
    variance_type,
    severity,
    description,
    quantity_affected,
    reported_by,
    reported_by_name,
    metadata
  ) VALUES (
    v_company_id,
    p_work_order_id,
    v_work_order_number,
    p_stage_key,
    p_variance_type,
    p_severity,
    p_description,
    p_quantity_affected,
    p_reported_by,
    v_reported_by_name,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_variance_id;

  RETURN jsonb_build_object(
    'success', true,
    'variance_id', v_variance_id,
    'severity', p_severity,
    'message', 'Production variance reported'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resolve production variance
CREATE OR REPLACE FUNCTION resolve_production_variance(
  p_variance_id uuid,
  p_resolved_by uuid,
  p_resolution_notes text,
  p_resolution_status text DEFAULT 'resolved'
) RETURNS jsonb AS $$
BEGIN
  -- Update variance
  UPDATE production_variances
  SET
    resolution_status = p_resolution_status,
    resolution_notes = p_resolution_notes,
    resolved_by = p_resolved_by,
    resolved_at = now(),
    updated_at = now()
  WHERE id = p_variance_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'variance_not_found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Production variance resolved'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'processing_failed',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get complete workflow status
CREATE OR REPLACE FUNCTION get_work_order_workflow_status(p_work_order_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'work_order', jsonb_build_object(
      'id', wo.id,
      'work_order_number', wo.work_order_number,
      'customer_name', wo.customer_name,
      'status', wo.status,
      'priority', wo.priority,
      'production_due_date', wo.production_due_date,
      'customer_due_date', wo.customer_due_date,
      'total_quantity', wo.total_quantity
    ),
    'workflow', jsonb_build_object(
      'current_stage', wt.current_stage_key,
      'current_stage_started_at', wt.current_stage_started_at,
      'is_on_hold', wt.is_on_hold,
      'hold_reason', wt.hold_reason,
      'pre_press', jsonb_build_object(
        'started_at', wt.pre_press_started_at,
        'completed_at', wt.pre_press_completed_at,
        'duration_minutes', wt.pre_press_duration_minutes,
        'completed_by', wt.pre_press_completed_by
      ),
      'production', jsonb_build_object(
        'started_at', wt.production_started_at,
        'completed_at', wt.production_completed_at,
        'duration_minutes', wt.production_duration_minutes,
        'completed_by', wt.production_completed_by,
        'production_type', wt.production_type
      ),
      'finishing', jsonb_build_object(
        'started_at', wt.finishing_started_at,
        'completed_at', wt.finishing_completed_at,
        'duration_minutes', wt.finishing_duration_minutes,
        'completed_by', wt.finishing_completed_by
      ),
      'qc', jsonb_build_object(
        'started_at', wt.qc_started_at,
        'completed_at', wt.qc_completed_at,
        'duration_minutes', wt.qc_duration_minutes,
        'completed_by', wt.qc_completed_by,
        'passed', wt.qc_passed
      ),
      'completed', jsonb_build_object(
        'completed_at', wt.completed_at,
        'completed_by', wt.completed_by,
        'total_duration_minutes', wt.total_duration_minutes
      )
    ),
    'transitions', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', wtl.id,
          'from_stage', wtl.from_stage,
          'to_stage', wtl.to_stage,
          'transition_type', wtl.transition_type,
          'performed_by_name', wtl.performed_by_name,
          'notes', wtl.notes,
          'created_at', wtl.created_at
        ) ORDER BY wtl.created_at DESC
      )
      FROM workflow_transition_log wtl
      WHERE wtl.work_order_id = p_work_order_id
    ),
    'qc_inspections', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', qc.id,
          'inspector_name', qc.inspector_name,
          'inspection_date', qc.inspection_date,
          'passed', qc.passed,
          'items_inspected', qc.items_inspected,
          'items_passed', qc.items_passed,
          'items_failed', qc.items_failed,
          'failure_reason', qc.failure_reason,
          'requires_rework', qc.requires_rework
        ) ORDER BY qc.inspection_date DESC
      )
      FROM qc_inspections qc
      WHERE qc.work_order_id = p_work_order_id
    ),
    'variances', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pv.id,
          'stage_key', pv.stage_key,
          'variance_type', pv.variance_type,
          'severity', pv.severity,
          'description', pv.description,
          'quantity_affected', pv.quantity_affected,
          'reported_by_name', pv.reported_by_name,
          'reported_at', pv.reported_at,
          'resolution_status', pv.resolution_status,
          'resolution_notes', pv.resolution_notes,
          'resolved_at', pv.resolved_at
        ) ORDER BY pv.created_at DESC
      )
      FROM production_variances pv
      WHERE pv.work_order_id = p_work_order_id
    )
  ) INTO v_result
  FROM work_orders wo
  JOIN work_order_workflow_tracking wt ON wo.id = wt.work_order_id
  WHERE wo.id = p_work_order_id;

  RETURN COALESCE(v_result, jsonb_build_object('success', false, 'error', 'work_order_not_found'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get stage performance stats
CREATE OR REPLACE FUNCTION get_stage_performance_stats(
  p_company_id uuid DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_start_date timestamptz;
  v_end_date timestamptz;
BEGIN
  v_company_id := COALESCE(p_company_id, get_user_company_id());
  v_start_date := COALESCE(p_start_date, now() - interval '30 days');
  v_end_date := COALESCE(p_end_date, now());

  RETURN jsonb_build_object(
    'pre_press', (
      SELECT jsonb_build_object(
        'completed_count', COUNT(*),
        'avg_duration_minutes', AVG(pre_press_duration_minutes),
        'min_duration_minutes', MIN(pre_press_duration_minutes),
        'max_duration_minutes', MAX(pre_press_duration_minutes)
      )
      FROM work_order_workflow_tracking
      WHERE company_id = v_company_id
        AND pre_press_completed_at BETWEEN v_start_date AND v_end_date
    ),
    'production', (
      SELECT jsonb_build_object(
        'completed_count', COUNT(*),
        'avg_duration_minutes', AVG(production_duration_minutes),
        'min_duration_minutes', MIN(production_duration_minutes),
        'max_duration_minutes', MAX(production_duration_minutes)
      )
      FROM work_order_workflow_tracking
      WHERE company_id = v_company_id
        AND production_completed_at BETWEEN v_start_date AND v_end_date
    ),
    'finishing', (
      SELECT jsonb_build_object(
        'completed_count', COUNT(*),
        'avg_duration_minutes', AVG(finishing_duration_minutes),
        'min_duration_minutes', MIN(finishing_duration_minutes),
        'max_duration_minutes', MAX(finishing_duration_minutes)
      )
      FROM work_order_workflow_tracking
      WHERE company_id = v_company_id
        AND finishing_completed_at BETWEEN v_start_date AND v_end_date
    ),
    'qc', (
      SELECT jsonb_build_object(
        'completed_count', COUNT(*),
        'avg_duration_minutes', AVG(qc_duration_minutes),
        'min_duration_minutes', MIN(qc_duration_minutes),
        'max_duration_minutes', MAX(qc_duration_minutes),
        'pass_rate', (SUM(CASE WHEN qc_passed THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0)) * 100
      )
      FROM work_order_workflow_tracking
      WHERE company_id = v_company_id
        AND qc_completed_at BETWEEN v_start_date AND v_end_date
    ),
    'overall', (
      SELECT jsonb_build_object(
        'completed_work_orders', COUNT(*),
        'avg_total_duration_minutes', AVG(total_duration_minutes),
        'min_total_duration_minutes', MIN(total_duration_minutes),
        'max_total_duration_minutes', MAX(total_duration_minutes)
      )
      FROM work_order_workflow_tracking
      WHERE company_id = v_company_id
        AND completed_at BETWEEN v_start_date AND v_end_date
    ),
    'variances', (
      SELECT jsonb_build_object(
        'total_count', COUNT(*),
        'open_count', SUM(CASE WHEN resolution_status = 'open' THEN 1 ELSE 0 END),
        'by_severity', jsonb_object_agg(severity, severity_count)
      )
      FROM (
        SELECT
          severity,
          COUNT(*) as severity_count
        FROM production_variances
        WHERE company_id = v_company_id
          AND reported_at BETWEEN v_start_date AND v_end_date
        GROUP BY severity
      ) severity_counts
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_qc_inspection TO authenticated;
GRANT EXECUTE ON FUNCTION fail_qc_and_revert TO authenticated;
GRANT EXECUTE ON FUNCTION report_production_variance TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_production_variance TO authenticated;
GRANT EXECUTE ON FUNCTION get_work_order_workflow_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_stage_performance_stats TO authenticated;

COMMENT ON FUNCTION create_qc_inspection IS 'Create QC inspection record with pass/fail result';
COMMENT ON FUNCTION fail_qc_and_revert IS 'Fail QC inspection and revert work order to production for rework';
COMMENT ON FUNCTION report_production_variance IS 'Report production issue or variance';
COMMENT ON FUNCTION resolve_production_variance IS 'Resolve production variance with notes';
COMMENT ON FUNCTION get_work_order_workflow_status IS 'Get complete workflow status including transitions, QC, and variances';
COMMENT ON FUNCTION get_stage_performance_stats IS 'Get performance statistics for all production stages';
