const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const USERS = {
  '652154af-dc27-47b5-aa79-25903b9c4a1b': { name: 'Whitney', dnf: 'STR' },
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': { name: 'Bryan', dnf: 'BOT' },
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': { name: 'Carlos', dnf: 'ALO' },
};
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public', 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

(async () => {
  // Patch DNF for Whitney, Bryan, Carlos on r08
  for (const [uid, info] of Object.entries(USERS)) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?user_id=eq.${uid}&race_id=eq.r08`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ predicted_dnf: info.dnf }),
    });
    const body = await res.text();
    console.log(`${info.name} r08 dnf=${info.dnf}: ${res.status} ${body.slice(0,150)}`);
  }

  // Trigger rescore on r08
  const rr = await fetch(`${SUPABASE_URL}/rest/v1/race_results?race_id=eq.r08&select=fastest_lap_driver_id`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const rrows = await rr.json();
  const fl = rrows[0].fastest_lap_driver_id;
  const tr = await fetch(`${SUPABASE_URL}/rest/v1/race_results?race_id=eq.r08`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ fastest_lap_driver_id: fl }),
  });
  console.log(`Rescore r08: ${tr.status}`);

  await new Promise(r => setTimeout(r, 2500));

  // Verify r08
  console.log('\n=== r08 after fix ===');
  const v = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?race_id=eq.r08&select=user_id,predicted_dnf,points_earned,sprint_points_earned`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const vrows = await v.json();
  const names = { '652154af-dc27-47b5-aa79-25903b9c4a1b':'Whitney', 'f35417e9-4f0d-4def-9c2f-c81276863fc0':'Bryan', 'e11ea4f5-2ba4-4241-9791-b4b6a560534b':'Carlos', 'cb7536a7-ad8b-44d4-981b-4b24c19abcc4':'Skye' };
  for (const r of vrows) console.log(`  ${names[r.user_id]||r.user_id.slice(0,8)}: dnf=${r.predicted_dnf} pts=${r.points_earned} spts=${r.sprint_points_earned}`);

  // Full per-race totals
  console.log('\n=== Full per-race totals ===');
  const all = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?race_id=in.(r01,r02,r03,r04,r05,r06,r07,r08,r09,r10)&select=user_id,race_id,points_earned,sprint_points_earned&order=user_id,race_id`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const arows = await all.json();
  const byUser = {};
  for (const r of arows) {
    const n = names[r.user_id] || 'Admin';
    if (!byUser[n]) byUser[n] = {};
    byUser[n][r.race_id] = (r.points_earned||0) + (r.sprint_points_earned||0);
  }
  const races = ['r01','r02','r03','r04','r05','r06','r07','r08','r09','r10'];
  const sheetR10 = { Skye: 224, Whitney: 262, Bryan: 270, Carlos: 312 }; // R13 minus 112
  for (const name of ['Skye','Whitney','Bryan','Carlos','Admin']) {
    if (!byUser[name]) continue;
    let total = 0;
    const parts = races.map(r => { const p = byUser[name][r]||0; total += p; return `${r}:${p}`; });
    const sheet = sheetR10[name];
    const diff = sheet ? ` | sheet=${sheet} diff=${total-sheet>0?'+':''}${total-sheet}` : '';
    console.log(`${name.padEnd(8)} | ${parts.join(' | ')} | TOTAL=${total}${diff}`);
  }

  // Profile totals
  console.log('\n=== Profile totals ===');
  const p = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=username,display_name,total_points&order=total_points.desc`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const prows = await p.json();
  for (const pr of prows) console.log(`  ${pr.username}: ${pr.total_points}`);
})();
