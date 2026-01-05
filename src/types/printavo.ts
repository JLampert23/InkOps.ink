export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  customer?: {
    id: string;
    companyName?: string;
  };
}

export interface Customer {
  id: string;
  companyName?: string;
  primaryContact?: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
  };
  timestamps?: {
    createdAt: string;
  };
}

export interface Status {
  name: string;
}

export interface LineItem {
  id: string;
  description: string;
  items: number;
  price: number;
}

export interface LineItemGroup {
  id: string;
  lineItems: {
    edges: Array<{
      node: LineItem;
    }>;
  };
}

export interface Payment {
  id: string;
  amount: number;
  transactionDate?: string;
  paymentMethod?: string;
  processor?: string;
  processorName?: string;
  isPrintavoPayment?: boolean;
  timestamps?: {
    createdAt: string;
  };
}

export interface Fee {
  id: string;
  description?: string;
  amount: number;
}

export interface Invoice {
  id: string;
  visualId?: string;
  status: Status;
  createdAt: string;
  invoiceAt?: string;
  dueAt?: string;
  total?: number;
  subtotal?: number;
  salesTaxAmount?: number;
  paidInFull?: boolean;
  amountPaid?: number;
  amountOutstanding?: number;
  contact?: Contact;
  lineItemGroups?: {
    edges: Array<{
      node: LineItemGroup;
    }>;
  };
  transactions?: {
    edges: Array<{
      node: Payment;
    }>;
  };
  fees?: {
    edges: Array<{
      node: Fee;
    }>;
  };
}

export interface Estimate {
  id: string;
  visualId?: string;
  total?: number;
  subtotal?: number;
  salesTaxAmount?: number;
  status: Status;
  createdAt: string;
  contact?: Contact;
  lineItemGroups?: {
    edges: Array<{
      node: LineItemGroup;
    }>;
  };
}

export interface Task {
  id: string;
  name: string;
  dueAt?: string;
  completedAt?: string;
  order?: {
    id: string;
    visualId?: string;
  };
}

export interface PaymentWithInvoice extends Payment {
  transactedFor?: {
    id: string;
    visualId?: string;
    contact?: Contact;
  };
}
