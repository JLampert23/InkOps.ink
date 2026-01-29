#!/usr/bin/env node

/**
 * ENV Credentials Fix Script
 *
 * This script automatically restores the correct Supabase credentials to your .env file.
 * Run this if your .env file has been overridden with incorrect values.
 *
 * Usage: node fix-env-credentials.js
 */

import { writeFileSync, readFileSync } from 'fs';

const CORRECT_CREDENTIALS = `VITE_SUPABASE_URL=https://cuaukcvccxvfpuxaciac.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjA4NTQsImV4cCI6MjA4MjEzNjg1NH0.I-FDsR0oezVPxKcWgFmV-MMolV6E-lYcoA7Ew8ZgKYU
`;

console.log('🔧 Fixing .env credentials...\n');

try {
  // Read current .env
  let currentContent = '';
  try {
    currentContent = readFileSync('.env', 'utf8');
  } catch (error) {
    console.log('📝 No existing .env file found. Creating new one...');
  }

  // Check if already correct
  if (currentContent.includes('https://cuaukcvccxvfpuxaciac.supabase.co')) {
    console.log('✅ .env file already has correct credentials!');
    console.log('   No changes needed.\n');
    process.exit(0);
  }

  // Backup old .env
  if (currentContent) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `.env.backup.${timestamp}`;
    writeFileSync(backupFile, currentContent);
    console.log(`💾 Backed up old .env to: ${backupFile}`);
  }

  // Write correct credentials
  writeFileSync('.env', CORRECT_CREDENTIALS);
  console.log('✅ Updated .env with correct credentials');

  // Also update .env.example to prevent future issues
  writeFileSync('.env.example', `# Supabase Configuration
${CORRECT_CREDENTIALS}
# Multi-Tenant Auth System
# Each company stores their own credentials securely in the database.
# Credentials are encrypted using AES-256-GCM before storage.
#
# IMPORTANT: Configure the ENCRYPTION_KEY in your Supabase Edge Function environment:
# 1. Go to your Supabase dashboard
# 2. Navigate to Edge Functions → Secrets
# 3. Add this as a secret:
#    - ENCRYPTION_KEY: a-strong-random-key-at-least-32-characters-long
#
# You can generate a secure key with: openssl rand -base64 32
#
# Companies enter their credentials during signup or in Settings, and they are:
# 1. Encrypted via the crypto-service Edge Function
# 2. Stored securely in the company_settings table
# 3. Decrypted only when needed for API calls
# 4. Never exposed to the frontend

# Email Service (Resend)
# Configure Resend through the application UI:
# 1. Log in to your application
# 2. Go to Settings → Integrations
# 3. Scroll to Resend Email Integration section
# 4. Enter your Resend API key
# 5. Click Save
#
# Get your Resend API key from: https://resend.com/api-keys
# The API key is encrypted and stored securely in the database

# All other credentials (Printavo, Stripe, Square, SanMar, SSActivewear, Twilio)
# are managed through the application UI in the Settings → Integrations section
# and are stored encrypted in the database for security.
`);
  console.log('✅ Updated .env.example with correct credentials\n');

  console.log('🎉 Fix complete!\n');
  console.log('📋 Summary:');
  console.log('   ✅ .env updated');
  console.log('   ✅ .env.example updated');
  console.log('   ✅ Fallback credentials exist in:');
  console.log('      - src/lib/supabase-client.ts');
  console.log('      - src/lib/apollo-client.ts\n');

  console.log('💡 Next steps:');
  console.log('   1. Restart your dev server (if running)');
  console.log('   2. Run: node verify-env-credentials.js (to verify)\n');

  process.exit(0);

} catch (error) {
  console.error('❌ Error fixing credentials:', error.message);
  console.error('\nStack trace:', error.stack);
  process.exit(1);
}
