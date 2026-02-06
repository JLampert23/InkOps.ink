/*
  # Add Purchase Order Settings to Company Settings

  1. New Columns
    - PO Numbering & Defaults
      - `po_number_format` (text) - Format with tokens like PO-{YYYY}-{SEQ}
      - `po_starting_sequence` (integer) - Starting number for {SEQ} token
      - `po_default_vendor_id` (uuid) - Reference to vendors table
      - `po_default_notes` (text) - Default notes for new POs
    
    - PO Approval Rules
      - `po_require_approval_before_sending` (boolean)
      - `po_allow_editing_after_sending` (boolean)
      - `po_require_reason_for_edits` (boolean)
    
    - PO Email & Communication
      - `po_default_email_template_id` (uuid) - Reference to email template
      - `po_auto_attach_pdf` (boolean)
      - `po_cc_accounting` (boolean)
      - `po_cc_sales_rep` (boolean)
      - `po_vendor_confirmation_required` (boolean)
    
    - Attachments & Documents
      - `po_require_pdf_before_sending` (boolean)
      - `po_allow_additional_attachments` (boolean)
      - `po_default_footer` (text)
    
    - Advanced Settings
      - `po_auto_group_by_vendor` (boolean)
      - `po_auto_split_by_vendor` (boolean)
      - `po_allow_without_linked_jobs` (boolean)
      - `po_allow_deleting_drafts` (boolean)
  
  2. Security
    - All columns are part of company_settings table which already has RLS
*/

-- Add PO Numbering & Defaults
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS po_number_format text DEFAULT 'PO-{YYYY}-{SEQ}',
ADD COLUMN IF NOT EXISTS po_starting_sequence integer DEFAULT 1000,
ADD COLUMN IF NOT EXISTS po_default_vendor_id uuid,
ADD COLUMN IF NOT EXISTS po_default_notes text;

-- Add PO Approval Rules
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS po_require_approval_before_sending boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS po_allow_editing_after_sending boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS po_require_reason_for_edits boolean DEFAULT false;

-- Add PO Email & Communication
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS po_default_email_template_id uuid,
ADD COLUMN IF NOT EXISTS po_auto_attach_pdf boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS po_cc_accounting boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS po_cc_sales_rep boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS po_vendor_confirmation_required boolean DEFAULT false;

-- Add Attachments & Documents
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS po_require_pdf_before_sending boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS po_allow_additional_attachments boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS po_default_footer text;

-- Add Advanced Settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS po_auto_group_by_vendor boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS po_auto_split_by_vendor boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS po_allow_without_linked_jobs boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS po_allow_deleting_drafts boolean DEFAULT true;

-- Add foreign key constraint for vendor (optional - vendor can be null)
ALTER TABLE company_settings
ADD CONSTRAINT fk_po_default_vendor 
FOREIGN KEY (po_default_vendor_id) 
REFERENCES vendors(id) 
ON DELETE SET NULL;

-- Add foreign key constraint for email template (optional - template can be null)
ALTER TABLE company_settings
ADD CONSTRAINT fk_po_default_email_template 
FOREIGN KEY (po_default_email_template_id) 
REFERENCES communication_templates(id) 
ON DELETE SET NULL;
