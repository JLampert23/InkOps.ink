#!/usr/bin/env node

/**
 * ENV Credentials Verification Script
 *
 * This script verifies that your .env file contains the correct Supabase credentials.
 * Run this anytime to check if your environment is configured correctly.
 *
 * Usage: node verify-env-credentials.js
 */

import { readFileSync } from 'fs';

const CORRECT_URL = 'https://cuaukcvccxvfpuxaciac.supabase.co';
const CORRECT_KEY_PREFIX = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24i';

console.log('🔍 Verifying .env file credentials...\n');

try {
  const envContent = readFileSync('.env', 'utf8');
  const lines = envContent.split('\n');

  let url = null;
  let anonKey = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      url = trimmed.split('=')[1]?.trim();
    }
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      anonKey = trimmed.split('=')[1]?.trim();
    }
  });

  console.log('📋 Current Configuration:');
  console.log(`   URL: ${url || '❌ NOT SET'}`);
  console.log(`   Key: ${anonKey ? anonKey.substring(0, 50) + '...' : '❌ NOT SET'}\n`);

  let hasErrors = false;

  if (url !== CORRECT_URL) {
    console.log('❌ INCORRECT URL');
    console.log(`   Expected: ${CORRECT_URL}`);
    console.log(`   Found:    ${url || 'NOT SET'}\n`);
    hasErrors = true;
  } else {
    console.log('✅ URL is correct\n');
  }

  if (!anonKey || !anonKey.startsWith(CORRECT_KEY_PREFIX)) {
    console.log('❌ INCORRECT ANON KEY');
    console.log(`   Expected prefix: ${CORRECT_KEY_PREFIX.substring(0, 50)}...`);
    console.log(`   Found prefix:    ${anonKey ? anonKey.substring(0, 50) + '...' : 'NOT SET'}\n`);
    hasErrors = true;
  } else {
    console.log('✅ Anon Key is correct\n');
  }

  if (hasErrors) {
    console.log('⚠️  CREDENTIALS ARE INCORRECT!\n');
    console.log('To fix this issue:');
    console.log('1. Edit your .env file');
    console.log('2. Set VITE_SUPABASE_URL to: ' + CORRECT_URL);
    console.log('3. Set VITE_SUPABASE_ANON_KEY to the correct key (check .env.example)\n');
    console.log('💡 Note: Even with incorrect .env, the app has fallback credentials in:');
    console.log('   - src/lib/supabase-client.ts');
    console.log('   - src/lib/apollo-client.ts\n');
    process.exit(1);
  } else {
    console.log('🎉 All credentials are correct!\n');
    process.exit(0);
  }

} catch (error) {
  console.error('❌ Error reading .env file:', error.message);
  console.log('\n💡 If .env is missing, copy from .env.example:');
  console.log('   cp .env.example .env\n');
  process.exit(1);
}
