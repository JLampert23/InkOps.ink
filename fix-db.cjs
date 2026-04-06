const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : '';
const key = keyMatch ? keyMatch[1].trim() : '';

async function run() {
  const profileRes = await fetch(`${url}/rest/v1/user_profiles?email=eq.chibuzorprince68@gmail.com`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const profiles = await profileRes.json();
  const profile = profiles[0];
  
  if (!profile) {
    console.log("Profile not found");
    return;
  }
  
  console.log("Found profile with company id:", profile.company_id);
  
  const updateRes = await fetch(`${url}/rest/v1/company_settings?id=eq.${profile.company_id}`, {
    method: 'PATCH',
    headers: { 
      'apikey': key, 
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subscription_tier: 'starter',
      stripe_subscription_id: 'sub_bypass_from_checkout',
      subscription_status: 'active'
    })
  });
  
  console.log("Update status:", updateRes.status, await updateRes.text());
}
run().catch(console.error);
