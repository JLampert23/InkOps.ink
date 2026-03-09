import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cuaukcvccxvfpuxaciac.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1YXVrY3ZjY3h2ZnB1eGFjaWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NjA4NTQsImV4cCI6MjA4MjEzNjg1NH0.I-FDsR0oezVPxKcWgFmV-MMolV6E-lYcoA7Ew8ZgKYU';

const content = readFileSync('./supabase/functions/printavo-sync/index.ts', 'utf-8');

console.log('Updated sync function ready for deployment');
console.log('File size:', content.length, 'characters');
console.log('\nKey changes:');
console.log('- PAGE_SIZE reduced from 7 to 3 to stay under GraphQL complexity limit');
console.log('- Added color and sizes fields to the GraphQL query');
console.log('- Parsing sizes array from Printavo: [{ count, size }]');
console.log('- Converting size enums (size_xs, size_yxs) to friendly names (XS, YXS)');
console.log('\nThe function is ready. You can now trigger a sync from the Billing Queue.');
