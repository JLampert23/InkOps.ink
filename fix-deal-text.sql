-- Fix any email templates that say "deal" instead of "quote"

-- Update subject lines
UPDATE communication_templates
SET subject_template = REPLACE(subject_template, 'deal', 'quote')
WHERE LOWER(subject_template) LIKE '%deal%'
  AND template_type = 'quote_email_default';

UPDATE communication_templates
SET subject_template = REPLACE(subject_template, 'Deal', 'Quote')
WHERE subject_template LIKE '%Deal%'
  AND template_type = 'quote_email_default';

-- Update body templates
UPDATE communication_templates
SET body_template = REPLACE(body_template, 'deal', 'quote')
WHERE LOWER(body_template) LIKE '%deal%'
  AND template_type = 'quote_email_default';

UPDATE communication_templates
SET body_template = REPLACE(body_template, 'Deal', 'Quote')
WHERE body_template LIKE '%Deal%'
  AND template_type = 'quote_email_default';

-- Show what was updated
SELECT
  template_name,
  subject_template,
  LEFT(body_template, 200) as body_preview
FROM communication_templates
WHERE template_type = 'quote_email_default'
ORDER BY template_name;
