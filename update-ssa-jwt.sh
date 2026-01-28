#!/bin/bash

# SSActivewear JWT Token
JWT_TOKEN="1adb78cb-cbf0-46e7-878d-6fd87f08d3f4"
ACCOUNT_NUMBER="54074"
COMPANY_ID="5f36fe64-8b67-4b62-a023-29590da87c41"

# Get environment variables
source .env

# Encrypt the JWT token
echo "Encrypting JWT token..."
ENCRYPTED_TOKEN=$(curl -s -X POST \
  "${VITE_SUPABASE_URL}/functions/v1/crypto-service" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" \
  -d "{\"action\":\"encrypt\",\"token\":\"${JWT_TOKEN}\"}" | jq -r '.result')

if [ -z "$ENCRYPTED_TOKEN" ] || [ "$ENCRYPTED_TOKEN" = "null" ]; then
  echo "Error: Failed to encrypt token"
  exit 1
fi

echo "Token encrypted successfully"
echo "Encrypted token: ${ENCRYPTED_TOKEN:0:50}..."

# Update the database
echo "Updating database..."
psql "${DATABASE_URL}" << EOF
UPDATE integration_settings
SET ssactivewear_credentials = jsonb_build_object(
  'accountNumber', '${ACCOUNT_NUMBER}',
  'apiKey', '${ENCRYPTED_TOKEN}',
  'authType', 'jwt'
)
WHERE company_id = '${COMPANY_ID}';
EOF

echo "✅ Credentials updated successfully!"
