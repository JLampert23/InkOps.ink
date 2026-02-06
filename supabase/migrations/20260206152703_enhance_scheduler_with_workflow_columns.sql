/*
  # Enhance Scheduler with Workflow Columns and Auto-Assignment

  1. New Columns for production_schedule_entries
    - `work_order_id` (uuid) - Link to work order
    - `scheduler_column` (text) - Workflow board column (Unscheduled, Scheduled, In Progress, Complete)
    - `assigned_to` (uuid) - User assigned to this task
    - `colors` (text) - Ink/thread colors for decoration
    - `press_type` (text) - Type of press/machine (auto, manual)
    - `estimated_runtime` (int) - Estimated minutes to complete
    - `actual_runtime` (int) - Actual minutes spent
    - `department` (text) - Department (screen printing, embroidery, etc.)
    - `notes` (text) - Production notes
    - `completed_at` (timestamptz) - When task was completed
    - `started_at` (timestamptz) - When work started

  2. New Table: scheduler_columns
    - Define workflow board columns per company
    - Customizable column names and order
    - Default columns created for new companies

  3. New Table: scheduler_assignments
    - Track auto-assignment rules
    - Round-robin or skill-based assignment
    - Department-based assignments

  4. Purpose
    - Enable drag-and-drop workflow boards
    - Support auto-assignment of tasks
    - Track production progress in detail
    - Improve scheduling visibility
*/

-- Add new columns to production_schedule_entries
ALTER TABLE production_schedule_entries
ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS scheduler_column text DEFAULT 'Unscheduled',
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS colors text,
ADD COLUMN IF NOT EXISTS press_type text,
ADD COLUMN IF NOT EXISTS estimated_runtime int DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_runtime int DEFAULT 0,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_schedule_entries_work_order_id ON production_schedule_entries(work_order_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_scheduler_column ON production_schedule_entries(company_id, scheduler_column);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_assigned_to ON production_schedule_entries(assigned_to);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_department ON production_schedule_entries(company_id, department);

-- Create scheduler_columns table for workflow board configuration
CREATE TABLE IF NOT EXISTS scheduler_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  column_name text NOT NULL,
  column_order int NOT NULL DEFAULT 0,
  color text DEFAULT '#3b82f6',
  is_default boolean DEFAULT false,
  is_completion_column boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, column_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduler_columns_company_id ON scheduler_columns(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_columns_order ON scheduler_columns(company_id, column_order);

-- Enable RLS
ALTER TABLE scheduler_columns ENABLE ROW LEVEL SECURITY;

-- Policies for scheduler_columns
CREATE POLICY "Users can view their company scheduler columns"
  ON scheduler_columns
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage scheduler columns"
  ON scheduler_columns
  FOR ALL
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND get_user_role(auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND get_user_role(auth.uid()) = 'super_admin'
  );

-- Create scheduler_assignments table for auto-assignment rules
CREATE TABLE IF NOT EXISTS scheduler_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company_settings(id) ON DELETE CASCADE,
  department text NOT NULL,
  type_of_work text NOT NULL,
  assignment_mode text NOT NULL CHECK (assignment_mode IN ('round_robin', 'skill_based', 'manual', 'least_loaded')),
  eligible_users uuid[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, department, type_of_work)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scheduler_assignments_company_id ON scheduler_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_assignments_department ON scheduler_assignments(company_id, department);

-- Enable RLS
ALTER TABLE scheduler_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for scheduler_assignments
CREATE POLICY "Users can view their company assignment rules"
  ON scheduler_assignments
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage assignment rules"
  ON scheduler_assignments
  FOR ALL
  TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND get_user_role(auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND get_user_role(auth.uid()) = 'super_admin'
  );

-- Function to create default scheduler columns for new companies
CREATE OR REPLACE FUNCTION create_default_scheduler_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default columns: Unscheduled → Scheduled → In Progress → Complete
  INSERT INTO scheduler_columns (company_id, column_name, column_order, color, is_default, is_completion_column)
  VALUES 
    (NEW.id, 'Unscheduled', 1, '#6b7280', true, false),
    (NEW.id, 'Scheduled', 2, '#3b82f6', false, false),
    (NEW.id, 'In Progress', 3, '#f59e0b', false, false),
    (NEW.id, 'Complete', 4, '#10b981', false, true)
  ON CONFLICT (company_id, column_name) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default columns when new company is created
DROP TRIGGER IF EXISTS trigger_create_default_scheduler_columns ON company_settings;
CREATE TRIGGER trigger_create_default_scheduler_columns
  AFTER INSERT ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION create_default_scheduler_columns();

-- Function to auto-assign scheduler tasks
CREATE OR REPLACE FUNCTION auto_assign_scheduler_task(
  p_company_id uuid,
  p_department text,
  p_type_of_work text
) RETURNS uuid AS $$
DECLARE
  v_assignment_rule RECORD;
  v_assigned_user uuid;
  v_user_counts RECORD;
BEGIN
  -- Get assignment rule for this department and type of work
  SELECT * INTO v_assignment_rule
  FROM scheduler_assignments
  WHERE company_id = p_company_id
    AND department = p_department
    AND type_of_work = p_type_of_work
    AND is_active = true
  LIMIT 1;
  
  -- If no rule found, return null (manual assignment)
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Handle different assignment modes
  CASE v_assignment_rule.assignment_mode
    WHEN 'round_robin' THEN
      -- Find user with least assignments in last 24 hours
      SELECT user_id INTO v_assigned_user
      FROM (
        SELECT UNNEST(v_assignment_rule.eligible_users) as user_id
      ) eligible
      LEFT JOIN (
        SELECT assigned_to, COUNT(*) as task_count
        FROM production_schedule_entries
        WHERE company_id = p_company_id
          AND assigned_to = ANY(v_assignment_rule.eligible_users)
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY assigned_to
      ) counts ON eligible.user_id = counts.assigned_to
      ORDER BY COALESCE(counts.task_count, 0) ASC, RANDOM()
      LIMIT 1;
      
    WHEN 'least_loaded' THEN
      -- Find user with least active tasks
      SELECT user_id INTO v_assigned_user
      FROM (
        SELECT UNNEST(v_assignment_rule.eligible_users) as user_id
      ) eligible
      LEFT JOIN (
        SELECT assigned_to, COUNT(*) as task_count
        FROM production_schedule_entries
        WHERE company_id = p_company_id
          AND assigned_to = ANY(v_assignment_rule.eligible_users)
          AND scheduler_column NOT IN (
            SELECT column_name 
            FROM scheduler_columns 
            WHERE company_id = p_company_id 
              AND is_completion_column = true
          )
        GROUP BY assigned_to
      ) counts ON eligible.user_id = counts.assigned_to
      ORDER BY COALESCE(counts.task_count, 0) ASC, RANDOM()
      LIMIT 1;
      
    WHEN 'skill_based' THEN
      -- For now, just pick first eligible user
      -- In future, could check user skills/certifications
      SELECT user_id INTO v_assigned_user
      FROM UNNEST(v_assignment_rule.eligible_users) as user_id
      LIMIT 1;
      
    ELSE
      -- Manual assignment
      RETURN NULL;
  END CASE;
  
  RETURN v_assigned_user;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically set scheduler column and assign task when created
CREATE OR REPLACE FUNCTION auto_process_scheduler_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_default_column text;
  v_assigned_user uuid;
BEGIN
  -- If scheduler_column not set, use default
  IF NEW.scheduler_column IS NULL OR NEW.scheduler_column = '' THEN
    SELECT column_name INTO v_default_column
    FROM scheduler_columns
    WHERE company_id = NEW.company_id
      AND is_default = true
    ORDER BY column_order
    LIMIT 1;
    
    IF FOUND THEN
      NEW.scheduler_column := v_default_column;
    ELSE
      NEW.scheduler_column := 'Unscheduled';
    END IF;
  END IF;
  
  -- Auto-assign if no assignment yet and department/type_of_work set
  IF NEW.assigned_to IS NULL AND NEW.department IS NOT NULL AND NEW.type_of_work IS NOT NULL THEN
    v_assigned_user := auto_assign_scheduler_task(
      NEW.company_id,
      NEW.department,
      NEW.type_of_work
    );
    
    IF v_assigned_user IS NOT NULL THEN
      NEW.assigned_to := v_assigned_user;
    END IF;
  END IF;
  
  -- Set started_at when moving to In Progress
  IF NEW.scheduler_column = 'In Progress' AND OLD.scheduler_column IS DISTINCT FROM 'In Progress' THEN
    NEW.started_at := NOW();
  END IF;
  
  -- Set completed_at when moving to completion column
  IF NEW.scheduler_column IN (
    SELECT column_name 
    FROM scheduler_columns 
    WHERE company_id = NEW.company_id 
      AND is_completion_column = true
  ) AND (OLD.scheduler_column IS NULL OR OLD.scheduler_column NOT IN (
    SELECT column_name 
    FROM scheduler_columns 
    WHERE company_id = NEW.company_id 
      AND is_completion_column = true
  )) THEN
    NEW.completed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-processing scheduler entries
DROP TRIGGER IF EXISTS trigger_auto_process_scheduler_entry ON production_schedule_entries;
CREATE TRIGGER trigger_auto_process_scheduler_entry
  BEFORE INSERT OR UPDATE ON production_schedule_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_process_scheduler_entry();

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_scheduler_columns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scheduler_columns_timestamp
  BEFORE UPDATE ON scheduler_columns
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduler_columns_updated_at();

CREATE OR REPLACE FUNCTION update_scheduler_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scheduler_assignments_timestamp
  BEFORE UPDATE ON scheduler_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduler_assignments_updated_at();

COMMENT ON TABLE scheduler_columns IS 'Workflow board columns for production scheduler. Customizable per company.';
COMMENT ON TABLE scheduler_assignments IS 'Auto-assignment rules for scheduler tasks based on department and work type.';
COMMENT ON FUNCTION auto_assign_scheduler_task IS 'Automatically assigns scheduler tasks based on configured rules (round-robin, skill-based, least-loaded).';
