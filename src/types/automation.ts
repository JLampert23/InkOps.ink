export type TriggerType =
  | 'invoice_created'
  | 'invoice_status_changed'
  | 'invoice_overdue'
  | 'payment_received'
  | 'payment_balance_matched'
  | 'task_created'
  | 'task_status_changed'
  | 'quote_approved'
  | 'artwork_uploaded'
  | 'customer_created';

export type ConditionOperator = 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'within_days';

export type ConditionField =
  | 'invoice_status'
  | 'amount_outstanding'
  | 'payment_method'
  | 'due_date'
  | 'task_type'
  | 'customer_email'
  | 'order_total'
  | 'decoration_type';

export type ActionType =
  | 'send_email'
  | 'update_invoice_status'
  | 'update_task_status'
  | 'assign_task'
  | 'add_invoice_note'
  | 'add_task_note'
  | 'send_report'
  | 'trigger_webhook'
  | 'notify_user';

export type LogicOperator = 'AND' | 'OR';

export interface TriggerConfig {
  type: TriggerType;
  config?: Record<string, any>;
}

export interface Condition {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: any;
  logicOperator?: LogicOperator;
}

export interface Action {
  id: string;
  type: ActionType;
  config: Record<string, any>;
  order: number;
}

export interface SchedulingConfig {
  type: 'immediate' | 'delayed' | 'scheduled';
  delay?: number;
  delayUnit?: 'minutes' | 'hours' | 'days';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
  timezone?: string;
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  conditions: Condition[];
  actions: Action[];
  scheduling: SchedulingConfig;
  is_enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  trigger_event: Record<string, any>;
  executed_actions: Action[];
  status: 'success' | 'failure' | 'partial';
  error_message?: string;
  executed_at: string;
  execution_time_ms: number;
}

export interface TriggerOption {
  value: TriggerType;
  label: string;
  description: string;
  icon: string;
}

export interface ConditionOption {
  value: ConditionField;
  label: string;
  operators: ConditionOperator[];
  valueType: 'text' | 'number' | 'select' | 'date';
  options?: { value: string; label: string }[];
}

export interface ActionOption {
  value: ActionType;
  label: string;
  description: string;
  icon: string;
  configFields: {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'number';
    required?: boolean;
    options?: { value: string; label: string }[];
  }[];
}
