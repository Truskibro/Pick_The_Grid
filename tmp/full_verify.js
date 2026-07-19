const SUPABASE_URL = 'https://fxwgbpassouaddakgyus.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const USERS = {
  'cb7536a7-ad8b-44d4-981b-4b24c19abcc4': 'Skye',
  '652154af-dc27-47b5-aa79-25903b9c4a1b': 'Whitney',
  'f35417e9-4f0d-4def-9c2f-c81276863fc0': 'Bryan',
  'e11ea4f5-2ba4-4241-9791-b4b6a560534b': 'Carlos',
};
(async () => {
  // Get all predictions with points
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_predictions?race_id=in.(r01,r02,r03,r04,r05,r06,r07,r08,r09,r10)&select=user_id,race_id,points_earned,sprint_points_earned&order=user_id,race_id`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Profile': 'public' },
  });
  const rows = await res.json();
  
  // Per-user per-race points
  const byUser = {};
  for (const r of rows) {
    const name = USERS[r.user_id] || 'Admin';
    if (!byUser[name]) byUser[name] = {};
    const total = (r.points_earned || 0) + (r.sprint_points_earned || 0);
    byUser[name][r.race_id] = { race: r.points_earned, sprint: r.sprint_points_earned, total };
  }
  
  // Print per-race
  const races = ['r01','r02','r03','r04','r05','r06','r07','r08','r09','r10'];
  console.log('=== Per-race points (race + sprint = total) ===');
  for (const name of ['Skye','Whitney','Bryan','Carlos','Admin']) {
    if (!byUser[name]) continue;
    let grand = 0;
    const parts = races.map(r => {
      const p = byUser[name][r];
      if (!p) return `${r}:--`;
      grand += p.total;
      return `${r}:${p.total}`;
    });
    console.log(`${name.padEnd(8)} | ${parts.join(' | ')} | TOTAL=${grand}`);
  }
  
  // Spreadsheet comparison (through R10 Austria = r08)
  console.log('\n=== Spreadsheet vs Supabase through R10 Austria (r08) ===');
  const sheet = { Skye: 157, Whitney: 203, Bryan: 162, Carlos: 258 };
  for (const name of ['Skye','Whitney','Bryan','Carlos']) {
    let supa = 0;
    for (const r of ['r01','r02','r03','r04','r05','r06','r07','r08']) {
      if (byUser[name] && byUser[name][r]) supa += byUser[name][r].total;
    }
    const diff = supa - sheet[name];
    console.log(`  ${name.padEnd(8)}: sheet=${sheet[name]} supabase=${supa} diff=${diff > 0 ? '+' : ''}${diff}`);
  }
  
  // Spreadsheet comparison (through R12 Belgian = r10, estimated from R13 minus template)
  console.log('\n=== Through R12 Belgian (r10): spreadsheet R13 total minus 112 template ===');
  const sheetR13 = { Skye: 336, Whitney: 374, Bryan: 382, Carlos: 424 };
  for (const name of ['Skye','Whitney','Bryan','Carlos']) {
    const sheetR12 = sheetR13[name] - 112; // R13 Hungary = template 112
    let supa = 0;
    for (const r of races) {
      if (byUser[name] && byUser[name][r]) supa += byUser[name][r].total;
    }
    const diff = supa - sheetR12;
    console.log(`  ${name.padEnd(8)}: sheet~${sheetR12} supabase=${supa} diff=${diff > 0 ? '+' : ''}${diff}`);
  }
})();
