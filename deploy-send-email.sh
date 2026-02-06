#!/bin/bash

# Deploy send-email function to Supabase
# You need to set your SUPABASE_ACCESS_TOKEN first

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "ERROR: SUPABASE_ACCESS_TOKEN is not set"
    echo ""
    echo "To get your access token:"
    echo "1. Go to https://supabase.com/dashboard/account/tokens"
    echo "2. Generate a new access token"
    echo "3. Run: export SUPABASE_ACCESS_TOKEN='your-token-here'"
    echo "4. Then run this script again"
    exit 1
fi

echo "Deploying send-email function..."
npx supabase functions deploy send-email \
    --project-ref cuaukcvccxvfpuxaciac \
    --no-verify-jwt

echo "Deployment complete!"
