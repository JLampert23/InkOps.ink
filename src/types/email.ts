export type EmailTemplate =
  | 'invoice-reminder'
  | 'payment-received'
  | 'overdue-notice'
  | 'welcome'
  | 'custom';

export interface InvoiceReminderData {
  customerName: string;
  invoiceNumber: string;
  amountDue: string;
  dueDate: string;
  invoiceUrl?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
}

export interface PaymentReceivedData {
  customerName: string;
  invoiceNumber: string;
  paymentAmount: string;
  paymentDate: string;
  remainingBalance?: string;
  invoiceUrl?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
}

export interface OverdueNoticeData {
  customerName: string;
  invoiceNumber: string;
  amountDue: string;
  dueDate: string;
  daysOverdue: number;
  invoiceUrl?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
}

export interface WelcomeEmailData {
  customerName: string;
  dashboardUrl?: string;
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
}

export interface CustomEmailData {
  title?: string;
  message?: string;
  companyName?: string;
  [key: string]: any;
}

export type EmailTemplateData =
  | InvoiceReminderData
  | PaymentReceivedData
  | OverdueNoticeData
  | WelcomeEmailData
  | CustomEmailData;

export interface EmailAttachment {
  filename: string;
  content: string;
  type?: string;
}

export interface SendEmailRequest {
  to: string | string[];
  subject: string;
  template: EmailTemplate;
  data?: EmailTemplateData;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResponse {
  success: boolean;
  data?: {
    id: string;
    from: string;
    to: string[];
    created_at: string;
  };
  error?: string;
}
