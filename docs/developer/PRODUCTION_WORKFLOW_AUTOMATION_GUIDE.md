# Production Workflow Automation - Complete Guide

Comprehensive production workflow automation system that moves work orders through all production stages with automatic timestamping, user action tracking, variance logging, and department notifications.

---

## Overview

The Production Workflow Automation system manages work orders through the complete production lifecycle from Pre-Press to Completion. Every stage transition is tracked, timed, and logged with full user accountability and automated notifications for the next department.

---

## Workflow Stages

### 1. Pre-Press
**Department:** Pre-Press
**Expected Duration:** 2 hours
**Activities:**
- Artwork preparation and color separation
- Screen setup or embroidery hoop setup
- Film output and screen burning
- Quality checks and approvals

**Metrics Tracked:**
- Started timestamp
- Completed timestamp
- Duration in minutes
- Completed by user

### 2. Production
**Department:** Production
**Expected Duration:** 4 hours
**Activities:**
- Screen printing
- Embroidery
- DTF (Direct-to-Film)
- DTG (Direct-to-Garment)
- Heat press application

**Metrics Tracked:**
- Started timestamp
- Completed timestamp
- Duration in minutes
- Completed by user
- Production type (printing, embroidery, DTF, DTG, heat_press)

### 3. Finishing
**Department:** Finishing
**Expected Duration:** 2 hours
**Activities:**
- Garment folding
- Bagging and packaging
- Tagging and labeling
- Order preparation

**Metrics Tracked:**
- Started timestamp
- Completed timestamp
- Duration in minutes
- Completed by user

### 4. Quality Control
**Department:** QC
**Expected Duration:** 1 hour
**Activities:**
- Final inspection of all items
- Quality verification
- Variance logging if issues found
- Pass/fail determination
- Rework routing if needed

**Metrics Tracked:**
- Started timestamp
- Completed timestamp
- Duration in minutes
- Completed by user
- QC passed (boolean)
- Inspection results (items inspected, passed, failed)

### 5. Completed
**Department:** Completed
**Activities:**
- Work order marked as complete
- Total duration calculated
- Ready for shipping/pickup

**Metrics Tracked:**
- Completed timestamp
- Completed by user
- Total duration from start to finish

---

## Database Schema

### production_workflow_stages
Define workflow stages per company:

```sql
CREATE TABLE production_workflow_stages (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  stage_key text NOT NULL,                    -- 'pre_press', 'production', etc.
  stage_name text NOT NULL,                   -- 'Pre-Press', 'Production', etc.
  stage_order integer NOT NULL,               -- 1, 2, 3, 4, 5
  description text,                           -- Stage description
  requires_qc boolean DEFAULT false,          -- Requires QC inspection
  auto_advance boolean DEFAULT false,         -- Auto-advance to next stage
  department text,                            -- Department responsible
  expected_duration_hours integer,            -- Expected completion time
  is_active boolean DEFAULT true,             -- Stage is active
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, stage_key)
);
```

**Default Stages:**
1. pre_press → Pre-Press → Pre-Press Dept → 2 hours
2. production → Production → Production Dept → 4 hours
3. finishing → Finishing → Finishing Dept → 2 hours
4. qc → Quality Control → QC Dept → 1 hour (requires_qc = true)
5. completed → Completed → Completed → 0 hours

### work_order_workflow_tracking
Track work order progress through stages:

```sql
CREATE TABLE work_order_workflow_tracking (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  work_order_id uuid NOT NULL UNIQUE,
  current_stage_key text NOT NULL,            -- Current stage
  current_stage_started_at timestamptz,       -- When entered current stage
  previous_stage_key text,                    -- Previous stage

  -- Pre-Press stage
  pre_press_started_at timestamptz,
  pre_press_completed_at timestamptz,
  pre_press_completed_by uuid,
  pre_press_duration_minutes integer,

  -- Production stage
  production_started_at timestamptz,
  production_completed_at timestamptz,
  production_completed_by uuid,
  production_duration_minutes integer,
  production_type text,                       -- printing, embroidery, DTF, DTG, heat_press

  -- Finishing stage
  finishing_started_at timestamptz,
  finishing_completed_at timestamptz,
  finishing_completed_by uuid,
  finishing_duration_minutes integer,

  -- QC stage
  qc_started_at timestamptz,
  qc_completed_at timestamptz,
  qc_completed_by uuid,
  qc_duration_minutes integer,
  qc_passed boolean,                          -- QC inspection result

  -- Completion
  completed_at timestamptz,
  completed_by uuid,
  total_duration_minutes integer,             -- Total time from start to finish

  -- Hold status
  is_on_hold boolean DEFAULT false,
  hold_reason text,
  hold_started_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### workflow_transition_log
Complete audit trail of all stage transitions:

```sql
CREATE TABLE workflow_transition_log (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  work_order_id uuid NOT NULL,
  work_order_number text NOT NULL,
  from_stage text,                            -- Stage transitioning from
  to_stage text NOT NULL,                     -- Stage transitioning to
  transition_type text NOT NULL,              -- 'advance', 'revert', 'skip', 'hold', 'resume'
  performed_by uuid NOT NULL,                 -- User who performed transition
  performed_by_name text NOT NULL,            -- User name
  notes text,                                 -- Transition notes
  metadata jsonb,                             -- Additional data
  created_at timestamptz DEFAULT now()
);
```

**Transition Types:**
- `advance` - Move to next stage
- `revert` - Go back to previous stage (QC fail → Production)
- `skip` - Skip a stage (rare, logged for audit)
- `hold` - Put work order on hold
- `resume` - Resume from hold

### qc_inspections
Quality control inspection records:

```sql
CREATE TABLE qc_inspections (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  work_order_id uuid NOT NULL,
  work_order_number text NOT NULL,
  inspector_id uuid NOT NULL,
  inspector_name text NOT NULL,
  inspection_date timestamptz DEFAULT now(),
  passed boolean NOT NULL,                    -- Inspection result
  items_inspected integer NOT NULL,
  items_passed integer NOT NULL,
  items_failed integer NOT NULL,
  failure_reason text,                        -- Why inspection failed
  variance_notes text,                        -- Details about variances
  corrective_action text,                     -- What should be done
  requires_rework boolean DEFAULT false,      -- Needs to go back to production
  rework_notes text,                          -- Rework instructions
  inspection_photos jsonb,                    -- Photo evidence
  metadata jsonb,                             -- Additional data
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### production_variances
Track production issues and resolutions:

```sql
CREATE TABLE production_variances (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  work_order_id uuid NOT NULL,
  work_order_number text NOT NULL,
  stage_key text NOT NULL,                    -- Stage where variance occurred
  variance_type text NOT NULL,                -- 'quality', 'quantity', 'timing', 'equipment', 'material', 'other'
  severity text NOT NULL,                     -- 'minor', 'moderate', 'major', 'critical'
  description text NOT NULL,                  -- Detailed description
  quantity_affected integer DEFAULT 0,        -- How many items affected
  reported_by uuid NOT NULL,
  reported_by_name text NOT NULL,
  reported_at timestamptz DEFAULT now(),
  resolution_status text DEFAULT 'open',      -- 'open', 'in_progress', 'resolved', 'closed'
  resolution_notes text,                      -- How it was resolved
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

---

## Core Functions

### initialize_work_order_workflow()

Initialize workflow tracking when work order is created:

```typescript
const { data: trackingId } = await ProductionWorkflowService.initializeWorkflow(workOrderId);
```

**Backend Function:**
```sql
CREATE FUNCTION initialize_work_order_workflow(p_work_order_id uuid)
RETURNS uuid AS $$
BEGIN
  -- Get company_id from work order
  -- Initialize workflow stages if not exist
  -- Create workflow tracking record with:
  --   current_stage_key = 'pre_press'
  --   current_stage_started_at = now()
  --   pre_press_started_at = now()
  RETURN tracking_id;
END;
$$;
```

**What It Does:**
1. Gets company_id from work order
2. Initializes default workflow stages for company (if first time)
3. Creates workflow_tracking record
4. Sets current stage to 'pre_press'
5. Starts pre_press timer

**When to Call:**
- Automatically when work order created from approved quote
- Manually if work order created directly

### advance_workflow_stage()

Advance work order to next stage:

```typescript
const { data: result } = await ProductionWorkflowService.advanceStage(
  workOrderId,
  userId,
  'Pre-press complete, ready for production',
  { screens_burned: 4, films_used: 8 }
);

// Returns:
{
  success: true,
  from_stage: 'pre_press',
  to_stage: 'production',
  duration_minutes: 127,
  message: 'Advanced from pre_press to production'
}
```

**Backend Function:**
```sql
CREATE FUNCTION advance_workflow_stage(
  p_work_order_id uuid,
  p_user_id uuid,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
) RETURNS jsonb AS $$
BEGIN
  -- Get current stage
  -- Calculate duration in current stage
  -- Determine next stage
  -- Update tracking with completion timestamps
  -- Log transition
  -- If advancing from QC to completed:
  --   Mark work_order.status = 'completed'
  RETURN result_json;
END;
$$;
```

**Stage Progression:**
```
pre_press → production → finishing → qc → completed
```

**What It Does:**
1. Gets current stage from tracking
2. Calculates duration in current stage (minutes)
3. Determines next stage based on current
4. Updates tracking record:
   - Sets `{current_stage}_completed_at` = now()
   - Sets `{current_stage}_completed_by` = user_id
   - Sets `{current_stage}_duration_minutes` = calculated
   - Sets `{next_stage}_started_at` = now()
   - Updates `current_stage_key` = next_stage
   - Updates `current_stage_started_at` = now()
5. Logs transition to workflow_transition_log
6. If transitioning to 'completed':
   - Updates work_orders.status = 'completed'
   - Calculates total_duration_minutes

**Returns:**
- Success with from/to stages and duration
- Or error if invalid stage or work order not found

### hold_work_order()

Put work order on hold:

```typescript
const { data: result } = await ProductionWorkflowService.holdWorkOrder(
  workOrderId,
  userId,
  'Waiting for customer approval on color change'
);

// Returns:
{
  success: true,
  message: 'Work order placed on hold'
}
```

**What It Does:**
1. Sets `is_on_hold` = true
2. Sets `hold_reason` = provided reason
3. Sets `hold_started_at` = now()
4. Updates work_orders.status = 'on_hold'
5. Logs 'hold' transition

**Use Cases:**
- Waiting for customer approval
- Waiting for missing materials
- Equipment breakdown
- Staffing issues

### resume_work_order()

Resume work order from hold:

```typescript
const { data: result } = await ProductionWorkflowService.resumeWorkOrder(
  workOrderId,
  userId,
  'Customer approved color change, resuming production'
);

// Returns:
{
  success: true,
  message: 'Work order resumed'
}
```

**What It Does:**
1. Sets `is_on_hold` = false
2. Clears `hold_reason`
3. Updates work_orders.status = 'in_progress'
4. Logs 'resume' transition
5. Current stage remains unchanged (resumes where it was)

---

## QC Integration

### create_qc_inspection()

Create quality control inspection record:

```typescript
const { data: result } = await ProductionWorkflowService.createQCInspection({
  workOrderId: 'uuid',
  inspectorId: 'user-uuid',
  passed: true,
  itemsInspected: 150,
  itemsPassed: 150,
  itemsFailed: 0
});

// Returns:
{
  success: true,
  inspection_id: 'uuid',
  passed: true,
  message: 'QC inspection passed'
}
```

**Parameters:**
- `workOrderId` - Work order being inspected
- `inspectorId` - User performing inspection
- `passed` - boolean, true if inspection passed
- `itemsInspected` - Total items checked
- `itemsPassed` - Good items
- `itemsFailed` - Failed items
- `failureReason` - Why inspection failed (if passed = false)
- `varianceNotes` - Details about issues found
- `correctiveAction` - What should be done
- `requiresRework` - boolean, needs to go back to production
- `reworkNotes` - Instructions for rework
- `metadata` - Additional data

**What It Does:**
1. Creates qc_inspections record
2. Updates workflow_tracking.qc_passed = passed
3. Returns inspection_id and result

**When to Call:**
- Work order reaches QC stage
- Inspector completes inspection
- Before advancing from QC to completed

### fail_qc_and_revert()

Fail QC inspection and send back to production:

```typescript
const { data: result } = await ProductionWorkflowService.failQCAndRevert(
  workOrderId,
  inspectorId,
  150,  // items inspected
  12,   // items failed
  'Ink bleeding on 12 shirts, misalignment on print',
  'Re-print 12 shirts, check screen tension and squeegee pressure'
);

// Returns:
{
  success: true,
  inspection_id: 'uuid',
  reverted_to: 'production',
  message: 'QC failed, work order reverted to production for rework'
}
```

**What It Does:**
1. Creates failed QC inspection record (passed = false, requires_rework = true)
2. Reverts workflow to production stage:
   - Sets `current_stage_key` = 'production'
   - Sets `previous_stage_key` = 'qc'
   - Sets `production_started_at` = now()
   - Sets `qc_passed` = false
3. Logs 'revert' transition with failure details
4. Returns inspection_id and confirmation

**Use Cases:**
- Quality defects found
- Misprints or misalignments
- Color issues
- Incomplete work
- Damaged items

**Next Steps:**
- Production team receives notification
- Rework instructions visible
- Work order goes through production again
- Returns to QC for re-inspection

---

## Variance Management

### report_production_variance()

Report production issue or variance:

```typescript
const { data: result } = await ProductionWorkflowService.reportVariance({
  workOrderId: 'uuid',
  stageKey: 'production',
  varianceType: 'equipment',
  severity: 'major',
  description: 'Screen printing press #2 has inconsistent pressure causing ink bleed on right side',
  reportedBy: 'user-uuid',
  quantityAffected: 25,
  metadata: { press_number: 2, location: 'right_side' }
});

// Returns:
{
  success: true,
  variance_id: 'uuid',
  severity: 'major',
  message: 'Production variance reported'
}
```

**Variance Types:**
- `quality` - Quality issues (defects, misprints, etc.)
- `quantity` - Wrong quantities (shortages, overruns)
- `timing` - Delays, scheduling issues
- `equipment` - Machine breakdowns, malfunctions
- `material` - Missing or defective materials
- `other` - Other issues

**Severity Levels:**
- `minor` - Small issue, doesn't affect completion
- `moderate` - Noticeable issue, may cause delay
- `major` - Significant issue, will cause delay or rework
- `critical` - Severe issue, stops production

**What It Does:**
1. Creates production_variances record
2. Sets resolution_status = 'open'
3. Records reporter, timestamp, details
4. Returns variance_id

**When to Report:**
- Equipment malfunctions
- Quality defects discovered
- Material shortages
- Timing delays
- Any production issue

### resolve_production_variance()

Resolve reported variance:

```typescript
const { data: result } = await ProductionWorkflowService.resolveVariance(
  varianceId,
  userId,
  'Adjusted press pressure and replaced worn squeegee. Test prints look good. Re-printed affected 25 shirts.',
  'resolved'
);

// Returns:
{
  success: true,
  message: 'Production variance resolved'
}
```

**Resolution Statuses:**
- `open` - Just reported, not addressed
- `in_progress` - Being worked on
- `resolved` - Issue fixed
- `closed` - Closed/documented

**What It Does:**
1. Updates variance record:
   - Sets `resolution_status` = provided status
   - Sets `resolution_notes` = provided notes
   - Sets `resolved_by` = user_id
   - Sets `resolved_at` = now()
2. Returns confirmation

---

## Workflow Status and Reporting

### get_work_order_workflow_status()

Get complete workflow status with all details:

```typescript
const { data: status } = await ProductionWorkflowService.getWorkflowStatus(workOrderId);

// Returns:
{
  work_order: {
    id: 'uuid',
    work_order_number: 'WO-2026-001',
    customer_name: 'ABC Corp',
    status: 'in_progress',
    priority: 'high',
    production_due_date: '2026-02-15',
    customer_due_date: '2026-02-20',
    total_quantity: 150
  },
  workflow: {
    current_stage: 'production',
    current_stage_started_at: '2026-02-06T10:30:00Z',
    is_on_hold: false,
    hold_reason: null,
    pre_press: {
      started_at: '2026-02-06T08:00:00Z',
      completed_at: '2026-02-06T10:30:00Z',
      duration_minutes: 150,
      completed_by: 'user-uuid'
    },
    production: {
      started_at: '2026-02-06T10:30:00Z',
      completed_at: null,
      duration_minutes: null,
      completed_by: null,
      production_type: 'screen_printing'
    },
    finishing: { ... },
    qc: { ... },
    completed: { ... }
  },
  transitions: [
    {
      id: 'uuid',
      from_stage: 'pre_press',
      to_stage: 'production',
      transition_type: 'advance',
      performed_by_name: 'John Smith',
      notes: 'Pre-press complete, 4 screens burned',
      created_at: '2026-02-06T10:30:00Z'
    }
  ],
  qc_inspections: [ ... ],
  variances: [ ... ]
}
```

**Use Cases:**
- Work order detail view
- Status dashboard
- Progress tracking
- Timeline visualization

### get_stage_performance_stats()

Get performance statistics for all stages:

```typescript
const { data: stats } = await ProductionWorkflowService.getStagePerformanceStats(
  '2026-01-01T00:00:00Z',  // start date
  '2026-01-31T23:59:59Z'   // end date
);

// Returns:
{
  pre_press: {
    completed_count: 45,
    avg_duration_minutes: 132,
    min_duration_minutes: 75,
    max_duration_minutes: 210
  },
  production: {
    completed_count: 42,
    avg_duration_minutes: 243,
    min_duration_minutes: 180,
    max_duration_minutes: 360
  },
  finishing: {
    completed_count: 40,
    avg_duration_minutes: 118,
    min_duration_minutes: 60,
    max_duration_minutes: 180
  },
  qc: {
    completed_count: 40,
    avg_duration_minutes: 52,
    min_duration_minutes: 30,
    max_duration_minutes: 90,
    pass_rate: 92.5  // 37/40 passed
  },
  overall: {
    completed_work_orders: 38,
    avg_total_duration_minutes: 545,
    min_total_duration_minutes: 420,
    max_total_duration_minutes: 720
  },
  variances: {
    total_count: 15,
    open_count: 3,
    by_severity: {
      minor: 8,
      moderate: 5,
      major: 2,
      critical: 0
    }
  }
}
```

**Use Cases:**
- Performance analysis
- Bottleneck identification
- Resource planning
- Process improvement
- Management dashboards

---

## Department Notifications

### Automatic Notifications

Work orders transitioning between stages trigger automatic department notifications through the workflow_transition_log.

**Notification Flow:**

```
Pre-Press Completes Work
  ↓
advance_workflow_stage() called
  ↓
Transition logged: from_stage='pre_press', to_stage='production'
  ↓
Production Department Query:
  SELECT * FROM workflow_transition_log
  WHERE to_stage = 'production'
  AND created_at > (last_check_time)
  ORDER BY created_at DESC
  ↓
Production Department Notified:
  "WO-2026-001 ready for production"
  "Completed by: John Smith"
  "Notes: 4 screens burned, ready to print"
```

**Implementation Approaches:**

1. **Real-time Polling:**
```typescript
// Frontend polling every 30 seconds
setInterval(async () => {
  const { data: transitions } = await supabase
    .from('workflow_transition_log')
    .select('*')
    .eq('to_stage', currentDepartmentStage)
    .gte('created_at', lastCheckTime)
    .order('created_at', { ascending: false });

  transitions?.forEach(t => {
    showNotification(`${t.work_order_number} ready for ${t.to_stage}`);
  });
}, 30000);
```

2. **Real-time Subscriptions:**
```typescript
// Subscribe to new transitions
const subscription = supabase
  .channel('workflow_transitions')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'workflow_transition_log',
      filter: `to_stage=eq.production`
    },
    (payload) => {
      showNotification(`${payload.new.work_order_number} ready for production`);
    }
  )
  .subscribe();
```

3. **Dashboard View:**
```typescript
// Get work orders in my department's stage
const { data: myWorkOrders } = await ProductionWorkflowService.getWorkOrdersByStage('production');

// Show list of work orders ready for my department
myWorkOrders?.forEach(wo => {
  displayWorkOrder(wo);
});
```

**Notification Content:**
- Work order number
- Customer name
- Priority level
- Quantity
- Due date
- Transition notes from previous stage
- Time waiting in queue

---

## Frontend Service API

### ProductionWorkflowService

**Location:** `src/services/production-workflow-service.ts`

**Complete API:**

```typescript
// Initialization
initializeWorkflow(workOrderId: string)

// Stage Management
getWorkflowStages()
getWorkflowTracking(workOrderId: string)
advanceStage(workOrderId, userId, notes?, metadata?)
holdWorkOrder(workOrderId, userId, reason, metadata?)
resumeWorkOrder(workOrderId, userId, notes?, metadata?)

// QC Management
createQCInspection(params: { ... })
failQCAndRevert(workOrderId, inspectorId, itemsInspected, itemsFailed, failureReason, reworkNotes)

// Variance Management
reportVariance(params: { ... })
resolveVariance(varianceId, resolvedBy, resolutionNotes, resolutionStatus?)

// Status and Reporting
getWorkflowStatus(workOrderId: string)
getWorkflowTransitions(workOrderId: string)
getQCInspections(workOrderId: string)
getProductionVariances(workOrderId: string)

// Dashboard Queries
getWorkOrdersByStage(stageKey: string)
getWorkOrdersOnHold()
getOpenVariances()
getStagePerformanceStats(startDate?, endDate?)
getDashboardStats()
```

---

## Complete Workflow Example

### Scenario: T-Shirt Order Production Flow

**Initial State:**
- Quote approved, work order WO-2026-001 created
- Customer: ABC Corp
- Quantity: 150 shirts
- Design: 4-color screen print, front and back

**Step 1: Work Order Created**
```typescript
// Automatic on quote approval
await ProductionWorkflowService.initializeWorkflow('wo-uuid');

// Creates tracking:
{
  current_stage_key: 'pre_press',
  pre_press_started_at: '2026-02-06T08:00:00Z',
  current_stage_started_at: '2026-02-06T08:00:00Z'
}
```

**Step 2: Pre-Press Work (2.5 hours)**
- Artwork separated into 4 colors
- 4 screens burned
- Test prints approved
- Pre-press complete at 10:30 AM

```typescript
// Pre-press operator advances stage
const { data } = await ProductionWorkflowService.advanceStage(
  'wo-uuid',
  'prepress-user-uuid',
  '4 screens burned, test prints approved. Front: CMYK. Back: Single color.',
  { screens: 4, colors: 4, test_prints: 3 }
);

// Updates tracking:
{
  pre_press_completed_at: '2026-02-06T10:30:00Z',
  pre_press_completed_by: 'prepress-user-uuid',
  pre_press_duration_minutes: 150,
  current_stage_key: 'production',
  production_started_at: '2026-02-06T10:30:00Z',
  current_stage_started_at: '2026-02-06T10:30:00Z'
}

// Logs transition:
{
  from_stage: 'pre_press',
  to_stage: 'production',
  transition_type: 'advance',
  performed_by_name: 'John Smith',
  notes: '4 screens burned, test prints approved...',
  duration_minutes: 150
}
```

**Step 3: Production Notified**
```typescript
// Production department sees notification:
"WO-2026-001 ready for production"
"Customer: ABC Corp - 150 shirts"
"Completed by: John Smith at 10:30 AM"
"Notes: 4 screens burned, test prints approved. Front: CMYK. Back: Single color."
```

**Step 4: Production Work (4 hours)**
- 150 shirts printed
- Front: 4-color CMYK process
- Back: Single color
- Production complete at 2:30 PM

```typescript
// Production operator advances stage
await ProductionWorkflowService.advanceStage(
  'wo-uuid',
  'production-user-uuid',
  '150 shirts printed. Front: CMYK 4-color. Back: Black single color. Press #2 used.',
  { press_number: 2, production_type: 'screen_printing' }
);

// Updates tracking:
{
  production_completed_at: '2026-02-06T14:30:00Z',
  production_completed_by: 'production-user-uuid',
  production_duration_minutes: 240,
  production_type: 'screen_printing',
  current_stage_key: 'finishing',
  finishing_started_at: '2026-02-06T14:30:00Z'
}
```

**Step 5: Finishing Work (2 hours)**
- Shirts folded
- Bagged in sets of 10
- Tagged with customer labels
- Finishing complete at 4:30 PM

```typescript
// Finishing operator advances stage
await ProductionWorkflowService.advanceStage(
  'wo-uuid',
  'finishing-user-uuid',
  '150 shirts folded and bagged. 15 bags of 10 shirts each. Customer labels applied.',
  { bags: 15, items_per_bag: 10 }
);

// Updates tracking:
{
  finishing_completed_at: '2026-02-06T16:30:00Z',
  finishing_completed_by: 'finishing-user-uuid',
  finishing_duration_minutes: 120,
  current_stage_key: 'qc',
  qc_started_at: '2026-02-06T16:30:00Z'
}
```

**Step 6: Quality Control (1 hour)**
- QC inspector checks all 150 shirts
- Finds 8 shirts with minor ink bleeding
- Fails QC, sends back to production

```typescript
// QC inspector fails inspection
await ProductionWorkflowService.failQCAndRevert(
  'wo-uuid',
  'qc-inspector-uuid',
  150,  // items inspected
  8,    // items failed
  'Ink bleeding on 8 shirts, visible around edges of back print',
  'Re-print 8 shirts. Check squeegee pressure and ink viscosity. Original 8 shirts set aside for disposal.'
);

// Creates QC inspection:
{
  passed: false,
  items_inspected: 150,
  items_passed: 142,
  items_failed: 8,
  failure_reason: 'Ink bleeding on 8 shirts...',
  requires_rework: true,
  rework_notes: 'Re-print 8 shirts...'
}

// Reverts workflow:
{
  current_stage_key: 'production',  // Back to production
  previous_stage_key: 'qc',
  production_started_at: '2026-02-06T17:30:00Z',
  qc_passed: false
}

// Logs transition:
{
  from_stage: 'qc',
  to_stage: 'production',
  transition_type: 'revert',
  notes: 'QC Failed: Ink bleeding on 8 shirts...'
}
```

**Step 7: Production Rework (30 minutes)**
- Adjusted ink viscosity
- Re-printed 8 replacement shirts
- Rework complete at 6:00 PM

```typescript
// Production advances again
await ProductionWorkflowService.advanceStage(
  'wo-uuid',
  'production-user-uuid',
  'Rework complete. 8 replacement shirts printed. Ink viscosity adjusted. All shirts look good.',
  { rework: true, items_reprinted: 8 }
);

// Updates to finishing again
```

**Step 8: Finishing Rework (15 minutes)**
```typescript
await ProductionWorkflowService.advanceStage(
  'wo-uuid',
  'finishing-user-uuid',
  '8 replacement shirts folded and bagged. Final count: 150 shirts in 15 bags.'
);

// Back to QC
```

**Step 9: QC Re-Inspection (Pass)**
```typescript
// QC inspector passes inspection
await ProductionWorkflowService.createQCInspection({
  workOrderId: 'wo-uuid',
  inspectorId: 'qc-inspector-uuid',
  passed: true,
  itemsInspected: 150,
  itemsPassed: 150,
  itemsFailed: 0
});

// Then advance to completion
await ProductionWorkflowService.advanceStage(
  'wo-uuid',
  'qc-inspector-uuid',
  'QC passed. All 150 shirts meet quality standards. Ready for shipment.'
);

// Final tracking:
{
  qc_completed_at: '2026-02-06T18:45:00Z',
  qc_completed_by: 'qc-inspector-uuid',
  qc_duration_minutes: 75,
  qc_passed: true,
  completed_at: '2026-02-06T18:45:00Z',
  completed_by: 'qc-inspector-uuid',
  total_duration_minutes: 645,  // 10 hours 45 minutes
  current_stage_key: 'completed'
}

// Work order updated:
{
  status: 'completed',
  completed_at: '2026-02-06T18:45:00Z'
}
```

**Final Timeline:**
- Pre-Press: 2.5 hours (8:00 AM - 10:30 AM)
- Production: 4 hours (10:30 AM - 2:30 PM)
- Finishing: 2 hours (2:30 PM - 4:30 PM)
- QC (Failed): 1 hour (4:30 PM - 5:30 PM)
- Production Rework: 0.5 hours (5:30 PM - 6:00 PM)
- Finishing Rework: 0.25 hours (6:00 PM - 6:15 PM)
- QC (Passed): 1.25 hours (6:15 PM - 7:30 PM)
- **Total: 11.5 hours**

---

## Performance Metrics

### Stage Performance

**Track efficiency of each stage:**

```typescript
const { data: stats } = await ProductionWorkflowService.getStagePerformanceStats(
  '2026-01-01', '2026-01-31'
);

console.log('Pre-Press Avg Duration:', stats.pre_press.avg_duration_minutes, 'minutes');
console.log('Production Avg Duration:', stats.production.avg_duration_minutes, 'minutes');
console.log('QC Pass Rate:', stats.qc.pass_rate, '%');
```

**Identify bottlenecks:**
- Which stage takes longest?
- Which stage has most variance?
- Where are delays occurring?

**Optimize workflow:**
- If pre-press avg > expected: Need more pre-press staff
- If production avg > expected: Equipment issues or training needed
- If QC pass rate < 95%: Quality issues in production

### Variance Analysis

**Track production issues:**

```typescript
const { data: variances } = await ProductionWorkflowService.getOpenVariances();

// Group by type and severity
const byType = variances.reduce((acc, v) => {
  acc[v.variance_type] = (acc[v.variance_type] || 0) + 1;
  return acc;
}, {});

// Most common issues:
// equipment: 8
// quality: 5
// material: 3
```

**Root cause analysis:**
- Which types most common?
- Which stages have most variances?
- Are variances increasing or decreasing?
- Equipment maintenance needed?

---

## Best Practices

### Stage Transitions

1. **Always Add Notes:**
   - Document what was completed
   - Include any issues or concerns
   - Provide context for next department

2. **Complete Before Advancing:**
   - Finish ALL work in current stage
   - Don't advance prematurely
   - Verify quality before moving forward

3. **Use Metadata:**
   - Track machine numbers, settings used
   - Record materials consumed
   - Note any special handling

### Quality Control

1. **Inspect Thoroughly:**
   - Check representative sample
   - Look for common defects
   - Document findings clearly

2. **Fail Fast:**
   - If defects found, fail immediately
   - Don't wait until end of order
   - Faster rework = less total time

3. **Provide Clear Rework Instructions:**
   - Specific about what to fix
   - Include root cause if known
   - Suggest corrective actions

### Variance Management

1. **Report Immediately:**
   - Don't wait until end of shift
   - Real-time reporting enables faster response
   - Document while details fresh

2. **Be Specific:**
   - Detailed description helps resolution
   - Include quantities affected
   - Note when issue started

3. **Follow Up:**
   - Resolve variances promptly
   - Document corrective actions
   - Track if issue recurs

### Performance Monitoring

1. **Review Daily:**
   - Check completed work orders
   - Review failed QC inspections
   - Address open variances

2. **Weekly Analysis:**
   - Review stage performance stats
   - Identify bottlenecks
   - Plan improvements

3. **Monthly Review:**
   - Long-term trends
   - Resource allocation
   - Training needs

---

## Summary

The Production Workflow Automation system provides:

**Complete Lifecycle Tracking:**
- Every stage from Pre-Press to Completion
- Automatic timestamping
- Duration calculations
- User accountability

**Quality Management:**
- QC inspection tracking
- Pass/fail recording
- Automatic rework routing
- Inspection history

**Issue Tracking:**
- Production variance logging
- Severity classification
- Resolution management
- Root cause documentation

**Department Coordination:**
- Automatic stage transitions
- Transition logging for notifications
- Real-time status visibility
- Clear handoff notes

**Performance Analytics:**
- Stage duration metrics
- QC pass rates
- Bottleneck identification
- Trend analysis

**Complete Audit Trail:**
- Every transition logged
- User actions recorded
- Timestamps for everything
- Metadata captured

This system ensures efficient production flow, quality assurance, issue resolution, and comprehensive tracking from artwork to completed order. Every department knows what work is ready, what needs to be done, and how long things are taking, enabling continuous improvement and operational excellence.
