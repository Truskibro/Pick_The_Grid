const https = require('https');
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

function fetchTable(table, select) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    https.get(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  const [ach, profiles] = await Promise.all([
    fetchTable('user_achievements', 'user_id,achievement_id,unlocked_tiers,current_value'),
    fetchTable('profiles', 'id,username,display_name'),
  ]);
  const nameMap = {};
  for (const p of profiles) nameMap[p.id] = p.display_name || p.username || p.id.slice(0,8);
  const byUser = {};
  for (const r of ach) {
    if (!byUser[r.user_id]) byUser[r.user_id] = [];
    byUser[r.user_id].push(r);
  }
  for (const [uid, rows] of Object.entries(byUser)) {
    const unlocked = rows.filter(r => r.unlocked_tiers && r.unlocked_tiers.length > 0);
    console.log(`\n${nameMap[uid] || uid.slice(0,8)} (${unlocked.length}/${rows.length} unlocked):`);
    for (const r of unlocked) {
      console.log(`  ${r.achievement_id}: tiers=[${r.unlocked_tiers.join(',')}] value=${r.current_value}`);
    }
  }
})();
