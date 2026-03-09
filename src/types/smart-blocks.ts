export interface SmartBlock {
  id: string;
  name: string;
  description: string;
  category: 'greeting' | 'summary' | 'action' | 'signature' | 'layout';
  htmlTemplate: string;
  requiredShortCodes: string[];
  icon: string;
}

export const SMART_BLOCKS: SmartBlock[] = [
  {
    id: 'greeting',
    name: 'Greeting',
    description: 'Personalized customer greeting',
    category: 'greeting',
    icon: 'user',
    htmlTemplate: '<p>Hi {{customer_first_name}},</p>',
    requiredShortCodes: ['customer_first_name'],
  },
  {
    id: 'invoice_summary',
    name: 'Invoice Summary',
    description: 'Invoice details with number, balance, and due date',
    category: 'summary',
    icon: 'receipt',
    htmlTemplate: `<div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
  <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 18px; font-weight: 600;">Invoice Summary</h3>
  <p style="margin: 4px 0;"><strong>Invoice Number:</strong> {{invoice_number}}</p>
  <p style="margin: 4px 0;"><strong>Balance Due:</strong> {{invoice_balance}}</p>
  <p style="margin: 4px 0;"><strong>Due Date:</strong> {{invoice_due_date}}</p>
</div>`,
    requiredShortCodes: ['invoice_number', 'invoice_balance', 'invoice_due_date'],
  },
  {
    id: 'quote_summary',
    name: 'Quote Summary',
    description: 'Quote details with number, total, and expiry date',
    category: 'summary',
    icon: 'file-text',
    htmlTemplate: `<div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
  <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 18px; font-weight: 600;">Quote Summary</h3>
  <p style="margin: 4px 0;"><strong>Quote Number:</strong> {{quote_number}}</p>
  <p style="margin: 4px 0;"><strong>Total Amount:</strong> {{quote_total}}</p>
  <p style="margin: 4px 0;"><strong>Valid Until:</strong> {{quote_expiry_date}}</p>
</div>`,
    requiredShortCodes: ['quote_number', 'quote_total', 'quote_expiry_date'],
  },
  {
    id: 'payment_button',
    name: 'Payment Button',
    description: 'Call-to-action button for invoice payment',
    category: 'action',
    icon: 'credit-card',
    htmlTemplate: `<div style="text-align: center; margin: 24px 0;">
  <a href="{{invoice_link}}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
    Pay Invoice Now
  </a>
</div>`,
    requiredShortCodes: ['invoice_link'],
  },
  {
    id: 'quote_approval_button',
    name: 'Quote Approval Button',
    description: 'Call-to-action button for quote approval',
    category: 'action',
    icon: 'check-circle',
    htmlTemplate: `<div style="text-align: center; margin: 24px 0;">
  <a href="{{quote_link}}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
    Review & Approve Quote
  </a>
</div>`,
    requiredShortCodes: ['quote_link'],
  },
  {
    id: 'art_approval_button',
    name: 'Art Approval Button',
    description: 'Call-to-action button for artwork approval',
    category: 'action',
    icon: 'check-circle',
    htmlTemplate: `<div style="text-align: center; margin: 24px 0;">
  <a href="{{art_approval_link}}" style="display: inline-block; background-color: #8b5cf6; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
    Review & Approve Artwork
  </a>
</div>`,
    requiredShortCodes: ['art_approval_link'],
  },
  {
    id: 'company_signature',
    name: 'Company Signature',
    description: 'Professional email signature with company details',
    category: 'signature',
    icon: 'building',
    htmlTemplate: `<div style="margin-top: 32px; padding-top: 16px; border-top: 2px solid #e5e7eb;">
  <p style="margin: 4px 0;">Best regards,</p>
  <p style="margin: 4px 0; font-weight: 600;">{{user_name}}</p>
  <p style="margin: 4px 0; color: #6b7280;">{{company_name}}</p>
  <p style="margin: 4px 0; color: #6b7280;">{{company_phone}}</p>
  <p style="margin: 4px 0; color: #6b7280;">{{company_email}}</p>
</div>`,
    requiredShortCodes: ['user_name', 'company_name', 'company_phone', 'company_email'],
  },
  {
    id: 'divider',
    name: 'Divider',
    description: 'Horizontal line to separate content',
    category: 'layout',
    icon: 'minus',
    htmlTemplate: '<hr style="border: none; border-top: 1px solid #d1d5db; margin: 24px 0;" />',
    requiredShortCodes: [],
  },
];

export const BLOCK_CATEGORIES = {
  greeting: { label: 'Greetings', icon: 'user' },
  summary: { label: 'Summaries', icon: 'file-text' },
  action: { label: 'Call to Action', icon: 'mouse-pointer' },
  signature: { label: 'Signatures', icon: 'pen-tool' },
  layout: { label: 'Layout', icon: 'layout' },
};
