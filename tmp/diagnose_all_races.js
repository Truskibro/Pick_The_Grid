// Check ALL races — which have results, which have points, especially r11 (most recent).
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4d2dicGFzc291YWRkYWtneXVzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTkwNDQ0MCwiZXhwIjoyMDg3NDgwNDQwfQ.RPGyDnHI5bMPCCXsZAkX-sYB-rzda6SAnf4CVv0D9Wg';
const BASE = 'https://fxwgbpassouaddakgyus.supabase.co/rest/v1';
const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

const CARLOS = 'e11ea4f5-2ba4-4241-9791-b4b6a560534b';
const WHITNEY = '652154af-dc27-47b5-aa79-25903b9c4a1b';

async function main() {
  // 1. All race_results rows
  const rrRes = await fetch(`${BASE}/race_results?select=*&order=race_id.asc`, { headers });
  const allRR = await rrRes.json();
  console.log('=== ALL RACE RESULTS ROWS ===');
  for (const r of allRR) {
    const cls = r.classification || [];
    const top10 = cls.filter(c => c.status === 'finished' || c.status === 'dnf').slice(0, 10).map(c => c.driverId);
    const sprintCls = r.sprint_classification || [];
    const sprintTop8 = sprintCls.filter(c => c.status === 'finished').slice(0, 8).map(c => c.driverId);
    const dnfIds = cls.filter(c => c.status === 'dnf').map(c => c.driverId);
    console.log(`  ${r.race_id}: classification(${cls.length}) sprint_classification(${sprintCls.length}) fl=${r.fastest_lap_driver_id} dnf=[${dnfIds}] series_id=${r.series_id}`);
  }
  console.log();

  // 2. Carlos & Whitney predictions across ALL races with points
  const predRes = await fetch(`${BASE}/user_predictions?user_id=in.(${CARLOS},${WHITNEY})&select=*&order=race_id.asc,user_id.asc`, { headers });
  const preds = await predRes.json();
  console.log('=== CARLOS & WHITNEY ALL PREDICTIONS ===');
  for (const p of preds) {
    const name = p.user_id === CARLOS ? 'CARLOS' : 'WHITNEY';
    const total = (p.points_earned || 0) + (p.sprint_points_earned || 0);
    console.log(`  ${p.race_id} ${name}: pts=${p.points_earned} sprint_pts=${p.sprint_points_earned} TOTAL=${total} series=${p.series_id}`);
  }
  console.log();

  // 3. Check r11 specifically (most recent — Hungarian GP today July 26)
  console.log('=== r11 DETAIL ===');
  const r11rr = allRR.filter(r => r.race_id === 'r11');
  if (r11rr.length === 0) {
    console.log('  NO race_results row for r11 — no results yet, so no points scored');
  } else {
    console.log('  r11 results exist:', JSON.stringify(r11rr[0], null, 2));
  }

  const r11preds = preds.filter(p => p.race_id === 'r11');
  console.log(`  r11 predictions: ${r11preds.length} rows`);
  for (const p of r11preds) {
    const name = p.user_id === CARLOS ? 'CARLOS' : 'WHITNEY';
    console.log(`    ${name}: pts=${p.points_earned} sprint=${p.sprint_points_earned} top10=[${p.predicted_top10}]`);
  }

  // 4. Check the races table to see which races are marked completed
  console.log('\n=== RACES TABLE (completed status) ===');
  const racesRes = await fetch(`${BASE}/races?select=*&order=race_id.asc`, { headers });
  const races = await racesRes.json();
  for (const r of races) {
    if (r.race_id <= 'r12') {
      console.log(`  ${r.race_id}: ${r.name} status=${r.status} series_id=${r.series_id} completed=${r.completed}`);
    }
  }

  // 5. Profile totals
  console.log('\n=== PROFILE TOTALS ===');
  const profRes = await fetch(`${BASE}/profiles?select=id,username,total_points,motogp_total_points`, { headers });
  const profiles = await profRes.json();
  for (const p of profiles) {
    console.log(`  ${p.username}: total=${p.total_points} motogp=${p.motogp_total_points}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
