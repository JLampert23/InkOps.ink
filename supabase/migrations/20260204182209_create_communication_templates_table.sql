/*
  # Create Communication Templates Table

  1. New Tables
    - `communication_templates`
      - `id` (uuid, primary key) - Unique template identifier
      - `company_id` (uuid, foreign key) - Links to companies table for data isolation
      - `template_type` (text) - Type of template (quote_email_default, invoice_email_default, etc.)
      - `template_name` (text) - User-friendly name for the template
      - `subject_template` (text) - Email subject line with short codes
      - `body_template` (text) - Email body content with short codes and HTML support
      - `auto_attach_quote_link` (boolean) - Automatically include quote approval link
      - `auto_attach_pdf` (boolean) - Automatically attach PDF document
      - `auto_attach_mockups` (boolean) - Automatically attach mockup images
      - `auto_attach_terms` (boolean) - Automatically include payment terms
      - `is_active` (boolean) - Enable/disable template without deletion
      - `created_at` (timestamp) - Record creation timestamp
      - `updated_at` (timestamp) - Last modification timestamp
      - `created_by` (uuid) - User who created the template
      - `updated_by` (uuid) - User who last updated the template

  2. Security
    - Enable RLS on `communication_templates` table
    - Add policies for company-isolated access
    - Only authenticated users can access their company's templates
    - Super admins and admins can manage templates
    - Regular users can only view templates

  3. Indexes
    - Index on company_id for fast company filtering
    - Index on template_type for quick template lookups
    - Composite unique index on (company_id, template_type) to ensure one template per type per company

  4. Constraints
    - Check constraint on template_type for allowed values
    - Foreign keys to companies and auth.users tables
*/

-- Create the communication_templates table
CREATE TABLE IF NOT EXISTS communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  template_name text NOT NULL,
  subject_template text NOT NULL DEFAULT '',
  body_template text NOT NULL DEFAULT '',
  auto_attach_quote_link boolean NOT NULL DEFAULT true,
  auto_attach_pdf boolean NOT NULL DEFAULT false,
  auto_attach_mockups boolean NOT NULL DEFAULT false,
  auto_attach_terms boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Constraint: only allow specific template types
  CONSTRAINT valid_template_type CHECK (
    template_type IN (
      'quote_email_default',
      'invoice_email_default',
      'invoice_reminder',
      'payment_confirmation',
      'approval_email',
      'internal_notification',
      'ar_report',
      'custom'
    )
  )
);

-- Create unique index to ensure one template per type per company
CREATE UNIQUE INDEX IF NOT EXISTS communication_templates_company_type_unique
  ON communication_templates(company_id, template_type)
  WHERE is_active = true;

-- Create index for fast company filtering
CREATE INDEX IF NOT EXISTS communication_templates_company_id_idx
  ON communication_templates(company_id);

-- Create index for template type lookups
CREATE INDEX IF NOT EXISTS communication_templates_type_idx
  ON communication_templates(template_type);

-- Create index for active templates
CREATE INDEX IF NOT EXISTS communication_templates_active_idx
  ON communication_templates(company_id, is_active)
  WHERE is_active = true;

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_communication_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_communication_templates_updated_at_trigger
  BEFORE UPDATE ON communication_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_communication_templates_updated_at();

-- Enable Row Level Security
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their company's templates" ON communication_templates;
DROP POLICY IF EXISTS "Admins can insert templates for their company" ON communication_templates;
DROP POLICY IF EXISTS "Admins can update their company's templates" ON communication_templates;
DROP POLICY IF EXISTS "Admins can delete their company's templates" ON communication_templates;

-- Policy: Users can view their company's templates
CREATE POLICY "Users can view their company's templates"
  ON communication_templates
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- Policy: Admins and super admins can insert templates
CREATE POLICY "Admins can insert templates for their company"
  ON communication_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins and super admins can update templates
CREATE POLICY "Admins can update their company's templates"
  ON communication_templates
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Admins and super admins can delete (soft delete) templates
CREATE POLICY "Admins can delete their company's templates"
  ON communication_templates
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Insert default templates for existing companies
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT id FROM companies LOOP
    -- Default Quote Email Template
    INSERT INTO communication_templates (
      company_id,
      template_type,
      template_name,
      subject_template,
      body_template,
      auto_attach_quote_link,
      auto_attach_pdf,
      auto_attach_mockups,
      auto_attach_terms
    ) VALUES (
      company_record.id,
      'quote_email_default',
      'Default Quote Email',
      'Quote {{quote_number}} for {{customer_company}}',
      '<p>Hi {{customer_first_name}},</p>

<p>Thank you for your interest! Your quote <strong>{{quote_number}}</strong> is ready for review.</p>

<div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0;"><strong>Quote Details:</strong></p>
  <p style="margin: 4px 0;">Total Amount: <strong>{{quote_total}}</strong></p>
  <p style="margin: 4px 0;">Quote Date: {{quote_date}}</p>
  <p style="margin: 4px 0;">Valid Until: {{quote_expiry_date}}</p>
</div>

<p>Please review and approve your quote at your convenience.</p>

<p>If you have any questions or need modifications, please don''t hesitate to reach out.</p>

<p>Best regards,<br/>
{{user_name}}<br/>
{{company_name}}<br/>
{{company_phone}}</p>',
      true,
      false,
      false,
      true
    ) ON CONFLICT DO NOTHING;

    -- Default Invoice Email Template
    INSERT INTO communication_templates (
      company_id,
      template_type,
      template_name,
      subject_template,
      body_template,
      auto_attach_quote_link,
      auto_attach_pdf,
      auto_attach_mockups,
      auto_attach_terms
    ) VALUES (
      company_record.id,
      'invoice_email_default',
      'Default Invoice Email',
      'Invoice {{invoice_number}} from {{company_name}}',
      '<p>Hi {{customer_first_name}},</p>

<p>Thank you for your business! Your invoice <strong>{{invoice_number}}</strong> is now available.</p>

<div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
  <p style="margin: 0;"><strong>Invoice Details:</strong></p>
  <p style="margin: 4px 0;">Invoice Number: <strong>{{invoice_number}}</strong></p>
  <p style="margin: 4px 0;">Total Amount: <strong>{{invoice_total}}</strong></p>
  <p style="margin: 4px 0;">Amount Due: <strong>{{invoice_balance}}</strong></p>
  <p style="margin: 4px 0;">Due Date: {{invoice_due_date}}</p>
</div>

<p>You can view and pay your invoice online using the link provided.</p>

<p>We appreciate your prompt payment.</p>

<p>Best regards,<br/>
{{user_name}}<br/>
{{company_name}}<br/>
{{company_phone}}<br/>
{{company_email}}</p>',
      true,
      true,
      false,
      true
    ) ON CONFLICT DO NOTHING;

  END LOOP;
END $$;

-- Add comment to the table
COMMENT ON TABLE communication_templates IS 'Stores customizable email templates with short code support for quotes, invoices, and other communications';
