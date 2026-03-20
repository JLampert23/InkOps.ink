# Invoice Status Automation Guide

## Overview

The invoice status automation system automatically triggers email notifications (and other actions) when work order invoice statuses change. This guide explains how the system works and how to use it.

## Architecture

The automation system consists of several components:

### 1. Database Trigger
- **Location**: `supabase/migrations/20260320170000_add_invoice_status_change_automation_trigger.sql`
- **Purpose**: Detects when a work order's `custom_invoice_status_id` changes
- **Action**: Automatically creates a record in the `automation_queue` table with all relevant invoice/work order data

### 2. Automation Queue
- **Table**: `automation_queue`
- **Purpose**: Stores pending automation events to be processed
- **Fields**:
  - `trigger_type`: The type of event (e.g., 'work_order_invoice_status_changed')
  - `event_data`: JSON object containing invoice details, customer info, old/new status, etc.
  - `status`: 'pending', 'processing', 'completed', or 'failed'
  - `attempts`: Number of times this automation has been attempted
  - `max_attempts`: Maximum retry attempts (default: 3)

### 3. Automation Processing
- **Edge Function**: `supabase/functions/process-automation-queue/index.ts`
- **Trigger**: Runs every minute via cron job
- **Process**:
  1. Fetches pending automation queue items
  2. For each item, finds all enabled automations matching the trigger type
  3. Evaluates conditions for each automation
  4. Executes actions (send email, send SMS, change status, etc.)
  5. Logs results to `automation_logs` table
  6. Marks queue item as completed or failed

### 4. Automation Engine
- **Service**: `src/services/automation-engine-service.ts`
- **Purpose**: Client-side service for managing automations
- **Features**:
  - Create/update/delete automation rules
  - Execute actions with variable replacement (e.g., `{{customer_name}}`, `{{new_status}}`)
  - Support for multiple action types (email, SMS, status changes, etc.)

## How to Use

### Step 1: Create an Automation

1. Navigate to the Automations dashboard in your app
2. Click "Create New Automation"
3. Configure the automation:
   - **Trigger**: Select "If work order status changed to _____"
   - **Trigger Value**: Choose the status that triggers the automation (or leave blank to trigger on any status change)
   - **Conditions** (optional): Add conditions like "only if customer_email is not empty"
   - **Actions**: Add one or more actions:
     - **Send Email**: Configure recipient, subject, and message
     - **Send SMS**: Configure phone number and message
     - **Change Status**: Update another entity's status
     - etc.

### Step 2: Use Variables in Messages

You can use the following variables in your email subject, body, or SMS messages:

**Work Order Variables:**
- `{{work_order_id}}` - Work order UUID
- `{{work_order_number}}` - Work order number
- `{{work_order_status}}` - Current work order status
- `{{priority}}` - Work order priority
- `{{production_due_date}}` - Production due date
- `{{customer_due_date}}` - Customer due date
- `{{total_quantity}}` - Total quantity

**Status Variables:**
- `{{old_status}}` - Previous invoice status name
- `{{new_status}}` - New invoice status name
- `{{old_status_id}}` - Previous status UUID
- `{{new_status_id}}` - New status UUID

**Customer Variables:**
- `{{customer_id}}` - Customer UUID
- `{{customer_name}}` - Customer name
- `{{customer_email}}` - Customer email

**Timestamp:**
- `{{changed_at}}` - When the status changed

### Example Automation

**Trigger**: Work order invoice status changed to "Ready for Pickup"

**Conditions**:
- `customer_email` is not empty

**Actions**:
1. Send Email
   - To: `{{customer_email}}`
   - Subject: `Your order {{work_order_number}} is ready for pickup!`
   - Message:
     ```
     Hi {{customer_name}},

     Great news! Your order {{work_order_number}} is now ready for pickup.

     Please stop by at your earliest convenience.

     Thank you!
     ```

## How Status Changes Trigger Automations

1. **User Updates Status**: When a user changes a work order's invoice status in the UI
2. **Database Trigger Fires**: The `trigger_work_order_invoice_status_automation` trigger detects the change
3. **Queue Entry Created**: A new record is inserted into `automation_queue` with:
   - All work order details
   - Customer information
   - Old and new status
   - Timestamp
4. **Cron Job Processes Queue**: Every minute, the `process-automation-queue` function runs
5. **Automations Executed**: The function:
   - Finds all enabled automations matching the trigger type
   - Checks if conditions are met
   - Executes configured actions (send emails, etc.)
   - Logs results
6. **Queue Item Completed**: The queue item is marked as completed or failed

## Monitoring & Troubleshooting

### View Automation Logs
Check the `automation_logs` table to see execution history:
```sql
SELECT
  executed_at,
  automation_id,
  trigger_type,
  status,
  error_message,
  executed_actions
FROM automation_logs
ORDER BY executed_at DESC
LIMIT 50;
```

### View Queue Status
Check pending and failed queue items:
```sql
SELECT *
FROM automation_queue
WHERE status IN ('pending', 'failed')
ORDER BY created_at DESC;
```

### Common Issues

**Emails not sending:**
- Check that Resend credentials are configured in company_settings
- Verify customer has a valid email address
- Check automation_logs for error messages

**Automation not triggering:**
- Verify the automation is enabled (`is_enabled = true`)
- Check that the trigger type matches (`work_order_invoice_status_changed`)
- Verify conditions are being met
- Check automation_queue to see if events are being created

**Actions failing:**
- Check automation_logs for specific error messages
- Verify variable names are correct (e.g., `{{customer_email}}` not `{{email}}`)
- Ensure email templates are valid HTML

## Technical Details

### Event Data Structure

When a work order invoice status changes, the event data looks like:
```json
{
  "work_order_id": "uuid",
  "work_order_number": "WO-12345",
  "customer_id": "uuid",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "quote_id": "uuid",
  "old_status_id": "uuid-or-null",
  "new_status_id": "uuid",
  "old_status": "In Production",
  "new_status": "Ready for Pickup",
  "work_order_status": "active",
  "priority": "high",
  "production_due_date": "2024-03-25",
  "customer_due_date": "2024-03-26",
  "total_quantity": 100,
  "changed_at": "2024-03-20T12:00:00Z"
}
```

### Variable Replacement

The automation engine replaces variables using the pattern `{{variable_name}}`:

```typescript
replaceVariables("Hi {{customer_name}}, your order {{work_order_number}} is ready!", eventData)
// Result: "Hi John Doe, your order WO-12345 is ready!"
```

### Retry Logic

If an automation fails:
- It will retry up to 3 times (configurable via `max_attempts`)
- Each retry waits 5 minutes
- After max attempts, the queue item is marked as 'failed'
- Failed items can be manually retried by setting status back to 'pending'

## Future Enhancements

Potential improvements to the system:
- Support for more trigger types (quote approved, payment received, etc.)
- Delay/schedule actions (wait 1 day before sending reminder)
- Conditional branching (if/else logic)
- Integration with Printavo API for creating tasks
- Support for email templates with rich formatting
- Batch processing for multiple status changes
- A/B testing for different message variations
