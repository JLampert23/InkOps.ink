export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  total: number;
  subtotal: number;
  tax: number;
  discount?: number;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  items: QuoteItem[];
  notes?: string;
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Proof {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  version: number;
  artworkUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  comments: ProofComment[];
}

export interface ProofComment {
  id: string;
  proofId: string;
  userId: string;
  userName: string;
  comment: string;
  createdAt: string;
}

export interface ProductionInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  customerName: string;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  amountPaid: number;
  amountDue: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  items: InvoiceItem[];
  paymentHistory: Payment[];
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: 'stripe' | 'cash' | 'check' | 'bank_transfer' | 'other';
  stripePaymentId?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  executionCount: number;
}

export interface AutomationTrigger {
  type: 'quote_approved' | 'quote_rejected' | 'invoice_paid' | 'invoice_overdue' | 'status_changed' | 'proof_approved' | 'proof_rejected';
  filters?: Record<string, any>;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';
  value: any;
}

export interface AutomationAction {
  type: 'send_email' | 'update_status' | 'create_task' | 'send_notification' | 'webhook' | 'update_field';
  config: Record<string, any>;
}

export interface ProductionStage {
  id: string;
  name: string;
  color: string;
  icon?: string;
  order: number;
  isDefault?: boolean;
  automations?: string[];
}

export interface ProductionOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  stageId: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assignedTo?: string;
  assignedToName?: string;
  tags: string[];
  total: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  notes?: string;
}

export interface WorkflowPreset {
  id: string;
  name: string;
  description?: string;
  stages: ProductionStage[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StatusChangeLog {
  id: string;
  entityType: 'quote' | 'invoice' | 'order' | 'proof';
  entityId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  changedByName: string;
  reason?: string;
  createdAt: string;
}
