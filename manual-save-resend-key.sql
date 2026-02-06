-- Manual script to save Resend API key
-- Replace YOUR_RESEND_API_KEY with your actual key (starts with re_)
-- Replace YOUR_FROM_EMAIL with your sending email address

-- First, encrypt the key using crypto-service
-- You'll need to run this curl command in your terminal:

/*
curl -X POST https://cuaukcvccxvfpuxaciac.supabase.co/functions/v1/crypto-service \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -d '{"action": "encrypt", "token": "YOUR_RESEND_API_KEY"}'

This will return an encrypted token. Copy it and use it below.
*/

-- Then update your company settings with the encrypted key:
UPDATE company_settings
SET
  resend_api_key = 'PASTE_ENCRYPTED_KEY_HERE',
  email_from_address = 'YOUR_FROM_EMAIL'
WHERE id = (SELECT company_id FROM user_profiles WHERE id = auth.uid());
