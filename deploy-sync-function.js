import { readFileSync } from 'fs';

const content = readFileSync('/tmp/cc-agent/61848443/project/supabase/functions/printavo-sync/index.ts', 'utf-8');
console.log(JSON.stringify({ content }, null, 2));
