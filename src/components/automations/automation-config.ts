import { TriggerOption, ConditionOption, ActionOption } from '../../types/automation';

export const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    value: 'invoice_created',
    label: 'New Invoice Created',
    description: 'Triggers when a new invoice is created in Printavo',
    icon: 'FileText',
  },
  {
    value: 'invoice_status_changed',
    label: 'Invoice Status Changed',
    description: 'Triggers when an invoice status changes',
    icon: 'RefreshCw',
  },
  {
    value: 'invoice_overdue',
    label: 'Invoice Becomes Overdue',
    description: 'Triggers when an invoice passes its due date',
    icon: 'AlertTriangle',
  },
  {
    value: 'payment_received',
    label: 'Payment Received',
    description: 'Triggers when a payment is recorded',
    icon: 'DollarSign',
  },
  {
    value: 'payment_balance_matched',
    label: 'Payment Matches Balance',
    description: 'Triggers when payment amount equals invoice balance',
    icon: 'CheckCircle',
  },
  {
    value: 'task_created',
    label: 'New Task Created',
    description: 'Triggers when a new task is created',
    icon: 'ListTodo',
  },
  {
    value: 'task_status_changed',
    label: 'Task Status Changed',
    description: 'Triggers when a task status changes',
    icon: 'ClipboardCheck',
  },
  {
    value: 'quote_approved',
    label: 'Quote Approved',
    description: 'Triggers when a quote is approved',
    icon: 'ThumbsUp',
  },
  {
    value: 'artwork_uploaded',
    label: 'Artwork Uploaded',
    description: 'Triggers when artwork is uploaded to an order',
    icon: 'Image',
  },
  {
    value: 'customer_created',
    label: 'New Customer Created',
    description: 'Triggers when a new customer is added',
    icon: 'Users',
  },
  {
    value: 'approval_approved',
    label: 'Approval Approved',
    description: 'Triggers when an approval is approved',
    icon: 'CheckCircle',
  },
  {
    value: 'approval_declined',
    label: 'Approval Declined',
    description: 'Triggers when an approval is declined',
    icon: 'XCircle',
  },
  {
    value: 'approval_sent',
    label: 'Approval Sent',
    description: 'Triggers when an approval request is sent',
    icon: 'Send',
  },
  {
    value: 'quote_invoice_paid_in_full',
    label: 'Quote Invoice Paid in Full',
    description: 'Triggers when a quote invoice is paid in full',
    icon: 'DollarSign',
  },
  {
    value: 'status_changed',
    label: 'Status Changed',
    description: 'Triggers when a status changes',
    icon: 'RefreshCw',
  },
  {
    value: 'preset_task_list_completed',
    label: 'Preset Task List Completed',
    description: 'Triggers when a preset task list is completed',
    icon: 'ListChecks',
  },
  {
    value: 'imprints_added_to_scheduler',
    label: 'Imprints Added to Scheduler',
    description: 'Triggers when imprints are added to the scheduler',
    icon: 'Calendar',
  },
  {
    value: 'work_step_status_changed',
    label: 'Work Step Status Changed',
    description: 'Triggers when a work step status changes',
    icon: 'GitBranch',
  },
  {
    value: 'time_delay_trigger',
    label: 'Time Delay',
    description: 'Triggers after a specified time delay',
    icon: 'Clock',
  },
  {
    value: 'scheduled_datetime_trigger',
    label: 'Scheduled Date/Time',
    description: 'Triggers at a specific date and time',
    icon: 'CalendarClock',
  },
  {
    value: 'recurring_schedule_trigger',
    label: 'Recurring Schedule',
    description: 'Triggers on a recurring schedule',
    icon: 'CalendarDays',
  },
];

export const CONDITION_OPTIONS: ConditionOption[] = [
  {
    value: 'invoice_status',
    label: 'Invoice Status',
    operators: ['equals', 'not_equals'],
    valueType: 'select',
    options: [
      { value: 'Quote', label: 'Quote' },
      { value: 'Approved', label: 'Approved' },
      { value: 'In Production', label: 'In Production' },
      { value: 'Ready', label: 'Ready' },
      { value: 'Complete', label: 'Complete' },
      { value: 'Invoiced', label: 'Invoiced' },
      { value: 'Paid', label: 'Paid' },
      { value: 'Cancelled', label: 'Cancelled' },
    ],
  },
  {
    value: 'amount_outstanding',
    label: 'Amount Outstanding',
    operators: ['equals', 'not_equals', 'greater_than', 'less_than'],
    valueType: 'number',
  },
  {
    value: 'payment_method',
    label: 'Payment Method',
    operators: ['equals', 'not_equals'],
    valueType: 'select',
    options: [
      { value: 'card', label: 'Card' },
      { value: 'cash', label: 'Cash' },
      { value: 'check', label: 'Check' },
      { value: 'ach', label: 'ACH' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    value: 'due_date',
    label: 'Due Date',
    operators: ['within_days'],
    valueType: 'number',
  },
  {
    value: 'task_type',
    label: 'Task Type',
    operators: ['equals', 'not_equals'],
    valueType: 'select',
    options: [
      { value: 'art', label: 'Art' },
      { value: 'screen_room', label: 'Screen Room' },
      { value: 'press', label: 'Press' },
      { value: 'embroidery', label: 'Embroidery' },
      { value: 'qa', label: 'QA' },
      { value: 'shipping', label: 'Shipping' },
    ],
  },
  {
    value: 'customer_email',
    label: 'Customer Email',
    operators: ['contains', 'not_contains', 'equals'],
    valueType: 'text',
  },
  {
    value: 'order_total',
    label: 'Order Total',
    operators: ['greater_than', 'less_than', 'equals'],
    valueType: 'number',
  },
  {
    value: 'decoration_type',
    label: 'Decoration Type',
    operators: ['equals', 'not_equals'],
    valueType: 'select',
    options: [
      { value: 'screen_print', label: 'Screen Print' },
      { value: 'embroidery', label: 'Embroidery' },
      { value: 'dtg', label: 'DTG' },
      { value: 'heat_transfer', label: 'Heat Transfer' },
      { value: 'sublimation', label: 'Sublimation' },
    ],
  },
];

export const ACTION_OPTIONS: ActionOption[] = [
  {
    value: 'send_email',
    label: 'Send Email',
    description: 'Send an email via Resend',
    icon: 'Mail',
    configFields: [
      { name: 'to', label: 'To Email', type: 'text', required: true },
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'body', label: 'Email Body', type: 'textarea', required: true },
    ],
  },
  {
    value: 'update_invoice_status',
    label: 'Update Invoice Status',
    description: 'Change the status of an invoice',
    icon: 'Edit',
    configFields: [
      {
        name: 'status',
        label: 'New Status',
        type: 'select',
        required: true,
        options: [
          { value: 'Quote', label: 'Quote' },
          { value: 'Approved', label: 'Approved' },
          { value: 'In Production', label: 'In Production' },
          { value: 'Ready', label: 'Ready' },
          { value: 'Complete', label: 'Complete' },
          { value: 'Invoiced', label: 'Invoiced' },
          { value: 'Paid', label: 'Paid' },
        ],
      },
    ],
  },
  {
    value: 'update_task_status',
    label: 'Update Task Status',
    description: 'Change the status of a task',
    icon: 'CheckSquare',
    configFields: [
      {
        name: 'status',
        label: 'New Status',
        type: 'select',
        required: true,
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
        ],
      },
    ],
  },
  {
    value: 'assign_task',
    label: 'Assign Task to User',
    description: 'Assign a task to a specific user',
    icon: 'UserPlus',
    configFields: [
      { name: 'user_id', label: 'User ID', type: 'text', required: true },
    ],
  },
  {
    value: 'add_invoice_note',
    label: 'Add Invoice Note',
    description: 'Add an internal note to the invoice',
    icon: 'MessageSquare',
    configFields: [
      { name: 'note', label: 'Note Text', type: 'textarea', required: true },
    ],
  },
  {
    value: 'add_task_note',
    label: 'Add Task Note',
    description: 'Add a note to a task',
    icon: 'FileText',
    configFields: [
      { name: 'note', label: 'Note Text', type: 'textarea', required: true },
    ],
  },
  {
    value: 'send_report',
    label: 'Send Report',
    description: 'Generate and send a PDF or CSV report',
    icon: 'FileDown',
    configFields: [
      {
        name: 'format',
        label: 'Format',
        type: 'select',
        required: true,
        options: [
          { value: 'pdf', label: 'PDF' },
          { value: 'csv', label: 'CSV' },
        ],
      },
      { name: 'recipient', label: 'Send To', type: 'text', required: true },
    ],
  },
  {
    value: 'trigger_webhook',
    label: 'Trigger Webhook',
    description: 'Send data to an external webhook URL',
    icon: 'Webhook',
    configFields: [
      { name: 'url', label: 'Webhook URL', type: 'text', required: true },
      { name: 'method', label: 'HTTP Method', type: 'select', options: [
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
      ]},
    ],
  },
  {
    value: 'notify_user',
    label: 'Notify User',
    description: 'Send an in-app notification',
    icon: 'Bell',
    configFields: [
      { name: 'user_id', label: 'User ID', type: 'text', required: true },
      { name: 'message', label: 'Notification Message', type: 'text', required: true },
    ],
  },
];

export const OPERATOR_LABELS: Record<string, string> = {
  equals: 'Equals',
  not_equals: 'Does Not Equal',
  greater_than: 'Greater Than',
  less_than: 'Less Than',
  contains: 'Contains',
  not_contains: 'Does Not Contain',
  within_days: 'Within (days)',
};
