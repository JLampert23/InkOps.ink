import { TriggerOption, ConditionOption, ActionOption } from '../../types/automation';

export const TRIGGER_OPTIONS: TriggerOption[] = [
  {
    value: 'approval_approved',
    label: 'If _____ approval is approved',
    description: 'Triggers when an approval is approved',
    icon: 'CheckCircle',
  },
  {
    value: 'approval_declined',
    label: 'If _____ approval is declined',
    description: 'Triggers when an approval is declined',
    icon: 'XCircle',
  },
  {
    value: 'approval_sent',
    label: 'If _____ approval is sent',
    description: 'Triggers when an approval request is sent',
    icon: 'Send',
  },
  {
    value: 'quote_invoice_paid_in_full',
    label: 'If a quote/invoice is paid in full',
    description: 'Triggers when a quote or invoice is paid in full',
    icon: 'DollarSign',
  },
  {
    value: 'status_changed',
    label: 'If status changed to _____',
    description: 'Triggers when a status changes to a specific value',
    icon: 'RefreshCw',
  },
  {
    value: 'imprints_added_to_scheduler',
    label: 'If the quote/invoice imprints are added to the Power Scheduler',
    description: 'Triggers when imprints are added to the Power Scheduler',
    icon: 'Calendar',
  },
  {
    value: 'work_step_status_changed',
    label: 'If a type of work step status is changed to _____',
    description: 'Triggers when a type of work step status changes',
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
    icon: 'Calendar',
  },
  {
    value: 'recurring_schedule_trigger',
    label: 'Recurring Schedule',
    description: 'Triggers on a recurring schedule',
    icon: 'CalendarDays',
  },
  {
    value: 'work_order_invoice_status_changed',
    label: 'If work order status changed to _____',
    description: 'Triggers when work order status changes',
    icon: 'DollarSign',
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
  {
    value: 'work_order_invoice_status',
    label: 'Work Order Invoice Status',
    operators: ['equals', 'not_equals'],
    valueType: 'text',
  },
  {
    value: 'work_order_status',
    label: 'Work Order Status',
    operators: ['equals', 'not_equals'],
    valueType: 'text',
  },
  {
    value: 'work_order_priority',
    label: 'Work Order Priority',
    operators: ['equals', 'not_equals'],
    valueType: 'select',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' },
    ],
  },
];

export const ACTION_OPTIONS: ActionOption[] = [
  {
    value: 'send_message',
    label: 'Send an email and/or text message to _____',
    description: 'Send an email or SMS message',
    icon: 'MessageCircle',
    configFields: [
      {
        name: 'message_type',
        label: 'Message Type',
        type: 'select',
        required: true,
        options: [
          { value: 'email', label: 'Email' },
          { value: 'sms', label: 'SMS' },
          { value: 'both', label: 'Both Email and SMS' },
        ],
      },
      { name: 'to', label: 'Recipient', type: 'text', required: true },
      { name: 'subject', label: 'Subject (Email only)', type: 'text', required: false },
      { name: 'message', label: 'Message', type: 'textarea', required: true },
    ],
  },
  {
    value: 'request_payment',
    label: 'Request payment for _____% amount',
    description: 'Send a payment request to customer',
    icon: 'DollarSign',
    configFields: [
      { name: 'invoice_id', label: 'Invoice ID', type: 'text', required: true },
      { name: 'percentage', label: 'Payment Percentage', type: 'number', required: true },
      { name: 'payment_method', label: 'Payment Method', type: 'select', options: [
        { value: 'stripe', label: 'Stripe' },
        { value: 'manual', label: 'Manual' },
      ]},
      { name: 'send_reminder', label: 'Send Reminder Email', type: 'checkbox', required: false },
    ],
  },
  {
    value: 'request_approval',
    label: 'Request _____ approval',
    description: 'Send an approval request',
    icon: 'CheckCircle',
    configFields: [
      { name: 'approval_type', label: 'Approval Type', type: 'text', required: true },
      { name: 'quote_id', label: 'Quote ID', type: 'text', required: true },
      { name: 'recipient_email', label: 'Recipient Email', type: 'text', required: true },
      { name: 'message', label: 'Custom Message', type: 'textarea', required: false },
    ],
  },
  {
    value: 'change_status',
    label: 'Change status to _____',
    description: 'Update status of an entity',
    icon: 'RefreshCw',
    configFields: [
      {
        name: 'entity_type',
        label: 'Entity Type',
        type: 'select',
        required: true,
        options: [
          { value: 'invoice', label: 'Invoice' },
          { value: 'quote', label: 'Quote' },
          { value: 'work_order', label: 'Work Order' },
          { value: 'purchase_order', label: 'Purchase Order' },
        ],
      },
      { name: 'entity_id_field', label: 'Entity ID Field', type: 'text', required: true },
      { name: 'new_status', label: 'New Status', type: 'text', required: true },
    ],
  },
  {
    value: 'add_imprints_to_scheduler',
    label: 'Add the quote/invoice imprints to the Power Scheduler',
    description: 'Schedule imprints for production in the Power Scheduler',
    icon: 'Calendar',
    configFields: [
      { name: 'work_order_id', label: 'Work Order ID', type: 'text', required: true },
      { name: 'scheduled_date', label: 'Scheduled Date', type: 'date', required: true },
      { name: 'station_id', label: 'Station ID (optional)', type: 'text', required: false },
    ],
  },
  {
    value: 'wait_duration',
    label: 'Wait Duration',
    description: 'Wait for a specified amount of time',
    icon: 'Clock',
    configFields: [
      {
        name: 'duration_unit',
        label: 'Duration Unit',
        type: 'select',
        required: true,
        options: [
          { value: 'minutes', label: 'Minutes' },
          { value: 'hours', label: 'Hours' },
          { value: 'days', label: 'Days' },
        ],
      },
      { name: 'duration_value', label: 'Duration Value', type: 'number', required: true },
    ],
  },
  {
    value: 'wait_until',
    label: 'Wait Until',
    description: 'Wait until a specific date/time',
    icon: 'CalendarDays',
    configFields: [
      { name: 'target_datetime', label: 'Target Date/Time', type: 'datetime', required: true },
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

export const TRIGGER_CONDITION_OPTIONS: Record<string, { label: string; options: Array<{ value: string; label: string }> }> = {
  approval_approved: {
    label: 'Approval Type',
    options: [
      { value: 'quote', label: 'Quote' },
      { value: 'proof', label: 'Proof' },
      { value: 'artwork', label: 'Artwork' },
      { value: 'mockup', label: 'Mockup' },
      { value: 'design', label: 'Design' },
    ],
  },
  approval_declined: {
    label: 'Approval Type',
    options: [
      { value: 'quote', label: 'Quote' },
      { value: 'proof', label: 'Proof' },
      { value: 'artwork', label: 'Artwork' },
      { value: 'mockup', label: 'Mockup' },
      { value: 'design', label: 'Design' },
    ],
  },
  approval_sent: {
    label: 'Approval Type',
    options: [
      { value: 'quote', label: 'Quote' },
      { value: 'proof', label: 'Proof' },
      { value: 'artwork', label: 'Artwork' },
      { value: 'mockup', label: 'Mockup' },
      { value: 'design', label: 'Design' },
    ],
  },
  status_changed: {
    label: 'Status',
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
  work_step_status_changed: {
    label: 'Type of Production',
    options: [], // Loaded dynamically in TriggerSelector from type_of_work_settings + work_type_workflows
  },
  work_order_invoice_status_changed: {
    label: 'Work Order Status',
    options: [],
  },
};
