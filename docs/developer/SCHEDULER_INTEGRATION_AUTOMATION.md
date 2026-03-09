# Scheduler Integration Automation

## Overview

Comprehensive production scheduler system that automatically creates detailed scheduler tasks for each imprint when a quote is approved. Features drag-and-drop workflow boards, auto-assignment logic, and complete production tracking from approval to completion.

---

## Architecture

### Database Tables

#### 1. production_schedule_entries (Enhanced)
Production tasks with complete metadata:
- `id` - Unique identifier
- `company_id` - Company isolation
- `quote_id` - Original quote
- `work_order_id` - Linked work order
- `line_item_id` - Quote line item
- `imprint_id` - Specific imprint
- `type_of_work` - Decoration type (Screen Printing, Embroidery, etc.)
- `imprint_number` - Display number
- `artwork_thumb_url` - Artwork preview
- `production_due_date` - Target completion date
- `station` - Production station
- `quantity` - Number of items
- `step_statuses` (jsonb) - Workflow step tracking
- `priority_order` - Task priority
- `customer_name` - Customer for filtering
- `quote_number` - Quote reference
- `scheduler_column` - Workflow board column (Unscheduled, Scheduled, In Progress, Complete)
- `assigned_to` - User assigned to task
- `colors` - Ink/thread colors
- `press_type` - Machine type
- `estimated_runtime` - Minutes to complete
- `actual_runtime` - Actual time spent
- `department` - Department (screen_printing, embroidery, dtg, vinyl, general)
- `notes` - Production notes
- `started_at` - When work began
- `completed_at` - When finished

#### 2. scheduler_columns
Workflow board column configuration:
- `id` - Unique identifier
- `company_id` - Company isolation
- `column_name` - Display name
- `column_order` - Sort order
- `color` - Column color
- `is_default` - Default column for new tasks
- `is_completion_column` - Marks task as complete

**Default Columns:**
1. Unscheduled (Gray, #6b7280) - Default column
2. Scheduled (Blue, #3b82f6)
3. In Progress (Orange, #f59e0b)
4. Complete (Green, #10b981) - Completion column

#### 3. scheduler_assignments
Auto-assignment rules:
- `id` - Unique identifier
- `company_id` - Company isolation
- `department` - Department for rule
- `type_of_work` - Work type for rule
- `assignment_mode` - Assignment strategy:
  - `round_robin` - Distribute evenly based on 24hr history
  - `least_loaded` - Assign to user with fewest active tasks
  - `skill_based` - Assign based on skills (future)
  - `manual` - No auto-assignment
- `eligible_users` (uuid[]) - Users eligible for assignment
- `is_active` - Enable/disable rule

---

## Automation Workflow

### Trigger
**When:** Quote status changes to 'approved'

### Automatic Scheduler Task Creation

The enhanced `process_quote_approval()` function executes:

#### 1. Extract Imprint Data
```sql
FOR EACH quote_imprint:
  - Get imprint details
  - Get line item quantity
  - Extract color information
  - Get estimated runtime
  - Determine department from type_of_work
```

#### 2. Determine Department
```sql
department := CASE
  WHEN type_of_work LIKE '%screen%' THEN 'screen_printing'
  WHEN type_of_work LIKE '%embroid%' THEN 'embroidery'
  WHEN type_of_work LIKE '%dtg%' THEN 'dtg'
  WHEN type_of_work LIKE '%vinyl%' THEN 'vinyl'
  ELSE 'general'
END
```

#### 3. Create Scheduler Entry
```sql
INSERT INTO production_schedule_entries (
  company_id,
  quote_id,
  work_order_id,              -- Links to work order
  line_item_id,
  imprint_id,
  type_of_work,
  imprint_number,
  artwork_thumb_url,
  production_due_date,
  quantity,
  customer_name,
  quote_number,
  colors,                     -- Ink/thread colors
  estimated_runtime,          -- Minutes to complete
  department,                 -- Auto-determined
  notes
)
```

#### 4. Auto-Process Entry (Trigger)
**Function:** `auto_process_scheduler_entry()`

**Actions:**
1. **Set Default Column**
   ```sql
   IF scheduler_column IS NULL THEN
     scheduler_column := (
       SELECT column_name
       FROM scheduler_columns
       WHERE is_default = true
     )
   END IF
   ```
   Default: "Unscheduled"

2. **Auto-Assign User**
   ```sql
   IF assigned_to IS NULL AND department IS NOT NULL THEN
     assigned_to := auto_assign_scheduler_task(
       company_id,
       department,
       type_of_work
     )
   END IF
   ```

3. **Track Timing**
   - When moved to "In Progress": Set `started_at`
   - When moved to completion column: Set `completed_at`

---

## Auto-Assignment Logic

### Function: auto_assign_scheduler_task()

**Input:**
- company_id
- department
- type_of_work

**Output:**
- user_id (or NULL for manual)

### Assignment Modes

#### 1. Round Robin
Distributes tasks evenly based on assignments in last 24 hours:
```sql
SELECT user_id
FROM eligible_users
LEFT JOIN (
  SELECT assigned_to, COUNT(*) as task_count
  FROM production_schedule_entries
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY assigned_to
) counts ON user_id = counts.assigned_to
ORDER BY COALESCE(task_count, 0) ASC, RANDOM()
LIMIT 1
```

**Use Case:** Ensure fair distribution of work

#### 2. Least Loaded
Assigns to user with fewest active tasks:
```sql
SELECT user_id
FROM eligible_users
LEFT JOIN (
  SELECT assigned_to, COUNT(*) as task_count
  FROM production_schedule_entries
  WHERE scheduler_column NOT IN (completion_columns)
  GROUP BY assigned_to
) counts ON user_id = counts.assigned_to
ORDER BY COALESCE(task_count, 0) ASC, RANDOM()
LIMIT 1
```

**Use Case:** Prevent user overload

#### 3. Skill Based
Assigns based on user skills (future enhancement):
```sql
SELECT user_id
FROM eligible_users
WHERE has_skill_for(user_id, type_of_work)
LIMIT 1
```

**Use Case:** Match specialized skills

#### 4. Manual
No auto-assignment:
```sql
RETURN NULL
```

**Use Case:** Manual control needed

---

## Workflow Board

### Drag-and-Drop Interface

**Features:**
- Visual kanban-style board
- Drag tasks between columns
- Color-coded columns
- Real-time task counts
- Overdue indicators
- Task detail modal

**Columns:**
```
┌─────────────┬─────────────┬──────────────┬──────────┐
│ Unscheduled │  Scheduled  │ In Progress  │ Complete │
│   (Gray)    │   (Blue)    │   (Orange)   │ (Green)  │
├─────────────┼─────────────┼──────────────┼──────────┤
│  Task 1     │  Task 4     │  Task 7      │ Task 10  │
│  Task 2     │  Task 5     │  Task 8      │ Task 11  │
│  Task 3     │  Task 6     │  Task 9      │ Task 12  │
└─────────────┴─────────────┴──────────────┴──────────┘
```

### Task Card Display

**Information Shown:**
- Quote number
- Customer name
- Imprint number
- Type of work
- Quantity
- Colors (if applicable)
- Due date
- Assigned user (if assigned)
- Estimated runtime
- Overdue indicator

**Example:**
```
┌────────────────────────────┐
│ #Q-20250206-001            │
│ ABC Company                │
├────────────────────────────┤
│ Screen Printing            │
│ Qty: 100 | Colors: 3       │
│ Due: Feb 10 | 45 min       │
│ Assigned: John Doe         │
└────────────────────────────┘
```

### Task Detail Modal

**Full Details:**
- Complete task information
- Artwork preview
- All metadata
- Link to work order
- Action buttons

---

## Data Flow

```
Quote Approved
      ↓
[process_quote_approval() trigger]
      ↓
  Create Work Order
  (WO-20250206-00001)
      ↓
  For Each Imprint:
      ↓
  Extract Metadata
  • Type of work
  • Colors
  • Quantity
  • Estimated runtime
      ↓
  Determine Department
  • screen_printing
  • embroidery
  • dtg
  • vinyl
  • general
      ↓
  Create Scheduler Entry
  • All imprint details
  • Work order link
  • Production due date
      ↓
[auto_process_scheduler_entry() trigger]
      ↓
  Set Default Column
  (Unscheduled)
      ↓
  Check Auto-Assignment Rules
      ↓
  IF rule exists:
    Calculate Assignment
    • round_robin
    • least_loaded
    • skill_based
      ↓
    Assign to User
      ↓
  ELSE:
    Leave unassigned
      ↓
[Task Created]
      ↓
  Appears in Workflow Board
  Column: Unscheduled
  Assigned: (if auto-assigned)
      ↓
[User Actions]
      ↓
  • View in workflow board
  • Drag to different column
  • Manually assign/reassign
  • Start work (→ In Progress)
  • Complete (→ Complete)
      ↓
[Automatic Timing]
      ↓
  Moved to "In Progress"
  → started_at timestamp
      ↓
  Moved to "Complete"
  → completed_at timestamp
      ↓
[Production Complete]
      ↓
  • Task in Complete column
  • Timing recorded
  • Work order updated
```

---

## Frontend Integration

### SchedulerService

**Location:** `src/services/scheduler-service.ts`

**Key Methods:**
```typescript
// Get tasks with filtering
getTasks(filters?: {
  scheduler_column?: string;
  department?: string;
  type_of_work?: string;
  assigned_to?: string;
  start_date?: string;
  end_date?: string;
})

// Get grouped by column for workflow board
getTasksGroupedByColumn()

// Move task between columns
moveTaskToColumn(taskId: string, columnName: string)

// Assign/unassign tasks
assignTask(taskId: string, userId: string)
unassignTask(taskId: string)

// Track workflow
startTask(taskId: string)  // Moves to "In Progress"
completeTask(taskId: string, actualRuntime?: number)  // Moves to "Complete"

// Column management
getColumns()
createColumn(column)
updateColumn(columnId, updates)
deleteColumn(columnId)
reorderColumns(columnUpdates)

// Assignment rules
getAssignmentRules()
createAssignmentRule(rule)
updateAssignmentRule(ruleId, updates)
deleteAssignmentRule(ruleId)

// Utility methods
getTasksByWorkOrder(workOrderId)
getTasksByQuote(quoteId)
getMyTasks(userId)
getOverdueTasks()
getDashboardStats()
```

### SchedulerWorkflowBoard Component

**Location:** `src/components/production/SchedulerWorkflowBoard.tsx`

**Features:**
- Drag-and-drop task management
- Visual workflow board
- Task detail modal
- Real-time updates
- Overdue highlighting
- Column-based organization

**Usage:**
```tsx
import { SchedulerWorkflowBoard } from './components/production/SchedulerWorkflowBoard';

<SchedulerWorkflowBoard />
```

---

## Configuration

### Setting Up Default Columns

Default columns are automatically created for new companies:

```sql
INSERT INTO scheduler_columns (
  company_id,
  column_name,
  column_order,
  color,
  is_default,
  is_completion_column
) VALUES
  (company_id, 'Unscheduled', 1, '#6b7280', true, false),
  (company_id, 'Scheduled', 2, '#3b82f6', false, false),
  (company_id, 'In Progress', 3, '#f59e0b', false, false),
  (company_id, 'Complete', 4, '#10b981', false, true);
```

**Customization:**
- Add more columns
- Rename columns
- Change colors
- Reorder columns
- Set different default column
- Mark multiple completion columns

### Setting Up Auto-Assignment

**Create Assignment Rule:**
```typescript
await SchedulerService.createAssignmentRule({
  company_id: companyId,
  department: 'screen_printing',
  type_of_work: 'Screen Printing',
  assignment_mode: 'round_robin',
  eligible_users: [userId1, userId2, userId3],
  is_active: true
});
```

**Assignment Modes:**
- `round_robin` - Fair distribution over 24 hours
- `least_loaded` - Prevent user overload
- `skill_based` - Match skills (future)
- `manual` - No automation

**Best Practices:**
1. Create rules per department
2. Specify eligible users carefully
3. Use round_robin for balanced workload
4. Use least_loaded for varying complexity
5. Test rules before activating

---

## Tracking Production Progress

### Workflow Stages

**1. Unscheduled**
- New tasks appear here
- Awaiting scheduling
- Can be assigned

**2. Scheduled**
- Planned for production
- Timeline set
- Resources allocated

**3. In Progress**
- Work actively being done
- `started_at` timestamp recorded
- Tracks duration

**4. Complete**
- Work finished
- `completed_at` timestamp recorded
- `actual_runtime` can be recorded

### Automatic Timing

**Start Tracking:**
```typescript
// When moved to "In Progress"
await SchedulerService.startTask(taskId);
// Sets: started_at = NOW()
```

**Complete Tracking:**
```typescript
// When moved to "Complete"
await SchedulerService.completeTask(taskId, actualMinutes);
// Sets: completed_at = NOW(), actual_runtime = actualMinutes
```

### Performance Metrics

**Available Data:**
- Estimated vs. Actual runtime
- Time in each column
- Overdue tasks
- Tasks per user
- Tasks per department
- Completion rate
- Average cycle time

---

## Dashboard Statistics

```typescript
const { data: stats } = await SchedulerService.getDashboardStats();

// Returns:
{
  total: 150,
  unscheduled: 45,
  in_progress: 30,
  completed: 60,
  overdue: 15,
  by_department: {
    screen_printing: 80,
    embroidery: 40,
    dtg: 20,
    vinyl: 10
  }
}
```

---

## User Experience

### For Production Managers

1. **Open Scheduler Workflow Board**
2. **View All Tasks by Column**
   - Unscheduled tasks need assignment
   - Scheduled tasks have timeline
   - In Progress shows active work
   - Complete shows finished tasks
3. **Drag Tasks Between Columns**
   - Move to schedule
   - Prioritize work
   - Track completion
4. **Assign/Reassign Tasks**
   - Manual assignment if needed
   - Override auto-assignments
   - Balance workload
5. **Monitor Progress**
   - Check overdue tasks (red)
   - View task details
   - Track timing

### For Production Workers

1. **View "My Tasks"**
   - Filter by assigned_to
   - See personal workload
2. **Start Working**
   - Drag task to "In Progress"
   - Automatic timing starts
3. **Complete Work**
   - Drag to "Complete"
   - Record actual runtime
4. **Get New Assignments**
   - Auto-assigned based on rules
   - Fair distribution

### For Customers (Indirect)

1. **Quote Approval**
   - Approves quote online
2. **Automatic Scheduling**
   - Tasks created instantly
   - Production planned
3. **Progress Tracking**
   - (Future: Customer portal showing progress)
4. **On-Time Delivery**
   - Efficient production tracking
   - Better deadline management

---

## Integration Points

### With Quote System
- Triggers on quote approval
- Extracts imprint data
- Links to original quote
- Maintains quote_id reference

### With Work Order System
- Links via work_order_id
- Shared production due dates
- Connected workflow
- Unified tracking

### With Imprint System
- Links via imprint_id
- Artwork thumbnails
- Type of work
- Color information
- Runtime estimates

### With User Management
- Auto-assignment to users
- Task ownership
- Workload distribution
- Skill matching (future)

---

## Security & Permissions

### Row Level Security
All scheduler tables use company-based isolation:

**Scheduler Entries:**
```sql
USING (
  company_id IN (
    SELECT company_id
    FROM user_profiles
    WHERE id = auth.uid()
  )
)
```

**Scheduler Columns:**
```sql
USING (company_id = get_user_company_id(auth.uid()))
```

**Assignment Rules:**
```sql
USING (
  company_id = get_user_company_id(auth.uid())
  AND (
    is_public = true OR
    get_user_role(auth.uid()) = 'super_admin'
  )
)
```

### Permissions
- **View:** All authenticated users in company
- **Create/Update Tasks:** Production staff, managers, admins
- **Manage Columns:** Super admins only
- **Manage Rules:** Super admins only
- **Assign Tasks:** Managers and admins

---

## Testing

### Test Scenario 1: Auto-Creation on Approval
1. Create quote with multiple imprints
2. Set different types of work
3. Add color information
4. Approve quote
5. Verify:
   - Scheduler entries created (one per imprint)
   - All metadata populated
   - work_order_id linked
   - Department auto-determined
   - Placed in "Unscheduled" column

### Test Scenario 2: Auto-Assignment
1. Create assignment rule for screen_printing
2. Set mode to round_robin
3. Add 3 eligible users
4. Approve quote with screen printing
5. Verify:
   - Task auto-assigned to user
   - Assignment follows round_robin logic
   - Subsequent tasks distributed evenly

### Test Scenario 3: Workflow Board Interaction
1. Open workflow board
2. Drag task from "Unscheduled" to "In Progress"
3. Verify:
   - Task moves visually
   - started_at timestamp set
   - Database updated
4. Drag task to "Complete"
5. Verify:
   - Task moves to completion column
   - completed_at timestamp set

### Test Scenario 4: Manual Assignment
1. Open task detail
2. Assign to specific user
3. Verify:
   - Assignment recorded
   - User can see in "My Tasks"
   - Appears in their workload

### Verification Queries

```sql
-- Check scheduler entries created
SELECT
  pse.*,
  wo.work_order_number,
  qi.type_of_work,
  qi.thread_ink_color
FROM production_schedule_entries pse
LEFT JOIN work_orders wo ON pse.work_order_id = wo.id
LEFT JOIN quote_imprints qi ON pse.imprint_id = qi.id
WHERE pse.quote_id = ?
ORDER BY pse.imprint_number;

-- Check auto-assignment distribution
SELECT
  assigned_to,
  COUNT(*) as task_count,
  department
FROM production_schedule_entries
WHERE company_id = ?
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY assigned_to, department
ORDER BY department, task_count;

-- Check workflow timing
SELECT
  id,
  quote_number,
  scheduler_column,
  started_at,
  completed_at,
  estimated_runtime,
  actual_runtime,
  EXTRACT(EPOCH FROM (completed_at - started_at))/60 as actual_minutes
FROM production_schedule_entries
WHERE completed_at IS NOT NULL
  AND started_at IS NOT NULL
ORDER BY completed_at DESC;

-- Check overdue tasks
SELECT
  pse.*,
  CURRENT_DATE - pse.production_due_date::date as days_overdue
FROM production_schedule_entries pse
WHERE pse.production_due_date < CURRENT_DATE
  AND pse.scheduler_column != 'Complete'
ORDER BY days_overdue DESC;
```

---

## Common Issues & Solutions

### Issue: Tasks not auto-assigned
**Checks:**
1. Verify assignment rule exists
2. Check rule is active
3. Verify eligible_users populated
4. Check department matches rule
5. Check type_of_work matches rule

**Solution:**
```sql
-- Check for matching rule
SELECT * FROM scheduler_assignments
WHERE company_id = ?
  AND department = ?
  AND type_of_work = ?
  AND is_active = true;

-- If missing, create rule
INSERT INTO scheduler_assignments ...
```

### Issue: Tasks appear in wrong column
**Check:**
- Default column configuration
- Column name spelling

**Solution:**
```sql
-- Verify default column
SELECT * FROM scheduler_columns
WHERE company_id = ?
  AND is_default = true;

-- Update if needed
UPDATE production_schedule_entries
SET scheduler_column = 'Unscheduled'
WHERE scheduler_column IS NULL OR scheduler_column = '';
```

### Issue: Timing not recorded
**Check:**
- Column names match exactly
- Task actually moved through workflow

**Solution:**
```sql
-- Manual timing update if needed
UPDATE production_schedule_entries
SET
  started_at = '2025-02-06 09:00:00',
  completed_at = '2025-02-06 11:30:00',
  actual_runtime = 150
WHERE id = ?;
```

### Issue: Duplicate tasks created
**Check:**
- Quote only approved once
- Trigger not firing multiple times

**Solution:**
```sql
-- Check for duplicates
SELECT quote_id, imprint_id, COUNT(*)
FROM production_schedule_entries
GROUP BY quote_id, imprint_id
HAVING COUNT(*) > 1;

-- Delete duplicates (keep newest)
DELETE FROM production_schedule_entries
WHERE id NOT IN (
  SELECT MAX(id)
  FROM production_schedule_entries
  GROUP BY quote_id, imprint_id
);
```

---

## Best Practices

### Scheduler Configuration
1. **Define Clear Columns:** Use names that match your workflow
2. **Limit Columns:** 4-6 columns ideal (too many = confusion)
3. **Mark Completion:** Set is_completion_column correctly
4. **Color Code:** Use intuitive colors (gray=waiting, green=done)

### Auto-Assignment Rules
1. **Start Simple:** Begin with manual, add automation gradually
2. **Test Thoroughly:** Verify assignment logic before activating
3. **Balance Workload:** Use round_robin or least_loaded
4. **Monitor Results:** Check distribution regularly
5. **Adjust Eligible Users:** Update as team changes

### Task Management
1. **Review Daily:** Check unscheduled tasks each morning
2. **Prioritize Actively:** Use priority_order for urgent tasks
3. **Track Overdue:** Address red tasks immediately
4. **Record Actuals:** Enter actual_runtime for better estimates
5. **Clean Complete:** Archive or clear old completed tasks

### Performance Optimization
1. **Index Properly:** Indexes on common filters
2. **Archive Old Tasks:** Move completed tasks after time period
3. **Limit Date Ranges:** Filter by date for large datasets
4. **Cache Counts:** Store summary stats if querying often

---

## Future Enhancements

Potential additions:
1. Skill-based assignment matching
2. Resource capacity planning
3. Machine/station scheduling
4. Time tracking with clock in/out
5. Mobile app for production floor
6. Customer portal showing progress
7. Automatic notifications
8. Gantt chart view
9. Predictive completion dates
10. Integration with equipment IoT

---

## Summary

The Scheduler Integration Automation provides:

**Automatic Creation:**
- One task per imprint
- Complete metadata (colors, runtime, department)
- Work order linkage
- Auto-placement in "Unscheduled"

**Auto-Assignment:**
- Configurable rules per department
- Multiple assignment modes
- Fair workload distribution
- Skill-based matching (future)

**Workflow Board:**
- Visual drag-and-drop interface
- Color-coded columns
- Real-time updates
- Overdue indicators
- Task detail modal

**Production Tracking:**
- Automatic timing
- Progress monitoring
- Performance metrics
- Dashboard statistics

**Complete Integration:**
- Quotes → Work Orders → Scheduler Tasks
- Unified production workflow
- Single source of truth
- End-to-end visibility

This automation transforms quote approval into instant, organized production scheduling with zero manual data entry, intelligent task distribution, and complete visibility into production progress from start to finish.
