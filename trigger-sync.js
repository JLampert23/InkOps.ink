const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const syncUrl = `${supabaseUrl}/functions/v1/printavo-sync`;

console.log('Triggering sync...');
console.log('URL:', syncUrl);

fetch(syncUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify({ mode: 'quick' })
})
  .then(res => res.json())
  .then(data => {
    console.log('Sync triggered:', data);
  })
  .catch(err => {
    console.error('Error:', err.message);
  });
