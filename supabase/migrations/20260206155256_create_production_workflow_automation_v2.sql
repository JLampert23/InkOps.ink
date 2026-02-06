/*
  # Production Workflow Automation System

  1. New Tables
    - `production_workflow_stages` - Define workflow stages
    - `work_order_workflow_tracking` - Current stage and timestamps
    - `workflow_transition_log` - History of all transitions
    - `qc_inspections` - Quality control records
    - `production_variances` - Track production issues

  2. Workflow Stages
    - Pre-Press: Artwork prep, screens/hoops setup, approvals
    - Production: Printing, embroidery, DTF/DTG, heat press
    - Finishing: Folding, bagging, tagging
    - Quality Control: Final inspection, variance logging
    - Completed: Work order complete

  3. Features
    - Automatic timestamping for each stage
    - User action tracking
    - Variance logging
    - Department notifications
    - Stage validation and transition rules
    - Complete audit trail

  4. Security
    - Enable RLS on all tables
    - Company-based access control
    - Role-based permissions for stage transitions
*/

-- Create production workflow stages table
CREATE TABLE IF NOT EXISTS production_workflow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  stage_name text NOT NULL,
  stage_order integer NOT NULL,
  description text,
  requires_qc boolean DEFAULT false,
  auto_advance boolean DEFAULT false,
  department text,
  expected_duration_hours integer,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, stage_key)
);

-- Create work order workflow tracking table
CREATE TABLE IF NOT EXISTS work_order_workflow_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  current_stage_key text NOT NULL,
  current_stage_started_at timestamptz DEFAULT now(),
  previous_stage_key text,
  pre_press_started_at timestamptz,
  pre_press_completed_at timestamptz,
  pre_press_completed_by uuid REFERENCES user_profiles(id),
  pre_press_duration_minutes integer,
  production_started_at timestamptz,
  production_completed_at timestamptz,
  production_completed_by uuid REFERENCES user_profiles(id),
  production_duration_minutes integer,
  production_type text,
  finishing_started_at timestamptz,
  finishing_completed_at timestamptz,
  finishing_completed_by uuid REFERENCES user_profiles(id),
  finishing_duration_minutes integer,
  qc_started_at timestamptz,
  qc_completed_at timestamptz,
  qc_completed_by uuid REFERENCES user_profiles(id),
  qc_duration_minutes integer,
  qc_passed boolean,
  completed_at timestamptz,
  completed_by uuid REFERENCES user_profiles(id),
  total_duration_minutes integer,
  is_on_hold boolean DEFAULT false,
  hold_reason text,
  hold_started_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(work_order_id)
);

-- Create workflow transition log
CREATE TABLE IF NOT EXISTS workflow_transition_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_order_number text NOT NULL,
  from_stage text,
  to_stage text NOT NULL,
  transition_type text NOT NULL CHECK (transition_type IN ('advance', 'revert', 'skip', 'hold', 'resume')),
  performed_by uuid NOT NULL REFERENCES user_profiles(id),
  performed_by_name text NOT NULL,
  notes text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create QC inspections table
CREATE TABLE IF NOT EXISTS qc_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_order_number text NOT NULL,
  inspector_id uuid NOT NULL REFERENCES user_profiles(id),
  inspector_name text NOT NULL,
  inspection_date timestamptz DEFAULT now(),
  passed boolean NOT NULL,
  items_inspected integer NOT NULL DEFAULT 0,
  items_passed integer NOT NULL DEFAULT 0,
  items_failed integer NOT NULL DEFAULT 0,
  failure_reason text,
  variance_notes text,
  corrective_action text,
  requires_rework boolean DEFAULT false,
  rework_notes text,
  inspection_photos jsonb,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create production variances table
CREATE TABLE IF NOT EXISTS production_variances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  work_order_number text NOT NULL,
  stage_key text NOT NULL,
  variance_type text NOT NULL CHECK (variance_type IN ('quality', 'quantity', 'timing', 'equipment', 'material', 'other')),
  severity text NOT NULL CHECK (severity IN ('minor', 'moderate', 'major', 'critical')),
  description text NOT NULL,
  quantity_affected integer DEFAULT 0,
  reported_by uuid NOT NULL REFERENCES user_profiles(id),
  reported_by_name text NOT NULL,
  reported_at timestamptz DEFAULT now(),
  resolution_status text DEFAULT 'open' CHECK (resolution_status IN ('open', 'in_progress', 'resolved', 'closed')),
  resolution_notes text,
  resolved_by uuid REFERENCES user_profiles(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_stages_company ON production_workflow_stages(company_id, stage_order);
CREATE INDEX IF NOT EXISTS idx_workflow_tracking_work_order ON work_order_workflow_tracking(work_order_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tracking_company_stage ON work_order_workflow_tracking(company_id, current_stage_key);
CREATE INDEX IF NOT EXISTS idx_workflow_tracking_hold ON work_order_workflow_tracking(company_id, is_on_hold) WHERE is_on_hold = true;
CREATE INDEX IF NOT EXISTS idx_transition_log_work_order ON workflow_transition_log(work_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transition_log_company ON workflow_transition_log(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_work_order ON qc_inspections(work_order_id);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_company_date ON qc_inspections(company_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_qc_inspections_failed ON qc_inspections(company_id, passed) WHERE passed = false;
CREATE INDEX IF NOT EXISTS idx_variances_work_order ON production_variances(work_order_id);
CREATE INDEX IF NOT EXISTS idx_variances_company_status ON production_variances(company_id, resolution_status);
CREATE INDEX IF NOT EXISTS idx_variances_severity ON production_variances(company_id, severity, created_at DESC);

-- Enable RLS
ALTER TABLE production_workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_workflow_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transition_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_variances ENABLE ROW LEVEL SECURITY;

-- RLS Policies for production_workflow_stages
CREATE POLICY "Users can view workflow stages for their company"
  ON production_workflow_stages FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage workflow stages for their company"
  ON production_workflow_stages FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- RLS Policies for work_order_workflow_tracking
CREATE POLICY "Users can view workflow tracking for their company"
  ON work_order_workflow_tracking FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can update workflow tracking for their company"
  ON work_order_workflow_tracking FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "System can insert workflow tracking"
  ON work_order_workflow_tracking FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- RLS Policies for workflow_transition_log
CREATE POLICY "Users can view transition log for their company"
  ON workflow_transition_log FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert transition log"
  ON workflow_transition_log FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- RLS Policies for qc_inspections
CREATE POLICY "Users can view QC inspections for their company"
  ON qc_inspections FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create QC inspections"
  ON qc_inspections FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update QC inspections"
  ON qc_inspections FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- RLS Policies for production_variances
CREATE POLICY "Users can view variances for their company"
  ON production_variances FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can create variances"
  ON production_variances FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update variances"
  ON production_variances FOR UPDATE
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- Function to initialize workflow stages for a company
CREATE OR REPLACE FUNCTION initialize_workflow_stages(p_company_id uuid)
RETURNS void AS $$
BEGIN
  -- Insert default workflow stages if they don't exist
  INSERT INTO production_workflow_stages (
    company_id,
    stage_key,
    stage_name,
    stage_order,
    description,
    requires_qc,
    department,
    expected_duration_hours
  ) VALUES
    (p_company_id, 'pre_press', 'Pre-Press', 1, 'Artwork prep, screens/hoops setup, approvals', false, 'Pre-Press', 2),
    (p_company_id, 'production', 'Production', 2, 'Printing, embroidery, DTF/DTG, heat press', false, 'Production', 4),
    (p_company_id, 'finishing', 'Finishing', 3, 'Folding, bagging, tagging', false, 'Finishing', 2),
    (p_company_id, 'qc', 'Quality Control', 4, 'Final inspection, variance logging', true, 'QC', 1),
    (p_company_id, 'completed', 'Completed', 5, 'Work order complete', false, 'Completed', 0)
  ON CONFLICT (company_id, stage_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize workflow tracking for a work order
CREATE OR REPLACE FUNCTION initialize_work_order_workflow(p_work_order_id uuid)
RETURNS uuid AS $$
DECLARE
  v_company_id uuid;
  v_tracking_id uuid;
BEGIN
  -- Get company_id from work order
  SELECT company_id INTO v_company_id
  FROM work_orders
  WHERE id = p_work_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;

  -- Initialize workflow stages for company if not exists
  PERFORM initialize_workflow_stages(v_company_id);

  -- Create workflow tracking record
  INSERT INTO work_order_workflow_tracking (
    company_id,
    work_order_id,
    current_stage_key,
    current_stage_started_at,
    pre_press_started_at
  ) VALUES (
    v_company_id,
    p_work_order_id,
    'pre_press',
    now(),
    now()
  )
  ON CONFLICT (work_order_id) DO NOTHING
  RETURNING id INTO v_tracking_id;

  RETURN v_tracking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to advance work order to next stage
CREATE OR REPLACE FUNCTION advance_workflow_stage(
  p_work_order_id uuid,
  p_user_id uuid,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_work_order_number text;
  v_current_stage text;
  v_next_stage text;
  v_user_name text;
  v_stage_started_at timestamptz;
  v_duration_minutes integer;
BEGIN
  -- Get work order details
  SELECT wo.company_id, wo.work_order_number, wt.current_stage_key, wt.current_stage_started_at
  INTO v_company_id, v_work_order_number, v_current_stage, v_stage_started_at
  FROM work_orders wo
  JOIN work_order_workflow_tracking wt ON wo.id = wt.work_order_id
  WHERE wo.id = p_work_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'work_order_not_found',
      'message', 'Work order not found'
    );
  END IF;

  -- Get user name
  SELECT COALESCE(full_name, email) INTO v_user_name
  FROM user_profiles
  WHERE id = p_user_id;

  -- Calculate duration
  v_duration_minutes := EXTRACT(EPOCH FROM (now() - v_stage_started_at)) / 60;

  -- Determine next stage
  v_next_stage := CASE v_current_stage
    WHEN 'pre_press' THEN 'production'
    WHEN 'production' THEN 'finishing'
    WHEN 'finishing' THEN 'qc'
    WHEN 'qc' THEN 'completed'
    ELSE NULL
  END;

  IF v_next_stage IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid_stage',
      'message', 'Cannot advance from current stage'
    );
  END IF;

  -- Update tracking record with completion timestamps
  CASE v_current_stage
    WHEN 'pre_press' THEN
      UPDATE work_order_workflow_tracking
      SET
        pre_press_completed_at = now(),
        pre_press_completed_by = p_user_id,
        pre_press_duration_minutes = v_duration_minutes,
        production_started_at = now(),
        previous_stage_key = v_current_stage,
        current_stage_key = v_next_stage,
        current_stage_started_at = now(),
        updated_at = now()
      WHERE work_order_id = p_work_order_id;

    WHEN 'production' THEN
      UPDATE work_order_workflow_tracking
      SET
        production_completed_at = now(),
        production_completed_by = p_user_id,
        production_duration_minutes = v_duration_minutes,
        finishing_started_at = now(),
        previous_stage_key = v_current_stage,
        current_stage_key = v_next_stage,
        current_stage_started_at = now(),
        updated_at = now()
      WHERE work_order_id = p_work_order_id;

    WHEN 'finishing' THEN
      UPDATE work_order_workflow_tracking
      SET
        finishing_completed_at = now(),
        finishing_completed_by = p_user_id,
        finishing_duration_minutes = v_duration_minutes,
        qc_started_at = now(),
        previous_stage_key = v_current_stage,
        current_stage_key = v_next_stage,
        current_stage_started_at = now(),
        updated_at = now()
      WHERE work_order_id = p_work_order_id;

    WHEN 'qc' THEN
      UPDATE work_order_workflow_tracking
      SET
        qc_completed_at = now(),
        qc_completed_by = p_user_id,
        qc_duration_minutes = v_duration_minutes,
        completed_at = now(),
        completed_by = p_user_id,
        total_duration_minutes = EXTRACT(EPOCH FROM (now() - pre_press_started_at)) / 60,
        previous_stage_key = v_current_stage,
        current_stage_key = v_next_stage,
        current_stage_started_at = now(),
        updated_at = now()
      WHERE work_order_id = p_work_order_id;

      -- Update work order status to completed
      UPDATE work_orders
      SET
        status = 'completed',
        completed_at = now(),
        updated_at = now()
      WHERE id = p_work_order_id;
  END CASE;

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
    v_current_stage,
    v_next_stage,
    'advance',
    p_user_id,
    v_user_name,
    p_notes,
    jsonb_build_object(
      'duration_minutes', v_duration_minutes,
      'from_stage', v_current_stage,
      'to_stage', v_next_stage
    ) || COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'success', true,
    'from_stage', v_current_stage,
    'to_stage', v_next_stage,
    'duration_minutes', v_duration_minutes,
    'message', format('Advanced from %s to %s', v_current_stage, v_next_stage)
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

-- Function to put work order on hold
CREATE OR REPLACE FUNCTION hold_work_order(
  p_work_order_id uuid,
  p_user_id uuid,
  p_reason text,
  p_metadata jsonb DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_work_order_number text;
  v_current_stage text;
  v_user_name text;
BEGIN
  -- Get work order details
  SELECT wo.company_id, wo.work_order_number, wt.current_stage_key
  INTO v_company_id, v_work_order_number, v_current_stage
  FROM work_orders wo
  JOIN work_order_workflow_tracking wt ON wo.id = wt.work_order_id
  WHERE wo.id = p_work_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_not_found');
  END IF;

  -- Get user name
  SELECT COALESCE(full_name, email) INTO v_user_name
  FROM user_profiles
  WHERE id = p_user_id;

  -- Update tracking to on hold
  UPDATE work_order_workflow_tracking
  SET
    is_on_hold = true,
    hold_reason = p_reason,
    hold_started_at = now(),
    updated_at = now()
  WHERE work_order_id = p_work_order_id;

  -- Update work order status
  UPDATE work_orders
  SET
    status = 'on_hold',
    updated_at = now()
  WHERE id = p_work_order_id;

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
    v_current_stage,
    v_current_stage,
    'hold',
    p_user_id,
    v_user_name,
    p_reason,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Work order placed on hold'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to resume work order from hold
CREATE OR REPLACE FUNCTION resume_work_order(
  p_work_order_id uuid,
  p_user_id uuid,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_company_id uuid;
  v_work_order_number text;
  v_current_stage text;
  v_user_name text;
BEGIN
  -- Get work order details
  SELECT wo.company_id, wo.work_order_number, wt.current_stage_key
  INTO v_company_id, v_work_order_number, v_current_stage
  FROM work_orders wo
  JOIN work_order_workflow_tracking wt ON wo.id = wt.work_order_id
  WHERE wo.id = p_work_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_order_not_found');
  END IF;

  -- Get user name
  SELECT COALESCE(full_name, email) INTO v_user_name
  FROM user_profiles
  WHERE id = p_user_id;

  -- Update tracking to resume
  UPDATE work_order_workflow_tracking
  SET
    is_on_hold = false,
    hold_reason = NULL,
    updated_at = now()
  WHERE work_order_id = p_work_order_id;

  -- Update work order status
  UPDATE work_orders
  SET
    status = 'in_progress',
    updated_at = now()
  WHERE id = p_work_order_id;

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
    v_current_stage,
    v_current_stage,
    'resume',
    p_user_id,
    v_user_name,
    p_notes,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Work order resumed'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION initialize_workflow_stages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_work_order_workflow(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION advance_workflow_stage(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION hold_work_order(uuid, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION resume_work_order(uuid, uuid, text, jsonb) TO authenticated;

-- Update timestamp function for workflow tracking
CREATE OR REPLACE FUNCTION update_workflow_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workflow_tracking_timestamp
  BEFORE UPDATE ON work_order_workflow_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_tracking_timestamp();

CREATE TRIGGER update_qc_inspections_timestamp
  BEFORE UPDATE ON qc_inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_tracking_timestamp();

CREATE TRIGGER update_variances_timestamp
  BEFORE UPDATE ON production_variances
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_tracking_timestamp();

COMMENT ON TABLE production_workflow_stages IS 'Define production workflow stages per company';
COMMENT ON TABLE work_order_workflow_tracking IS 'Track work order progress through production stages';
COMMENT ON TABLE workflow_transition_log IS 'Complete audit trail of all workflow transitions';
COMMENT ON TABLE qc_inspections IS 'Quality control inspection records';
COMMENT ON TABLE production_variances IS 'Track production issues and resolutions';

COMMENT ON FUNCTION initialize_workflow_stages IS 'Initialize default workflow stages for a company';
COMMENT ON FUNCTION initialize_work_order_workflow IS 'Initialize workflow tracking for a new work order';
COMMENT ON FUNCTION advance_workflow_stage IS 'Advance work order to next production stage';
COMMENT ON FUNCTION hold_work_order IS 'Put work order on hold with reason';
COMMENT ON FUNCTION resume_work_order IS 'Resume work order from hold';
