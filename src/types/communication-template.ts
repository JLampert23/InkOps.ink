/**
 * Communication Template Types
 *
 * Type definitions for customizable email templates with short code support
 */

/**
 * Available template types for different communication scenarios
 */
export type TemplateType =
  | 'quote_email_default'
  | 'invoice_email_default'
  | 'invoice_reminder'
  | 'payment_confirmation'
  | 'approval_email'
  | 'internal_notification'
  | 'ar_report'
  | 'custom';

/**
 * Communication Template Database Model
 */
export interface CommunicationTemplate {
  id: string;
  company_id: string;
  template_type: TemplateType;
  template_name: string;
  subject_template: string;
  body_template: string;
  auto_attach_quote_link: boolean;
  auto_attach_pdf: boolean;
  auto_attach_mockups: boolean;
  auto_attach_terms: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Data required to create a new template
 */
export interface CreateTemplateRequest {
  template_type: TemplateType;
  template_name: string;
  subject_template: string;
  body_template: string;
  auto_attach_quote_link?: boolean;
  auto_attach_pdf?: boolean;
  auto_attach_mockups?: boolean;
  auto_attach_terms?: boolean;
  is_active?: boolean;
}

/**
 * Data for updating an existing template
 */
export interface UpdateTemplateRequest {
  template_name?: string;
  subject_template?: string;
  body_template?: string;
  auto_attach_quote_link?: boolean;
  auto_attach_pdf?: boolean;
  auto_attach_mockups?: boolean;
  auto_attach_terms?: boolean;
  is_active?: boolean;
}

/**
 * Template metadata for list views
 */
export interface TemplateListItem {
  id: string;
  template_type: TemplateType;
  template_name: string;
  is_active: boolean;
  updated_at: string;
}

/**
 * Template type metadata
 */
export interface TemplateTypeInfo {
  type: TemplateType;
  label: string;
  description: string;
  defaultSubject: string;
  defaultBody: string;
  supportedAttachments: {
    quoteLink: boolean;
    pdf: boolean;
    mockups: boolean;
    terms: boolean;
  };
}

/**
 * Template render request
 */
export interface RenderTemplateRequest {
  template_id: string;
  data: Record<string, any>;
}

/**
 * Rendered template output
 */
export interface RenderedTemplate {
  subject: string;
  body: string;
  attachments: {
    quote_link?: string;
    pdf?: boolean;
    mockups?: boolean;
    terms?: boolean;
  };
}

/**
 * Template validation result
 */
export interface TemplateValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  usedShortCodes: string[];
  missingShortCodes: string[];
}

/**
 * Template metadata describing available template types
 */
export const TEMPLATE_TYPE_METADATA: Record<TemplateType, TemplateTypeInfo> = {
  quote_email_default: {
    type: 'quote_email_default',
    label: 'Default Quote Email',
    description: 'Default template for sending quote approval emails to customers',
    defaultSubject: 'Quote {{quote_number}} for {{customer_company}}',
    defaultBody: '<p>Hi {{customer_first_name}},</p><p>Your quote {{quote_number}} is ready for review.</p>',
    supportedAttachments: {
      quoteLink: true,
      pdf: true,
      mockups: true,
      terms: true,
    },
  },
  invoice_email_default: {
    type: 'invoice_email_default',
    label: 'Default Invoice Email',
    description: 'Default template for sending invoices to customers',
    defaultSubject: 'Invoice {{invoice_number}} from {{company_name}}',
    defaultBody: '<p>Hi {{customer_first_name}},</p><p>Your invoice {{invoice_number}} is now available.</p>',
    supportedAttachments: {
      quoteLink: false,
      pdf: true,
      mockups: false,
      terms: true,
    },
  },
  invoice_reminder: {
    type: 'invoice_reminder',
    label: 'Invoice Reminder',
    description: 'Template for sending payment reminder emails for overdue invoices',
    defaultSubject: 'Payment Reminder: Invoice {{invoice_number}}',
    defaultBody: '<p>Hi {{customer_first_name}},</p><p>This is a friendly reminder that invoice {{invoice_number}} for {{invoice_balance}} is due.</p>',
    supportedAttachments: {
      quoteLink: false,
      pdf: true,
      mockups: false,
      terms: true,
    },
  },
  payment_confirmation: {
    type: 'payment_confirmation',
    label: 'Payment Confirmation',
    description: 'Template for confirming payment receipt',
    defaultSubject: 'Payment Received: {{payment_amount}}',
    defaultBody: '<p>Hi {{customer_first_name}},</p><p>We have received your payment of {{payment_amount}} for invoice {{invoice_number}}.</p>',
    supportedAttachments: {
      quoteLink: false,
      pdf: true,
      mockups: false,
      terms: false,
    },
  },
  approval_email: {
    type: 'approval_email',
    label: 'Approval Email',
    description: 'Template for requesting approval on quotes or designs',
    defaultSubject: 'Approval Required: {{quote_number}}',
    defaultBody: '<p>Hi {{customer_first_name}},</p><p>Please review and approve {{quote_number}}.</p>',
    supportedAttachments: {
      quoteLink: true,
      pdf: true,
      mockups: true,
      terms: false,
    },
  },
  internal_notification: {
    type: 'internal_notification',
    label: 'Internal Notification',
    description: 'Template for internal team notifications',
    defaultSubject: 'Internal: {{quote_number}} Status Update',
    defaultBody: '<p>Team,</p><p>Quote {{quote_number}} has been updated.</p>',
    supportedAttachments: {
      quoteLink: true,
      pdf: false,
      mockups: false,
      terms: false,
    },
  },
  ar_report: {
    type: 'ar_report',
    label: 'AR Report',
    description: 'Template for automated accounts receivable reports',
    defaultSubject: 'Accounts Receivable Report - {{current_date}}',
    defaultBody: '<p>AR Report for {{current_date}}</p>',
    supportedAttachments: {
      quoteLink: false,
      pdf: true,
      mockups: false,
      terms: false,
    },
  },
  custom: {
    type: 'custom',
    label: 'Custom Template',
    description: 'Custom template for specialized communication needs',
    defaultSubject: 'Message from {{company_name}}',
    defaultBody: '<p>Hi {{customer_first_name}},</p>',
    supportedAttachments: {
      quoteLink: false,
      pdf: false,
      mockups: false,
      terms: false,
    },
  },
};

/**
 * Helper function to get template type info
 */
export function getTemplateTypeInfo(type: TemplateType): TemplateTypeInfo {
  return TEMPLATE_TYPE_METADATA[type];
}

/**
 * Helper function to get all available template types
 */
export function getAllTemplateTypes(): TemplateType[] {
  return Object.keys(TEMPLATE_TYPE_METADATA) as TemplateType[];
}

/**
 * Helper function to validate template type
 */
export function isValidTemplateType(type: string): type is TemplateType {
  return type in TEMPLATE_TYPE_METADATA;
}
