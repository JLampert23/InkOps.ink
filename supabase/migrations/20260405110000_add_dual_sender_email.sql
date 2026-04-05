-- Add dual email sender support to company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS secondary_email_from_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS quote_email_sender VARCHAR(20) DEFAULT 'primary' CHECK (quote_email_sender IN ('primary', 'secondary'));

-- Update existing rows to just strictly use primary for existing configurations
UPDATE company_settings 
SET quote_email_sender = 'primary'
WHERE quote_email_sender IS NULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
