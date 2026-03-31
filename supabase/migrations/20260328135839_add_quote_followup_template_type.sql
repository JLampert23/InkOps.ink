/*
  # Add Quote Follow-Up Template Type

  1. Changes
    - Add 'quote_followup' to the valid_template_type constraint
    - Create default quote follow-up template for existing companies
*/

-- Drop and recreate the constraint to include quote_followup
ALTER TABLE communication_templates
DROP CONSTRAINT IF EXISTS valid_template_type;

ALTER TABLE communication_templates
ADD CONSTRAINT valid_template_type CHECK (
  template_type IN (
    'quote_email_default',
    'invoice_email_default',
    'invoice_reminder',
    'payment_confirmation',
    'approval_email',
    'internal_notification',
    'ar_report',
    'quote_followup',
    'custom'
  )
);

-- Create default quote follow-up template for companies that exist in the companies table
DO $$
DECLARE
  v_company RECORD;
  v_template_id uuid;
BEGIN
  FOR v_company IN SELECT id FROM companies LOOP
    -- Check if template already exists
    IF NOT EXISTS (
      SELECT 1 FROM communication_templates 
      WHERE company_id = v_company.id 
        AND template_type = 'quote_followup'
    ) THEN
      -- Create the template
      INSERT INTO communication_templates (
        company_id,
        template_type,
        template_name,
        subject_template,
        body_template,
        auto_attach_quote_link,
        auto_attach_pdf,
        auto_attach_mockups,
        is_active
      ) VALUES (
        v_company.id,
        'quote_followup',
        'Quote Follow-Up',
        'Following up on Quote {{quote.number}}',
        '<p>Hi {{customer.name}},</p>
<p>I wanted to follow up on the quote we sent you on {{quote.created_date}}.</p>
<p><strong>Quote Number:</strong> {{quote.number}}<br>
<strong>Total Amount:</strong> {{quote.total_formatted}}</p>
<p>Do you have any questions about this quote? I''m here to help!</p>
<p>This quote is valid until {{quote.expiration_date}}.</p>
<p>Best regards,<br>
{{company.name}}</p>',
        true,
        false,
        false,
        true
      )
      RETURNING id INTO v_template_id;

      -- Update company_settings to point to this template (if company_settings exists for this company)
      UPDATE company_settings 
      SET quote_followup_template_id = v_template_id
      WHERE id = v_company.id 
        AND quote_followup_template_id IS NULL;
    END IF;
  END LOOP;
END $$;
