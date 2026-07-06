const https = require('https');
const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';

const VALID_IDS = [
  'race-day-haul','season-campaign','podium-prophet','race-winner','grid-master',
  'weekend-warrior','chaos-caller','perfect-weekend','comeback-drive','season-champion',
  'saturday-specialist','sprint-surgeon','global-podium','best-in-the-world',
  'box-box-box','no-take-backs','golden-goose-egg','hero-to-zero','almost-had-it',
  'ferrari-strategy-dept','chaos-merchant'
];

// Fetch all rows, find stale ones, delete them individually
function fetchAll() {
  return new Promise((resolve, reject) => {
    https.get(`${SUPABASE_URL}/rest/v1/user_achievements?select=user_id,achievement_id`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function deleteRow(userId, achId) {
  return new Promise((resolve, reject) => {
    const filter = `user_id=eq.${userId}&achievement_id=eq.${achId}`;
    const url = `${SUPABASE_URL}/rest/v1/user_achievements?${filter}`;
    const req = https.request(url, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const all = await fetchAll();
  const validSet = new Set(VALID_IDS);
  const stale = all.filter(r => !validSet.has(r.achievement_id));
  console.log(`Found ${stale.length} stale rows (out of ${all.length} total):`);
  for (const r of stale) {
    console.log(`  deleting ${r.user_id.slice(0,8)} ${r.achievement_id}`);
    await deleteRow(r.user_id, r.achievement_id);
  }
  console.log('Done.');
})();
