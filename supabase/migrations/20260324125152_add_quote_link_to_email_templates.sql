/*
  # Add Quote Link Button to Existing Email Templates

  1. Changes
    - Updates existing quote_email_default templates that are missing the {{quote_link}} shortcode
    - Adds a styled button to allow customers to review and approve quotes
    - Only updates templates that match the original default template structure
    - Preserves any custom modifications made by companies

  2. Security
    - No RLS changes needed
    - Only updates data, doesn't modify schema

  3. Notes
    - This migration fixes templates that were created before the quote link was added
    - Templates that already have the {{quote_link}} shortcode are not modified
    - The button styling matches the default template in the Edge Function
*/

-- Update existing quote email templates that don't have the quote_link shortcode
UPDATE communication_templates
SET body_template = '<p>Hi {{customer_first_name}},</p>

<p>Thank you for your interest! Your quote <strong>{{quote_number}}</strong> is ready for review.</p>

<div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0;"><strong>Quote Details:</strong></p>
  <p style="margin: 4px 0;">Total Amount: <strong>{{quote_total}}</strong></p>
  <p style="margin: 4px 0;">Quote Date: {{quote_date}}</p>
  <p style="margin: 4px 0;">Valid Until: {{quote_expiry_date}}</p>
</div>

<p>Please review and approve your quote by clicking the button below:</p>

<p style="text-align: center; margin: 24px 0;">
  <a href="{{quote_link}}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">View and Approve Quote</a>
</p>

<p>If you have any questions or need modifications, please don''t hesitate to reach out.</p>

<p>Best regards,<br/>
{{user_name}}<br/>
{{company_name}}<br/>
{{company_phone}}</p>',
  updated_at = now()
WHERE template_type = 'quote_email_default'
  AND body_template NOT LIKE '%{{quote_link}}%'
  AND body_template LIKE '%Please review and approve your quote at your convenience%';